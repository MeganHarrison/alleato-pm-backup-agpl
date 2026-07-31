#!/usr/bin/env node
/**
 * Guardrail: block committing broken symlinks.
 *
 * Two symlink classes have repeatedly broken CI (the Claude Code Action's
 * skill scanner crashes with `ENOENT statx` on dangling targets — see
 * commits b55b47d, 4ab1023, 08c7c90):
 *
 *   1. Dangling links — the target does not exist in the repo tree.
 *   2. Absolute-path links (e.g. /Users/<name>/...) — resolve on the
 *      author's machine but break on every other machine, including CI.
 *
 * This runs over staged symlinks (pre-commit). Pass --all to scan every
 * tracked symlink (used by CI as a full backstop).
 */
import { execSync } from "node:child_process";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { isAbsolute, resolve, dirname } from "node:path";

const scanAll = process.argv.includes("--all");
const GIT_BUFFER = 256 * 1024 * 1024; // tree listings can be multiple MB

function trackedSymlinks() {
  // `git ls-files -s` emits mode 120000 for symlinks. Field 4 is the path.
  const out = execSync("git ls-files -s", {
    encoding: "utf8",
    maxBuffer: GIT_BUFFER,
  });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((line) => line.startsWith("120000"))
    .map((line) => line.split("\t")[1]);
}

function stagedSymlinks() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
    maxBuffer: GIT_BUFFER,
  });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((p) => {
      try {
        return lstatSync(p).isSymbolicLink();
      } catch {
        return false;
      }
    });
}

const targets = scanAll ? trackedSymlinks() : stagedSymlinks();
const problems = [];

for (const link of targets) {
  let dest;
  try {
    dest = readlinkSync(link);
  } catch {
    continue;
  }
  if (isAbsolute(dest)) {
    problems.push(`  ${link} -> ${dest}\n      (absolute path — breaks on other machines and in CI)`);
    continue;
  }
  const resolved = resolve(dirname(link), dest);
  if (!existsSync(resolved)) {
    problems.push(`  ${link} -> ${dest}\n      (dangling — target does not exist)`);
  }
}

if (problems.length > 0) {
  console.error("");
  console.error("ERROR: broken symlinks detected:");
  console.error("");
  console.error(problems.join("\n"));
  console.error("");
  console.error("Fix: point the symlink at an existing path using a RELATIVE target,");
  console.error("or remove it. Absolute paths and dangling links break CI (they crash");
  console.error("the Claude Code Action skill scanner with ENOENT).");
  console.error("");
  process.exit(1);
}

if (scanAll) {
  console.log(`✅ check-symlinks: ${targets.length} tracked symlinks all resolve (relative)`);
}
