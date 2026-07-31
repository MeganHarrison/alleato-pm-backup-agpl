#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CWD = process.cwd();
const RUNS_ROOT = path.join(CWD, "tests", "agent-browser-runs");
const CLEANUP_SCRIPT_PATH = path.join(
  CWD,
  "scripts",
  "agent-browser",
  "agent-browser-cleanup.mjs",
);
const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const DEFAULT_ROUTE = "/tasks";
const DEFAULT_RETENTION_HOURS = 48;

function usage() {
  return [
    "Usage: npm run e2e:browser -- --route <path-or-url> [options]",
    "",
    "Options:",
    "  --base-url <origin>       App origin (default: http://localhost:3000)",
    "  --route <path-or-url>     Protected route to test (default: /tasks)",
    "  --actions <file>          One agent-browser action per line",
    "  --name <name>             Evidence run name",
    "  --session <name>          Isolated browser session name",
    "",
    "The runner refreshes authenticated browser state, rejects login/access-denied",
    "landings, then writes screenshots, video, DOM snapshots, console, and error logs",
    "to tests/agent-browser-runs/.",
  ].join("\n");
}

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
    baseUrl: DEFAULT_BASE_URL,
    route: DEFAULT_ROUTE,
    url: "",
    name: "browser-e2e",
    actionsFile: "",
    session: "alleato-pm-e2e",
    retentionHours: DEFAULT_RETENTION_HOURS,
    skipCleanup: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    if (token === "--base-url" && argv[i + 1]) {
      options.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--route" && argv[i + 1]) {
      options.route = argv[i + 1];
      i += 1;
      continue;
    }
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
    if ((token === "--actions" || token === "--actions-file") && argv[i + 1]) {
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
    throw new Error(`Unknown or incomplete option: ${token}\n\n${usage()}`);
  }

  if (!Number.isFinite(options.retentionHours) || options.retentionHours <= 0) {
    throw new Error(`Invalid --retention-hours value: ${options.retentionHours}`);
  }

  return options;
}

export function resolveTarget(options) {
  const baseUrl = new URL(options.baseUrl).origin;
  const targetUrl = options.url
    ? new URL(options.url)
    : new URL(options.route, `${baseUrl}/`);

  if (!options.url && targetUrl.origin !== baseUrl) {
    throw new Error("--route must stay on the --base-url origin.");
  }

  return {
    baseUrl: targetUrl.origin,
    targetUrl: targetUrl.toString(),
    route: `${targetUrl.pathname}${targetUrl.search}`,
  };
}

export function extractBrowserErrors(consoleOutput, errorsOutput = "") {
  const consoleErrors = consoleOutput
    .split("\n")
    .filter((line) => line.trim().startsWith("[error]"));
  const reportedErrors = errorsOutput
    .split("\n")
    .filter((line) => line.trim().length > 0);
  return [...new Set([...consoleErrors, ...reportedErrors])];
}

function execute(cmd, args, { capture = false, allowFailure = false, cwd = CWD, env = process.env } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    env,
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
  const stateArgs = opts.statePath ? ["--state", opts.statePath] : [];
  return execute("agent-browser", ["--session", session, ...stateArgs, ...args], opts);
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

export function appendNodePath(existingNodePath, dependencyRoot) {
  return [dependencyRoot, existingNodePath]
    .filter(Boolean)
    .join(path.delimiter);
}

const AUTH_ENVIRONMENT_NAMES = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_USER_1",
  "TEST_PASSWORD_1",
]);

export function mergeMissingAuthEnvironment(environment, contents) {
  for (const line of contents.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || !AUTH_ENVIRONMENT_NAMES.has(match[1]) || environment[match[1]]) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    environment[match[1]] = value;
  }
  return environment;
}

function loadMissingAuthEnvironment(environment, workspaceRoot) {
  for (const relativePath of [".env", "frontend/.env.local", "frontend/.env"]) {
    const filePath = path.join(workspaceRoot, relativePath);
    if (fs.existsSync(filePath)) {
      mergeMissingAuthEnvironment(environment, fs.readFileSync(filePath, "utf8"));
    }
  }
}

function sharedFrontendNodeModules() {
  const localDependencies = path.join(CWD, "frontend", "node_modules");
  if (fs.existsSync(path.join(localDependencies, "@playwright", "test"))) {
    return localDependencies;
  }

  const worktrees = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: CWD,
    encoding: "utf8",
  });
  if (worktrees.status !== 0) return null;

  const candidates = worktrees.stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .filter((worktree) => path.resolve(worktree) !== path.resolve(CWD));

  for (const worktree of candidates) {
    const dependencies = path.join(worktree, "frontend", "node_modules");
    if (fs.existsSync(path.join(dependencies, "@playwright", "test"))) {
      return dependencies;
    }
  }

  return null;
}

function prepareAuthenticatedBrowser(baseUrl, route, session) {
  console.log(`[agent-browser-verify] preparing authenticated session=${session}`);
  const dependencyRoot = sharedFrontendNodeModules();
  const playwrightCli = dependencyRoot
    ? path.join(dependencyRoot, ".bin", "playwright")
    : "";
  const env = dependencyRoot
    ? {
        ...process.env,
        NODE_PATH: appendNodePath(process.env.NODE_PATH, dependencyRoot),
        ALLEATO_PLAYWRIGHT_CLI: playwrightCli,
      }
    : { ...process.env };
  loadMissingAuthEnvironment(env, CWD);

  if (dependencyRoot && dependencyRoot !== path.join(CWD, "frontend", "node_modules")) {
    loadMissingAuthEnvironment(env, path.resolve(dependencyRoot, "../.."));
    console.log(`[agent-browser-verify] using shared Playwright dependencies from ${dependencyRoot}`);
  }

  execute(
    "npm",
    [
      "run",
      "verify:browser-auth",
      "--",
      "--base-url",
      baseUrl,
      "--route",
      route,
      "--session",
      session,
    ],
    { cwd: CWD, env },
  );
}

