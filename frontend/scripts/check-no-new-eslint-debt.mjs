#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const isStaged = args.includes("--staged");
const baseFlagIndex = args.indexOf("--base");
const baseFromFlag = baseFlagIndex >= 0 ? args[baseFlagIndex + 1] : undefined;
const baseRef = baseFromFlag || process.env.GUARDRAIL_BASE_REF || "origin/main";

// Derive paths from this script's location so the script can be invoked from
// any cwd (lint-staged 16 invokes from repo root). The script lives at
// frontend/scripts/check-no-new-eslint-debt.mjs.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const isWindows = process.platform === "win32";

const scanPrefixes = ["src/", "tests/", "scripts/"];
const scanExt = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function run(command) {
  try {
    return execSync(command, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trimEnd();
  } catch {
    return "";
  }
}

function splitChangedOutput(output) {
  return output
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

export function normalizeFrontendChangedFiles(files) {
  return [...new Set(files)]
    .filter((f) => f.startsWith("frontend/"))
    .map((f) => f.slice("frontend/".length))
    .filter((f) => scanPrefixes.some((prefix) => f.startsWith(prefix)))
    .filter((f) => scanExt.test(f))
    .sort();
}

function getChangedFiles() {
  const commands = isStaged
    ? ["git diff --cached --name-only --diff-filter=ACMR"]
    : [
        `git diff --name-only ${baseRef}...HEAD --diff-filter=ACMR`,
        "git diff --cached --name-only --diff-filter=ACMR",
        "git diff --name-only --diff-filter=ACMR",
      ];

  const changedFiles = commands.flatMap((command) => splitChangedOutput(run(command)));

  return normalizeFrontendChangedFiles(changedFiles);
}

function parseAddedLineMap(relativePath) {
  const repoPath = `frontend/${relativePath}`;
  const commands = isStaged
    ? [`git diff --cached --unified=0 -- ${repoPath}`]
    : [
        `git diff --unified=0 ${baseRef}...HEAD -- ${repoPath}`,
        `git diff --cached --unified=0 -- ${repoPath}`,
        `git diff --unified=0 -- ${repoPath}`,
      ];

  const added = new Set();
  for (const diffCmd of commands) {
    const diff = run(diffCmd);
    if (!diff) continue;

    let currentNewLine = null;

    for (const line of diff.split("\n")) {
      if (line.startsWith("@@")) {
        const match = line.match(/\+(\d+)(?:,(\d+))?/);
        currentNewLine = match ? Number.parseInt(match[1], 10) : null;
        continue;
      }

      if (currentNewLine === null) continue;
      if (line.startsWith("+") && !line.startsWith("+++")) {
        added.add(currentNewLine);
        currentNewLine += 1;
        continue;
      }

      if (line.startsWith("-") && !line.startsWith("---")) {
        continue;
      }

      currentNewLine += 1;
    }
  }

  return added.size > 0 ? added : null;
}

function main() {
  const files = getChangedFiles();

  if (files.length === 0) {
    console.log("No changed frontend code files to lint for new debt.");
    process.exit(0);
  }

  const addedLineMap = new Map();
  for (const file of files) {
    const lineSet = parseAddedLineMap(file);
    if (lineSet && lineSet.size > 0) {
      addedLineMap.set(file, lineSet);
    }
  }

  if (addedLineMap.size === 0) {
    console.log("No added lines in changed frontend files; no new ESLint debt to evaluate.");
    process.exit(0);
  }

  const eslintBin = isWindows
    ? path.join(frontendRoot, "node_modules", ".bin", "eslint.cmd")
    : path.join(frontendRoot, "node_modules", ".bin", "eslint");

  let eslintOutput = "[]";
  try {
    eslintOutput = execFileSync(
      eslintBin,
      [
        "--format",
        "json",
        "--no-warn-ignored",
        "--cache",
        "--cache-strategy",
        "content",
        ...Array.from(addedLineMap.keys()),
      ],
      {
        cwd: frontendRoot,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
  } catch (error) {
    if (error?.stdout) {
      eslintOutput = String(error.stdout);
    } else {
      console.error("Failed to run ESLint for changed-file debt ratchet.");
      console.error(String(error));
      process.exit(1);
    }
  }

  let results = [];
  try {
    results = JSON.parse(eslintOutput || "[]");
  } catch (error) {
    console.error("Unable to parse ESLint JSON output.");
    console.error(String(error));
    process.exit(1);
  }

  const violations = [];
  for (const result of results) {
    const absFile = result.filePath || "";
    const rel = path.relative(frontendRoot, absFile).replaceAll("\\", "/");
    const addedLines = addedLineMap.get(rel);
    if (!addedLines) continue;

    for (const message of result.messages || []) {
      const line = Number(message.line || 0);
      const touchesAddedLine = line === 0 || addedLines.has(line);
      if (!touchesAddedLine) continue;

      violations.push({
        file: rel,
        line,
        severity: message.severity === 2 ? "error" : "warning",
        ruleId: message.ruleId || "unknown",
        message: message.message,
      });
    }
  }

  if (violations.length === 0) {
    console.log(
      `No new ESLint debt detected across ${addedLineMap.size} changed frontend file(s).`,
    );
    process.exit(0);
  }

  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;

  console.error(
    `New ESLint debt detected: ${violations.length} total (${errorCount} errors, ${warningCount} warnings).`,
  );
  for (const violation of violations.slice(0, 100)) {
    console.error(
      `- ${violation.file}:${violation.line || 1} [${violation.severity}] ${violation.ruleId} ${violation.message}`,
    );
  }
  if (violations.length > 100) {
    console.error(`...and ${violations.length - 100} more violation(s).`);
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
