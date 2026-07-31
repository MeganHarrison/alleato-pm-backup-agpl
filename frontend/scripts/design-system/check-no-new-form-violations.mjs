#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const baseRefArg = process.argv[2];
const sourcePathSpec = fs.existsSync(path.join(repoRoot, "src")) ? "src" : "frontend/src";
const ENFORCED_RULES = new Set([
  "design-system/no-raw-form-controls",
  "design-system/require-approved-form-components",
  "design-system/require-money-field",
]);

function run(command) {
  return execSync(command, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runOptional(command) {
  try {
    return run(command);
  } catch {
    return "";
  }
}

function getBaseRef() {
  if (baseRefArg) return baseRefArg;

  const defaultBranch =
    runOptional("git symbolic-ref refs/remotes/origin/HEAD")
      .replace("refs/remotes/origin/", "")
      .trim() || "main";

  const mergeBase = runOptional(`git merge-base HEAD origin/${defaultBranch}`);
  if (mergeBase) return mergeBase;

  return runOptional("git rev-parse --verify HEAD~1");
}

function parseChangedFiles(baseRef) {
  const fromBranch = runOptional(`git diff --name-only ${baseRef}...HEAD -- ${sourcePathSpec}`);
  const fromWorkingTree = runOptional(`git diff --name-only -- ${sourcePathSpec}`);
  const fromStaged = runOptional(`git diff --cached --name-only -- ${sourcePathSpec}`);

  return Array.from(
    new Set(
      [fromBranch, fromWorkingTree, fromStaged]
        .filter(Boolean)
        .flatMap((chunk) => chunk.split("\n"))
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => /\.(tsx?|jsx?)$/.test(line)),
    ),
  );
}

function runEslint(files) {
  if (!files.length) return [];
  const args = [
    "eslint",
    "--format",
    "json",
    "--rule",
    "design-system/no-raw-form-controls:error",
    "--rule",
    "design-system/require-approved-form-components:error",
    "--rule",
    "design-system/require-money-field:error",
    ...files,
  ];
  const result = spawnSync("npx", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });

  if (result.error) throw result.error;

  const output = result.stdout?.trim() || "[]";
  const parsed = JSON.parse(output);
  const violations = [];

  for (const fileResult of parsed) {
    for (const message of fileResult.messages ?? []) {
      if (!ENFORCED_RULES.has(message.ruleId ?? "")) continue;
      violations.push({
        file: fileResult.filePath,
        line: message.line ?? 1,
        column: message.column ?? 1,
        ruleId: message.ruleId,
        message: message.message,
      });
    }
  }

  return violations;
}

function main() {
  const baseRef = getBaseRef();
  if (!baseRef) {
    console.log("No base ref found (likely first commit); skipping changed-files form gate.");
    return;
  }

  const changedFiles = parseChangedFiles(baseRef);
  if (!changedFiles.length) {
    console.log("No changed TS/JS source files detected for form gate.");
    return;
  }

  const violations = runEslint(changedFiles);
  if (!violations.length) {
    console.log("No new form-control design-system violations detected in changed files.");
    return;
  }

  console.error(
    `Found ${violations.length} changed-file form-control violation(s) against enforced rules.`,
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line}:${violation.column} [${violation.ruleId}] ${violation.message}`,
    );
  }
  process.exit(1);
}

main();
