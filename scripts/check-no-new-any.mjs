#!/usr/bin/env node

import { execSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const baseRefFromFlagIndex = process.argv.indexOf("--base");
const baseRefFromFlag =
  baseRefFromFlagIndex >= 0 ? process.argv[baseRefFromFlagIndex + 1] : undefined;

const mode = args.has("--staged") ? "staged" : "changed";
const baseRef = baseRefFromFlag || process.env.GUARDRAIL_BASE_REF || "origin/main";

const scanPathPrefixes = ["frontend/src/", "backend/src/"];
const codeExtensions = /\.(ts|tsx|js|jsx)$/;

const typeAnyMatchers = [
  /:\s*any\b/,
  /<\s*any\s*>/,
  /\bas any\b/,
  /\bArray<\s*any\s*>/,
  /\bReadonlyArray<\s*any\s*>/,
  /\bRecord<[^>]*,\s*any\s*>/,
  /\bPromise<\s*any\s*>/,
  /\bany\[\]/,
];

// Execute a shell command and return stdout; tolerate command failures as empty output.
function run(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trimEnd();
  } catch {
    return "";
  }
}

// Escape user-visible pattern fragments so diagnostics remain readable.
function escapePath(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Restrict scanning to source files where explicit any debt matters.
function shouldScanPath(path) {
  return scanPathPrefixes.some((prefix) => path.startsWith(prefix)) && codeExtensions.test(path);
}

// Collect changed files from either staged diff or base-ref comparison.
function getCandidateFiles() {
  const commands =
    mode === "staged"
      ? ["git diff --cached --name-only --diff-filter=ACMR"]
      : [
          `git diff --name-only ${baseRef}...HEAD --diff-filter=ACMR`,
          "git diff --cached --name-only --diff-filter=ACMR",
          "git diff --name-only --diff-filter=ACMR",
        ];

  const files = commands.flatMap((cmd) =>
    run(cmd)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

  return [...new Set(files)].filter(shouldScanPath).sort();
}

// Return added diff lines only so existing debt outside changed lines is ignored.
function getAddedLinesForFile(path) {
  const added = [];
  const commands =
    mode === "staged"
      ? [`git diff --cached --unified=0 -- "${path}"`]
      : [
          `git diff --unified=0 ${baseRef}...HEAD -- "${path}"`,
          `git diff --cached --unified=0 -- "${path}"`,
          `git diff --unified=0 -- "${path}"`,
        ];

  for (const diffCmd of commands) {
    const diffText = run(diffCmd);
    if (!diffText) continue;

    for (const rawLine of diffText.split("\n")) {
      if (!rawLine.startsWith("+")) continue;
      if (rawLine.startsWith("+++")) continue;
      added.push(rawLine.slice(1));
    }
  }

  return added;
}

// Detect type-level explicit any usage patterns on newly added lines.
function hasNewAnyType(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("*")) return false;

  return typeAnyMatchers.some((matcher) => matcher.test(line));
}

// Run the guardrail and fail when new explicit any debt appears.
function main() {
  const files = getCandidateFiles();
  if (files.length === 0) {
    console.log(`No ${mode} code files to scan for new 'any' usage.`);
    process.exit(0);
  }

  const violations = [];
  for (const file of files) {
    const addedLines = getAddedLinesForFile(file);
    if (addedLines.length === 0) continue;

    const anyLines = addedLines.filter(hasNewAnyType);
    if (anyLines.length === 0) continue;

    const preview = anyLines.slice(0, 5).map((line) => line.trim());
    violations.push({ file, count: anyLines.length, preview });
  }

  if (violations.length === 0) {
    console.log(`No new 'any' type debt detected in ${mode} changes.`);
    process.exit(0);
  }

  console.error("New explicit 'any' type debt detected:");
  for (const violation of violations) {
    console.error(`- ${violation.file} (${violation.count})`);
    for (const line of violation.preview) {
      console.error(`    + ${line}`);
    }
  }
  console.error(
    `Fix by replacing 'any' with explicit types. To scan a specific file: rg -n "${escapePath(": any| as any|<any>|any[]")}" <file>`,
  );
  process.exit(1);
}

main();
