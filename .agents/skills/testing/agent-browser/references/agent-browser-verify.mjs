#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const CWD = process.cwd();
const RUNS_ROOT = path.join(CWD, "tests", "agent-browser-runs");
const DEFAULT_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const DEFAULT_RETENTION_HOURS = 48;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function runId() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    name: "browser-verify",
    actionsFile: "",
    session: "alleato-pm-e2e",
    retentionHours: DEFAULT_RETENTION_HOURS,
    skipCleanup: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--url" && argv[i + 1]) {
      options.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--name" && argv[i + 1]) {
      options.name = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--actions-file" && argv[i + 1]) {
      options.actionsFile = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--session" && argv[i + 1]) {
      options.session = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--retention-hours" && argv[i + 1]) {
      options.retentionHours = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--skip-cleanup") {
      options.skipCleanup = true;
      continue;
    }
  }

  if (!Number.isFinite(options.retentionHours) || options.retentionHours <= 0) {
    throw new Error(`Invalid --retention-hours value: ${options.retentionHours}`);
  }

  return options;
}

function execute(cmd, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: CWD,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });

  if ((result.status ?? 1) !== 0 && !allowFailure) {
    const stderr = (result.stderr || "").toString().trim();
    const stdout = (result.stdout || "").toString().trim();
    const output = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(`Command failed: ${[cmd, ...args].join(" ")}\n${output}`);
  }

  return result;
}

