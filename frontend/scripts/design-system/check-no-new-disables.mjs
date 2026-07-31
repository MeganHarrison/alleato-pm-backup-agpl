#!/usr/bin/env node

import { execSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const baseRefArg = process.argv[2];
const sourcePathSpec = fs.existsSync(path.join(repoRoot, "src")) ? "src" : "frontend/src";

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

  // Prefer current branch merge-base with default branch for local/PR parity.
  const defaultBranch = runOptional("git symbolic-ref refs/remotes/origin/HEAD")
    .replace("refs/remotes/origin/", "")
    .trim() || "main";

  const mergeBase = runOptional(`git merge-base HEAD origin/${defaultBranch}`);
  if (mergeBase) return mergeBase;

  try {
    return run("git rev-parse --verify HEAD~1");
  } catch {
    return "";
  }
}

function main() {
  const baseRef = getBaseRef();
  if (!baseRef) {
    console.log("No base ref found (likely first commit); skipping new-disable check.");
    return;
  }

  let diff = "";
  diff = runOptional(`git diff --unified=0 ${baseRef}...HEAD -- ${sourcePathSpec}`);

  // If branch diff is empty (e.g. local uncommitted work), scan working tree + staged changes.
  if (!diff) {
    const workingTreeDiff = runOptional(`git diff --unified=0 -- ${sourcePathSpec}`);
    const stagedDiff = runOptional(`git diff --cached --unified=0 -- ${sourcePathSpec}`);
    diff = [workingTreeDiff, stagedDiff].filter(Boolean).join("\n");
  }

  if (!diff) {
    console.log(`No ${sourcePathSpec} changes detected.`);
    return;
  }

  const addedLines = diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"));

  // Rules that permit disable comments — these are legitimate documented exceptions,
  // not new debt. Add a rule here only after verifying all real violations are fixed
  // and the rule is escalated to 'error' globally.
  const ALLOWED_DISABLE_RULES = new Set([
    "design-system/no-raw-heading", // escalated to error 2026-04-20; exceptions are annotated
  ]);

  const violations = addedLines.filter((line) => {
    if (!/eslint-disable(?:-next-line|-line)?[^\n]*design-system\//.test(line)) return false;
    // Allow disables for rules in the exception list
    for (const rule of ALLOWED_DISABLE_RULES) {
      if (line.includes(rule)) return false;
    }
    return true;
  });

  if (violations.length > 0) {
    console.error("New design-system eslint-disable comments are not allowed:");
    for (const line of violations) {
      console.error(`  ${line}`);
    }
    process.exit(1);
  }

  console.log("No new design-system eslint-disable comments detected.");
}

main();
