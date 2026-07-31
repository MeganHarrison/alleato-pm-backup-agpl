#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MIGRATION_PATH = /^supabase\/migrations\/\d{14}_[^/]+\.sql$/;
const RETIRED_SEGMENT = /(^|\/)(?:archive|legacy|deprecated|backup|old)(?:\/|$)|\.(?:backup|bak|old|orig|deprecated)(?:\.|$)/i;
const RETIRED_EXACT_PATH = /(?:^|\/)(?:run_migration\.sh|run-migration\.js|seed-database\.ts|seed-financial-data\.ts|seed-project-financial-data\.ts|seed-test-data\.(?:js|ts)|seed-budget-data\.ts|seed-budget-test-data\.ts|fix-snaplet-models\.cjs|check-seed-data\.ts|verify-seed-data\.ts|test-seed-config\.ts|seed-direct-costs\.ts|seed\.config\.ts|TABLE_TEMPLATE\.tsx\.example)$/;
const RETIRED_EXACT_REFERENCE = /(?:run_migration\.sh|run-migration\.js|seed-database\.ts|seed-financial-data\.ts|seed-project-financial-data\.ts|seed-test-data\.(?:js|ts)|seed-budget-data\.ts|seed-budget-test-data\.ts|fix-snaplet-models\.cjs|check-seed-data\.ts|verify-seed-data\.ts|test-seed-config\.ts|seed-direct-costs\.ts|seed\.config\.ts|TABLE_TEMPLATE\.tsx\.example)/;
const RETIRED_EVIDENCE_ROOT = /docs\/ops\/evidence(?:\/|$)/;
const RETIRED_CODE_MARKER = /@deprecated|\bDEPRECATED\b/i;
const EXECUTABLE_OR_CONFIG = /\.(?:[cm]?[jt]sx?|py|sh|json|ya?ml)$/i;
const PACKAGE_MANAGER_LOCKFILE = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.ya?ml|yarn\.lock)$/i;
const PATH_REFERENCE = /(?:from\s*["']|require\s*\(|import\s*\(|(?:path\.)?(?:join|resolve)\s*\(|fileURLToPath\s*\(|(?:path|directory|dir|file|glob|include|exclude|source)\s*[:=]\s*["'])/i;

export function analyzePath(filePath) {
  if (MIGRATION_PATH.test(filePath) || (!RETIRED_SEGMENT.test(filePath) && !RETIRED_EXACT_PATH.test(filePath) && !RETIRED_EVIDENCE_ROOT.test(filePath))) return null;
  return { filePath, category: "banned new artifact path" };
}

export function analyzeAddedLine(filePath, line) {
  if (MIGRATION_PATH.test(filePath) || PACKAGE_MANAGER_LOCKFILE.test(filePath) || !EXECUTABLE_OR_CONFIG.test(filePath)) return null;
  if (RETIRED_CODE_MARKER.test(line)) return { filePath, category: "banned retired-code marker", line };
  if ((!PATH_REFERENCE.test(line) && !RETIRED_EXACT_REFERENCE.test(line)) || (!RETIRED_SEGMENT.test(line) && !RETIRED_EXACT_REFERENCE.test(line) && !RETIRED_EVIDENCE_ROOT.test(line))) return null;
  return { filePath, category: "banned runtime reference", line };
}

function git(args) {
  // Merge commits stage the entire incoming side (multi-MB generated JSON),
  // which overflows execFileSync's default 1 MB buffer with ENOBUFS.
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function changedPaths(mode) {
  const args = mode === "staged"
    ? ["diff", "--cached", "--name-status", "-M", "--diff-filter=ACMR"]
    : ["diff", mode, "--name-status", "-M", "--diff-filter=ACMR"];
  return git(args).split("\n").filter(Boolean).flatMap((row) => {
    const fields = row.split("\t");
    return fields.length >= 3 && fields[0].startsWith("R") ? [fields.at(-1)] : [fields[1]];
  }).filter(Boolean);
}

function addedLines(mode) {
  const args = mode === "staged"
    ? ["diff", "--cached", "--unified=0", "--diff-filter=ACMR"]
    : ["diff", mode, "--unified=0", "--diff-filter=ACMR"];
  const findings = [];
  let currentFile = null;
  let currentLine = 0;
  for (const row of git(args).split("\n")) {
    if (row.startsWith("+++ b/")) currentFile = row.slice(6);
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) currentLine = Number(hunk[1]);
    if (currentFile && row.startsWith("+") && !row.startsWith("+++")) {
      const finding = analyzeAddedLine(currentFile, row.slice(1));
      if (finding) findings.push({ ...finding, lineNumber: currentLine });
      currentLine += 1;
    } else if (currentFile && !row.startsWith("-") && !row.startsWith("@@") && !row.startsWith("diff ")) {
      currentLine += 1;
    }
  }
  return findings;
}

function fail(findings) {
  if (!findings.length) return;
  console.error("ERROR: retired artifacts and runtime references are prohibited. Git history is retention; migrate live inputs to their canonical owner.");
  for (const finding of findings) {
    console.error(`- ${finding.filePath}${finding.lineNumber ? `:${finding.lineNumber}` : ""}: ${finding.category}`);
  }
  console.error("Only timestamped files directly under supabase/migrations/ are exempt as immutable applied migration history.");
  process.exitCode = 1;
}

export function run(mode = "staged") {
  const findings = changedPaths(mode).map(analyzePath).filter(Boolean);
  findings.push(...addedLines(mode));
  fail(findings);
  if (!findings.length) console.log("retired-artifact guard: pass");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseIndex = process.argv.indexOf("--base");
  run(baseIndex >= 0 ? process.argv[baseIndex + 1] : "staged");
}