function runAgentBrowser(session, args, opts = {}) {
  return execute("agent-browser", ["--session", session, ...args], opts);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseActionsFile(actionsFile) {
  if (!actionsFile) return [];
  if (!fs.existsSync(actionsFile)) {
    throw new Error(`Actions file not found: ${actionsFile}`);
  }

  return fs
    .readFileSync(actionsFile, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function runActionLine(session, line) {
  const result = execute(
    "zsh",
    ["-lc", `agent-browser --session ${session} ${line}`],
    { capture: true, allowFailure: true },
  );
  return {
    command: `agent-browser --session ${session} ${line}`,
    exitCode: result.status ?? 1,
    stdout: (result.stdout || "").toString(),
    stderr: (result.stderr || "").toString(),
  };
}

function writeFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}

function summarize(actionsOutput, metadata) {
  const failedActions = actionsOutput.filter((entry) => entry.exitCode !== 0);
  const lines = [];

  lines.push(`# Agent Browser Verification - ${metadata.runName}`);
  lines.push("");
  lines.push(`- Run ID: \`${metadata.runId}\``);
  lines.push(`- Status: **${failedActions.length === 0 ? "PASS" : "FAIL"}**`);
  lines.push(`- URL: \`${metadata.url}\``);
  lines.push(`- Session: \`${metadata.session}\``);
  lines.push(`- Started: \`${metadata.startedAt}\``);
  lines.push(`- Finished: \`${metadata.finishedAt}\``);
  lines.push(`- Actions executed: \`${actionsOutput.length}\``);
  lines.push(`- Action failures: \`${failedActions.length}\``);
  lines.push(`- Run directory: \`${metadata.relativeRunDir}\``);
  lines.push("");
  lines.push("## Evidence");
  lines.push("");
  lines.push(`- Video: \`${metadata.relativeVideoPath}\``);
  lines.push(`- Initial screenshot: \`${metadata.relativeInitialShot}\``);
  lines.push(`- Final screenshot: \`${metadata.relativeFinalShot}\``);
  lines.push(`- Initial snapshot: \`${metadata.relativeInitialSnapshot}\``);
  lines.push(`- Final snapshot: \`${metadata.relativeFinalSnapshot}\``);
  lines.push(`- Console log: \`${metadata.relativeConsoleLog}\``);
  lines.push(`- Errors log: \`${metadata.relativeErrorsLog}\``);
  lines.push(`- Actions log: \`${metadata.relativeActionsLog}\``);
  lines.push("");

  if (failedActions.length > 0) {
    lines.push("## Failed Actions");
    lines.push("");
    for (const action of failedActions) {
      lines.push(`- \`${action.command}\``);
      if (action.stderr.trim()) {
        lines.push("```text");
        lines.push(action.stderr.trim().split("\n").slice(0, 6).join("\n"));
        lines.push("```");
      }
    }
    lines.push("");
  }

  lines.push("## Next Step");
  lines.push("");
  lines.push("- Open the video and screenshots first, then inspect action and error logs for any failing step.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDir(RUNS_ROOT);

  if (!options.skipCleanup) {
    execute("node", [
      "scripts/agent-browser-cleanup.mjs",
      "--hours",
      String(options.retentionHours),
      "--run-root",
      RUNS_ROOT,
    ]);
  }

  const id = runId();
  const runName = slugify(options.name || "browser-verify");
  const runDir = path.join(RUNS_ROOT, `${id}-${runName}`);
  ensureDir(runDir);

  const startedAt = new Date().toISOString();
  const initialSnapshotPath = path.join(runDir, "snapshot-initial.txt");
  const finalSnapshotPath = path.join(runDir, "snapshot-final.txt");
  const initialShotPath = path.join(runDir, "01-initial.png");
  const finalShotPath = path.join(runDir, "99-final.png");
  const consoleLogPath = path.join(runDir, "console.log");
  const errorsLogPath = path.join(runDir, "errors.log");
  const actionsLogPath = path.join(runDir, "actions.log");
  const videoPath = path.join(runDir, "session.webm");

  const actions = parseActionsFile(options.actionsFile);
  const actionsOutput = [];
  let failed = false;

  try {
    runAgentBrowser(options.session, ["close"], { allowFailure: true });

    runAgentBrowser(options.session, ["open", options.url]);
    runAgentBrowser(options.session, ["wait", "--load", "networkidle"]);

    const initialSnapshot = runAgentBrowser(options.session, ["snapshot", "-i"], { capture: true });
    writeFile(initialSnapshotPath, (initialSnapshot.stdout || "").toString());

    runAgentBrowser(options.session, ["screenshot", "--full", initialShotPath]);
    runAgentBrowser(options.session, ["record", "start", videoPath]);

    for (const line of actions) {
      const output = runActionLine(options.session, line);
      actionsOutput.push(output);
      if (output.exitCode !== 0) {
        failed = true;
      }
    }

    const consoleOutput = runAgentBrowser(options.session, ["console"], { capture: true, allowFailure: true });
    writeFile(consoleLogPath, (consoleOutput.stdout || "").toString());

    const errorsOutput = runAgentBrowser(options.session, ["errors"], { capture: true, allowFailure: true });
    writeFile(errorsLogPath, (errorsOutput.stdout || "").toString());

    const finalSnapshot = runAgentBrowser(options.session, ["snapshot", "-i"], { capture: true, allowFailure: true });
    writeFile(finalSnapshotPath, (finalSnapshot.stdout || "").toString());

    runAgentBrowser(options.session, ["screenshot", "--full", finalShotPath], { allowFailure: true });
  } finally {
    runAgentBrowser(options.session, ["record", "stop"], { allowFailure: true });
    runAgentBrowser(options.session, ["close"], { allowFailure: true });
  }

  const finishedAt = new Date().toISOString();
  writeFile(
    actionsLogPath,
    actionsOutput
      .map((entry) => {
        const blocks = [];
        blocks.push(`$ ${entry.command}`);
        blocks.push(`exit_code=${entry.exitCode}`);
        if (entry.stdout.trim()) {
          blocks.push("stdout:");
          blocks.push(entry.stdout.trim());
        }
        if (entry.stderr.trim()) {
          blocks.push("stderr:");
          blocks.push(entry.stderr.trim());
        }
        return blocks.join("\n");
      })
      .join("\n\n---\n\n"),
  );

  const summary = summarize(actionsOutput, {
    runId: id,
    runName,
    url: options.url,
    session: options.session,
    startedAt,
    finishedAt,
    relativeRunDir: path.relative(CWD, runDir),
    relativeVideoPath: path.relative(CWD, videoPath),
    relativeInitialShot: path.relative(CWD, initialShotPath),
    relativeFinalShot: path.relative(CWD, finalShotPath),
    relativeInitialSnapshot: path.relative(CWD, initialSnapshotPath),
    relativeFinalSnapshot: path.relative(CWD, finalSnapshotPath),
    relativeConsoleLog: path.relative(CWD, consoleLogPath),
    relativeErrorsLog: path.relative(CWD, errorsLogPath),
    relativeActionsLog: path.relative(CWD, actionsLogPath),
  });

  const summaryPath = path.join(runDir, "VERIFICATION_SUMMARY.md");
  writeFile(summaryPath, summary);

  console.log(`[agent-browser-verify] summary=${path.relative(CWD, summaryPath)}`);
  console.log(`[agent-browser-verify] run_dir=${path.relative(CWD, runDir)}`);

  if (failed) {
    process.exit(1);
  }
}

main();
