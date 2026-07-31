#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  implementationFilesWithoutTask,
  taskFilesFromStagedFiles,
} from "./verification-closeout-policy.mjs";

const rawArgs = process.argv.slice(2);

const options = {
  message: "",
  files: [],
  allDirty: false,
  stagedOnly: false,
  checkOnly: false,
  noPush: false,
  noVerify: false,
  verificationManifest: "",
  verificationResult: "",
  allowStaged: false,
  session: "",
  deliveryLane: "",
};

function usage() {
  console.log(`Usage:
  npm run codex:finish -- --message "Commit message" --files path/to/file path/to/other
  npm run codex:finish -- --message "Commit message" --all-dirty
  npm run codex:finish -- --check

Options:
  -m, --message <text>   Commit message. Required unless --check is used.
  --files <paths...>     Stage only these task-owned files.
  --all-dirty            Stage every dirty file. Use only when the current task owns the whole diff.
  --staged-only          Commit the files already staged by the caller.
  --check                Report branch, sync, and dirty state without committing.
  --no-push              Commit locally but do not push.
  --no-verify            Skip targeted pre-commit checks.
  --verification-manifest <path>  Manifest used to validate user-flow evidence.
  --verification-result <path>    Result JSON produced by the independent verifier.
  --allow-staged         Allow pre-existing staged files to be included.
  --session <id>         Lease released only after remote publication succeeds.`);
}

function abort({ cause, detection, prevention, exitCode = 1 }) {
  console.error("codex:finish blocked");
  console.error(`Cause: ${cause}`);
  console.error(`Detection gap: ${detection}`);
  console.error(`Prevention step: ${prevention}`);
  process.exit(exitCode);
}