function currentBrowserUrl(session) {
  const result = runAgentBrowser(session, ["get", "url"], {
    capture: true,
    allowFailure: true,
  });
  return (result.stdout || "").toString().trim();
}

export function classifyProtectedLanding(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/auth/login")) {
      return { kind: "login" };
    }
    if (parsed.pathname.startsWith("/access-denied")) {
      return {
        kind: "access-denied",
        reason: parsed.searchParams.get("reason") || "unspecified",
      };
    }
    return null;
  } catch {
    return { kind: "invalid-url" };
  }
}

function assertAuthenticatedLanding(session, targetUrl) {
  const openedUrl = currentBrowserUrl(session);
  const initialLanding = classifyProtectedLanding(openedUrl);
  if (!initialLanding) return;

  if (initialLanding.kind === "access-denied") {
    throw new Error(
      [
        "Browser verification reached an authorization-denied page for a protected route.",
        `Target: ${targetUrl}`,
        `Final URL: ${openedUrl}`,
        `Authorization reason: ${initialLanding.reason}`,
        "Cause: the saved test session authenticated, but the deployed app could not resolve its required profile or project access.",
        "Detection gap: the verifier previously treated access-denied pages as successful evidence because it only rejected login redirects.",
        "Prevention: the verifier now classifies access-denied landings before it captures screenshots or executes actions.",
        "Recovery: repair the deployment's identity/data binding or the test user's membership, then rerun the canonical protected route.",
      ].join(" "),
    );
  }

  throw new Error(
    [
      "Browser verification could not authenticate the protected route.",
      `Target: ${targetUrl}`,
      `Final URL: ${openedUrl}`,
      `Landing state: ${initialLanding.kind}${initialLanding.reason ? ` (${initialLanding.reason})` : ""}`,
      "Cause: the authenticated preflight returned an invalid protected-route landing.",
      "Detection gap: an earlier evidence runner reimplemented auth refresh and could diverge from the canonical preflight.",
      "Prevention: every browser E2E run now delegates authentication to verify:browser-auth before it captures evidence.",
    ].join(" "),
  );
}

function summarize(actionsOutput, metadata) {
  const failedActions = actionsOutput.filter((entry) => entry.exitCode !== 0);
  const browserErrors = metadata.browserErrors ?? [];
  const lines = [];

  lines.push(`# Agent Browser Verification - ${metadata.runName}`);
  lines.push("");
  lines.push(`- Run ID: \`${metadata.runId}\``);
  lines.push(`- Status: **${failedActions.length === 0 && browserErrors.length === 0 ? "PASS" : "FAIL"}**`);
  lines.push(`- URL: \`${metadata.url}\``);
  lines.push(`- Session: \`${metadata.session}\``);
  lines.push(`- Started: \`${metadata.startedAt}\``);
  lines.push(`- Finished: \`${metadata.finishedAt}\``);
  lines.push(`- Actions executed: \`${actionsOutput.length}\``);
  lines.push(`- Action failures: \`${failedActions.length}\``);
  lines.push(`- Browser errors: \`${browserErrors.length}\``);
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

  if (browserErrors.length > 0) {
    lines.push("## Browser Errors");
    lines.push("");
    for (const error of browserErrors.slice(0, 10)) {
      lines.push(`- ${error}`);
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
  if (options.help) {
    console.log(usage());
    return;
  }

  const { baseUrl, targetUrl, route } = resolveTarget(options);
  ensureDir(RUNS_ROOT);

  if (!options.skipCleanup) {
    execute("node", [
      CLEANUP_SCRIPT_PATH,
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
  let browserErrors = [];
  let failed = false;

  try {
    prepareAuthenticatedBrowser(baseUrl, route, options.session);
    assertAuthenticatedLanding(options.session, targetUrl);

    const initialSnapshot = runAgentBrowser(options.session, ["snapshot", "-i"], {
      capture: true,
    });
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

    const consoleOutput = runAgentBrowser(options.session, ["console"], {
      capture: true,
      allowFailure: true,
    });
    writeFile(consoleLogPath, (consoleOutput.stdout || "").toString());

    const errorsOutput = runAgentBrowser(options.session, ["errors"], {
      capture: true,
      allowFailure: true,
    });
    writeFile(errorsLogPath, (errorsOutput.stdout || "").toString());

    browserErrors = extractBrowserErrors(
      (consoleOutput.stdout || "").toString(),
      (errorsOutput.stdout || "").toString(),
    );
    if (browserErrors.length > 0) {
      failed = true;
    }

    const finalSnapshot = runAgentBrowser(options.session, ["snapshot", "-i"], {
      capture: true,
      allowFailure: true,
    });
    writeFile(finalSnapshotPath, (finalSnapshot.stdout || "").toString());

    runAgentBrowser(options.session, ["screenshot", "--full", finalShotPath], {
      allowFailure: true,
    });
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
    url: targetUrl,
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
    browserErrors,
  });

  const summaryPath = path.join(runDir, "VERIFICATION_SUMMARY.md");
  writeFile(summaryPath, summary);

  console.log(`[agent-browser-verify] summary=${path.relative(CWD, summaryPath)}`);
  console.log(`[agent-browser-verify] run_dir=${path.relative(CWD, runDir)}`);

  if (failed) {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