function parseArgs() {
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "-m" || arg === "--message") {
      options.message = rawArgs[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--message=")) {
      options.message = arg.slice("--message=".length);
      continue;
    }

    if (arg === "--files") {
      while (rawArgs[index + 1] && !rawArgs[index + 1].startsWith("--")) {
        options.files.push(rawArgs[index + 1]);
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("--files=")) {
      options.files.push(
        ...arg
          .slice("--files=".length)
          .split(",")
          .map((file) => file.trim())
          .filter(Boolean)
      );
      continue;
    }

    if (arg === "--all-dirty") {
      options.allDirty = true;
      continue;
    }

    if (arg === "--staged-only") {
      options.stagedOnly = true;
      continue;
    }

    if (arg === "--check" || arg === "--check-only") {
      options.checkOnly = true;
      continue;
    }

    if (arg === "--no-push") {
      options.noPush = true;
      continue;
    }

    if (arg === "--no-verify") {
      options.noVerify = true;
      continue;
    }

    if (arg === "--verification-manifest") {
      options.verificationManifest = rawArgs[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--verification-manifest=")) {
      options.verificationManifest = arg.slice("--verification-manifest=".length);
      continue;
    }

    if (arg === "--verification-result") {
      options.verificationResult = rawArgs[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--verification-result=")) {
      options.verificationResult = arg.slice("--verification-result=".length);
      continue;
    }

    if (arg === "--allow-staged") {
      options.allowStaged = true;
      continue;
    }

    if (arg === "--session") {
      options.session = rawArgs[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--delivery-lane") {
      options.deliveryLane = rawArgs[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--delivery-lane=")) {
      options.deliveryLane = arg.slice("--delivery-lane=".length);
      continue;
    }

    if (arg.startsWith("--session=")) {
      options.session = arg.slice("--session=".length);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    abort({
      cause: `Unknown argument: ${arg}`,
      detection: "The finish command only accepts explicit options.",
      prevention: "Run npm run codex:finish -- --help and pass task-owned files explicitly.",
      exitCode: 2,
    });
  }

  if (options.files.length > 0 && options.allDirty) {
    abort({
      cause: "--files and --all-dirty were both provided.",
      detection: "The command cannot tell whether the intended scope is narrow or the whole checkout.",
      prevention: "Use --files for focused task completion, or --all-dirty only when the task owns every dirty file.",
      exitCode: 2,
    });
  }

  if (options.stagedOnly && (options.files.length > 0 || options.allDirty)) {
    abort({
      cause: "--staged-only cannot be combined with --files or --all-dirty.",
      detection: "The command cannot safely mix caller-managed staging with automatic staging.",
      prevention: "Use --staged-only after manually staging exact hunks, or let codex:finish stage whole files with --files.",
      exitCode: 2,
    });
  }

  if (Boolean(options.verificationManifest) !== Boolean(options.verificationResult)) {
    abort({
      cause: "Verification manifest and result must be provided together.",
      detection: "A one-sided verification argument cannot prove that the result belongs to the declared acceptance contract.",
      prevention: "Pass both --verification-manifest <path> and --verification-result <path>, or omit both for non-user-facing work.",
      exitCode: 2,
    });
  }

  if (!options.checkOnly && !options.message.trim()) {
    abort({
      cause: "Missing commit message.",
      detection: "A publishable finish needs a clear commit boundary.",
      prevention: 'Pass --message "Short imperative commit message", or use --check for a dry state report.',
      exitCode: 2,
    });
  }

  if (!options.checkOnly && !options.noPush && !options.session.trim()) {
    abort({
      cause: "Missing --session for a normal publish.",
      detection: "A successful publish without its lease release leaves stale ownership behind.",
      prevention: "Pass --session <active-session>. Use --no-push only for an explicit local checkpoint.",
      exitCode: 2,
    });
  }

  if (options.deliveryLane && !["fast", "standard", "high"].includes(options.deliveryLane)) {
    abort({
      cause: `Unknown delivery lane: ${options.deliveryLane}.`,
      detection: "Closeout accepts only fast, standard, or high delivery lanes.",
      prevention: "Use --delivery-lane fast only for eligible micro-changes, or declare the lane in the task file.",
      exitCode: 2,
    });
  }
}

function run(command, args, { capture = false, cwd = repoRoot, env = {} } = {}) {
  const executable = process.platform === "win32" && command === "npm"
    ? process.env.ComSpec || "cmd.exe"
    : command;
  const executableArgs = process.platform === "win32" && command === "npm"
    ? ["/d", "/s", "/c", "npm", ...args]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = capture && result.stderr ? `\n${result.stderr.trim()}` : "";
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}${stderr}`);
  }

  return capture ? result.stdout.trim() : "";
}

function getRepoRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    abort({
      cause: "Current directory is not inside a Git repository.",
      detection: "git rev-parse --show-toplevel failed.",
      prevention: "Run this from the alleato-pm checkout before trying to publish.",
      exitCode: 2,
    });
  }

  return result.stdout.trim();
}

function listOutput(command, args) {
  const output = run(command, args, { capture: true });
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function printState() {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { capture: true });
  const status = run("git", ["status", "--short", "--branch"], { capture: true });

  run("git", ["fetch", "origin", "main"]);
  const counts = run("git", ["rev-list", "--left-right", "--count", "origin/main...HEAD"], {
    capture: true,
  });
  const [behind = "0", ahead = "0"] = counts.split(/\s+/);

  console.log(`Branch: ${branch}`);
  console.log(`Sync: ${behind} behind, ${ahead} ahead of origin/main`);
  console.log(status || "Working tree clean");
}

function ensureMainBranch() {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { capture: true });
  if (branch === "main") return;

  const commonGitDir = run("git", ["rev-parse", "--git-common-dir"], { capture: true });
  const registryPath = path.join(commonGitDir, "codex-isolated-workspaces.json");
  const currentRoot = fs.realpathSync(repoRoot);
  const registeredWorkspace = fs.existsSync(registryPath) && (() => {
    try {
      const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
      return registry.workspaces?.some((workspace) => {
        if (workspace.status !== "active" || !workspace.worktree) return false;
        try {
          return fs.realpathSync(workspace.worktree) === currentRoot && workspace.branch === branch;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  })();

  if (!registeredWorkspace) {
    abort({
      cause: `Current branch is ${branch}, not main or a registered isolated workspace.`,
      detection: "codex:finish checks the active branch before staging or committing.",
      prevention: "Use main for a single writer, or create a registered isolated workspace for concurrent work.",
    });
  }
}

function ensureNoUnexpectedStagedFiles() {
  const staged = listOutput("git", ["diff", "--cached", "--name-only"]);
  if (options.stagedOnly) {
    if (staged.length === 0) {
      abort({
        cause: "--staged-only was provided but no files are staged.",
        detection: "The command relies on the caller-managed index for hunk-level publish safety.",
        prevention: "Stage the exact intended hunks first, then rerun codex:finish with --staged-only.",
        exitCode: 2,
      });
    }
    return;
  }

  if (staged.length > 0 && !options.allowStaged) {
    abort({
      cause: `There are already staged files: ${staged.join(", ")}`,
      detection: "Pre-existing staged files could be unrelated to the current completed task.",
      prevention: "Unstage or commit them separately, or pass --allow-staged when they are intentionally part of this task.",
    });
  }
}

function pathFromPorcelain(line) {
  const raw = String(line);
  // `run()` trims aggregate command output, which can remove the leading
  // status space from the first porcelain record.
  const value = raw.slice(raw[1] === " " ? 2 : 3).trim();
  const renamed = value.includes(" -> ") ? value.split(" -> ").at(-1) : value;
  return renamed.replace(/^"|"$/g, "");
}

function selectedScopeOwnsPath(selectedPath, candidate) {
  const normalized = selectedPath.replace(/\/$/, "");
  return candidate === normalized || candidate.startsWith(`${normalized}/`);
}

function ensureNoUnfinishedWorkOutsideSelectedScope() {
  if (options.allDirty) return;

  if (options.stagedOnly) {
    const unstaged = listOutput("git", ["diff", "--name-only"]);
    const untracked = listOutput("git", ["ls-files", "--others", "--exclude-standard"]);
    if (unstaged.length || untracked.length) {
      abort({
        cause: `--staged-only would leave unfinished work in the checkout: ${[...unstaged, ...untracked].join(", ")}`,
        detection: "codex:finish checks for unstaged and untracked paths before a staged-only publish.",
        prevention: "Finish every dirty path in this task, or use a registered isolated workspace for a separate task. Do not use staged-only to park work.",
      });
    }
    return;
  }

  const dirtyPaths = listOutput("git", ["status", "--porcelain"])
    .map(pathFromPorcelain)
    .filter(Boolean);
  const outsideScope = dirtyPaths.filter((candidate) => !options.files.some((selected) => selectedScopeOwnsPath(selected, candidate)));
  if (outsideScope.length) {
    abort({
      cause: `Selected files would leave unrelated dirty work behind: ${outsideScope.join(", ")}`,
      detection: "codex:finish compares every dirty path with the requested task-owned file scope before staging.",
      prevention: "Publish or explicitly hand off the existing scope first. Start a new task only from a clean checkout.",
    });
  }
}

function stageRequestedFiles() {
  if (options.stagedOnly) {
    return;
  }

  if (options.files.length > 0) {
    run("git", ["add", "--", ...options.files]);
    return;
  }

  if (options.allDirty) {
    run("git", ["add", "-A"]);
    return;
  }

  abort({
    cause: "No files were selected for staging.",
    detection: "The command refuses to infer task scope from a dirty checkout.",
    prevention: "Pass --files with the exact task-owned paths. Use --all-dirty only when this task owns every dirty file.",
    exitCode: 2,
  });
}

function enforceTaskVerificationMetadata(stagedFiles) {
  const taskFiles = taskFilesFromStagedFiles(stagedFiles);
  const handoffFiles = stagedFiles.filter((file) => /^docs\/ops\/handoffs\/[^/]+\.md$/.test(file));
  const referencedTaskFiles = handoffFiles.flatMap((handoffFile) => {
    const text = requireTaskFile(handoffFile);
    return [...text.matchAll(/(?:^|\s|`)(docs\/ops\/tasks\/[^\s`|,)]+\.md)/g)].map((match) => match[1]);
  });
  for (const referencedTaskFile of new Set(referencedTaskFiles)) {
    if (!taskFiles.includes(referencedTaskFile)) {
      abort({
        cause: `${referencedTaskFile} is referenced by a staged handoff but is not staged.`,
        detection: "A handoff without its task definition could bypass task-level verification metadata at closeout.",
        prevention: "Include the referenced task file in --files, then rerun codex:finish.",
      });
    }
  }
  const implementationFiles = implementationFilesWithoutTask(stagedFiles, taskFiles);
  const fastIneligible = stagedFiles.filter((file) =>
    file.startsWith("supabase/migrations/") || file.startsWith(".github/") ||
    ["package.json", "render.yaml", "vercel.json"].includes(file)
  );
  if (options.deliveryLane === "fast" && fastIneligible.length > 0) {
    abort({
      cause: `Fast lane cannot publish high-risk paths: ${fastIneligible.join(", ")}`,
      detection: "Migrations and deployment/configuration files need a task-scoped risk decision.",
      prevention: "Use a Standard or High-risk task and declare its delivery lane.",
    });
  }
  if (implementationFiles.length > 0 && taskFiles.length === 0 && options.deliveryLane !== "fast") {
    abort({
      cause: `Implementation files are staged without a task definition: ${implementationFiles.join(", ")}`,
      detection: "Implementation changes require task-level verification metadata at closeout.",
      prevention: "Create a task from docs/ops/tasks/TASK-TEMPLATE.md, declare the verification contract, and include it in --files.",
    });
  }
  let required = options.deliveryLane === "high";
  let taskId = "";
  for (const taskFile of taskFiles) {
    const contents = requireTaskFile(taskFile);
    const taskIdMatch = contents.match(/^Task ID:\s*(.+?)\s*$/im);
    if (taskIdMatch) {
      if (taskId && taskId !== taskIdMatch[1].trim()) {
        abort({
          cause: `Multiple staged tasks have conflicting Task IDs: ${taskId} and ${taskIdMatch[1].trim()}.`,
          detection: "A verification result cannot be safely bound to multiple task identities.",
          prevention: "Publish one task boundary at a time or stage exact hunks with a single task file.",
        });
      }
      taskId = taskIdMatch[1].trim();
    }
    const laneMatch = contents.match(/^Delivery lane:\s*(Fast|Standard|High-risk)\s*$/im);
    const match = contents.match(/^Verification contract:\s*(Required|Optional|Not applicable)\s*$/im);
    if (!match) {
      console.warn(`Verification contract metadata missing in ${taskFile}; legacy task allowed during rollout.`);
      continue;
    }
    const lane = laneMatch?.[1]?.toLowerCase();
    const isHighRisk = lane === "high-risk" || match?.[1].toLowerCase() === "required";
    if (isHighRisk && (!options.verificationManifest || !options.verificationResult)) {
      abort({
        cause: `${taskFile} declares Verification contract: Required, but no manifest/result pair was provided.`,
        detection: "The staged task metadata identifies observable work that must have independently validated evidence.",
        prevention: "Pass --verification-manifest <path> and --verification-result <path> to codex:finish after the verifier completes.",
      });
    }
    if (isHighRisk) required = true;
  }
  if (required && !taskId) {
    abort({
      cause: "Required verification task is missing a Task ID.",
      detection: "Task identity is required to bind the manifest and result to the task being published.",
      prevention: "Add the Linear issue or explicit task ID to the task file, then rerun closeout.",
    });
  }
  return { required, taskId };
}

function requireTaskFile(taskFile) {
  const result = spawnSync("git", ["show", `:${taskFile}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`Unable to read staged task file ${taskFile}: ${result.stderr?.trim() || "git show failed"}`);
  }
  return result.stdout;
}

function hasAnyPrefix(files, prefixes) {
  return files.some((file) => prefixes.some((prefix) => file.startsWith(prefix)));
}

function runTargetedChecks(stagedFiles) {
  if (options.noVerify) {
    console.log("Skipping targeted checks because --no-verify was provided.");
    return;
  }

  run("git", ["diff", "--cached", "--check"]);
  run("node", ["scripts/ops/learning-registry.mjs", "audit", "--staged"]);

  const scriptFiles = stagedFiles.filter(
    (file) => file.startsWith("scripts/") && /\.(cjs|js|mjs)$/.test(file)
  );
  for (const file of scriptFiles) {
    run("node", ["--check", file]);
  }

  const appRouteTouched = stagedFiles.some(
    (file) => file.startsWith("frontend/src/app/") && file.includes("[")
  );
  if (appRouteTouched) {
    run("npm", ["run", "check:routes"]);
  }

  const frontendCodeTouched = stagedFiles.some(
    (file) => file.startsWith("frontend/") && /\.(ts|tsx|js|jsx)$/.test(file)
  );
  if (frontendCodeTouched) {
    run("npm", ["--prefix", "frontend", "run", "quality:changed"]);
  }

  const migrationFiles = stagedFiles.filter((file) =>
    /^supabase\/migrations\/\d{14}_.+\.sql$/.test(file)
  );
  for (const file of migrationFiles) {
    run("npm", ["run", "db:migrations:verify-applied", "--", file]);
  }

  if (
    !hasAnyPrefix(stagedFiles, ["frontend/", "backend/", "scripts/", "supabase/migrations/"])
  ) {
    console.log("No code-specific targeted checks were required for the staged file set.");
  }
}

function runVerificationContract({ policy = { required: false, taskId: "" } } = {}) {
  if (!options.verificationManifest && !options.verificationResult) return;

  console.log("Running verification contract before commit...");
  const args = [
    "scripts/verification/verification-contract.mjs",
    "--manifest",
    options.verificationManifest,
    "--result",
    options.verificationResult,
    "--root",
    repoRoot,
  ];
  if (policy.required) args.push("--require-pass");
  if (policy.taskId) args.push("--task-id", policy.taskId);
  run("node", args);
}

function commitAndPush(stagedFiles) {
  run("git", ["commit", "-m", options.message.trim()], {
    env: { CODEX_TARGETED_ROUTE_CHECKS_COMPLETE: "1" },
  });

  if (options.noPush) {
    console.log("Committed locally. Push skipped because --no-push was provided.");
    return;
  }

  run("node", [
    "scripts/ops/remote-main-publish.mjs",
    "--message", options.message.trim(),
    "--source", "HEAD",
    "--files",
    ...stagedFiles,
  ]);
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { capture: true });
  if (branch === "main") {
    run("node", ["scripts/ops/checkout-session-gate.mjs", "release", "--session", options.session.trim()]);
  } else {
    run("node", ["scripts/ops/isolated-session-workspace.mjs", "publish", "--session", options.session.trim(), "--worktree", repoRoot]);
  }
  console.log(`Published ${stagedFiles.length} exact file(s) through the remote main publisher without rebasing or stashing the shared checkout.`);
}

parseArgs();
const repoRoot = getRepoRoot();
process.chdir(repoRoot);

try {
  ensureMainBranch();

  if (options.checkOnly) {
    printState();
    process.exit(0);
  }

  ensureNoUnexpectedStagedFiles();
  ensureNoUnfinishedWorkOutsideSelectedScope();
  stageRequestedFiles();

  const stagedFiles = listOutput("git", ["diff", "--cached", "--name-only"]);
  if (stagedFiles.length === 0) {
    console.log("No staged changes after applying the requested scope.");
    if (!options.noPush) {
      run("git", ["push", "origin", "main"]);
    }
    process.exit(0);
  }

  console.log("Staged files:");
  for (const file of stagedFiles) {
    console.log(`- ${file}`);
  }

  const verificationPolicy = enforceTaskVerificationMetadata(stagedFiles);
  runVerificationContract({ policy: verificationPolicy });
  runTargetedChecks(stagedFiles);
  commitAndPush(stagedFiles);
} catch (error) {
  abort({
    cause: error instanceof Error ? error.message : String(error),
    detection: "A required Git or verification command returned a non-zero exit code.",
    prevention: "Fix the listed command failure, then rerun codex:finish with the same explicit file scope.",
  });
}
