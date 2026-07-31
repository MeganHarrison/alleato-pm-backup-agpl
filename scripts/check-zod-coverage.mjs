#!/usr/bin/env node
/**
 * Guardrail: no new unvalidated request.json() calls in API routes.
 *
 * Every new/changed API route file that calls `request.json()` directly (bypassing
 * `parseJsonBody`) adds an unvalidated entry point. This script gates that on
 * changed files only — same ratchet pattern as check-no-new-any.mjs — so existing
 * debt is tracked without blocking work while new debt is prevented.
 *
 * Usage:
 *   node scripts/check-zod-coverage.mjs              # changed vs origin/main
 *   node scripts/check-zod-coverage.mjs --staged     # staged files only
 *   node scripts/check-zod-coverage.mjs --report-all # report all unvalidated routes (no fail)
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const baseRefFromFlagIndex = process.argv.indexOf("--base");
const baseRefFromFlag =
  baseRefFromFlagIndex >= 0 ? process.argv[baseRefFromFlagIndex + 1] : undefined;

const mode = args.has("--staged") ? "staged" : "changed";
const reportAll = args.has("--report-all");
const baseRef = baseRefFromFlag || process.env.GUARDRAIL_BASE_REF || "origin/main";

const ROUTE_PATH_PREFIX = "frontend/src/app/api/";
const ROUTE_FILE_PATTERN = /route\.(ts|js)$/;

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trimEnd();
  } catch {
    return "";
  }
}

function isApiRoute(path) {
  return path.startsWith(ROUTE_PATH_PREFIX) && ROUTE_FILE_PATTERN.test(path);
}

function getCandidateFiles() {
  if (reportAll) {
    const out = run(
      `find frontend/src/app/api -name "route.ts" -o -name "route.js" 2>/dev/null`,
    );
    return out ? out.split("\n").filter(Boolean) : [];
  }

  const files =
    mode === "staged"
      ? run("git diff --cached --name-only --diff-filter=ACMR")
      : run(`git diff --name-only ${baseRef}...HEAD --diff-filter=ACMR`);

  if (!files) return [];
  return files
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter(isApiRoute);
}

function fileHasUnvalidatedJson(filePath) {
  const abs = resolve(filePath);
  if (!existsSync(abs)) return false;
  const src = readFileSync(abs, "utf8");

  const hasDirectJson = /\brequest\.json\(\)/.test(src);
  const hasParseJsonBody = /\bparseJsonBody\b/.test(src);

  // Flag if it uses request.json() without the shared validator.
  return hasDirectJson && !hasParseJsonBody;
}

function getAddedLinesForFile(path) {
  const diffCmd =
    mode === "staged"
      ? `git diff --cached --unified=0 -- "${path}"`
      : `git diff --unified=0 ${baseRef}...HEAD -- "${path}"`;
  const diffText = run(diffCmd);
  if (!diffText) return [];
  return diffText
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));
}

function main() {
  const files = getCandidateFiles();

  if (reportAll) {
    const unvalidated = files.filter(fileHasUnvalidatedJson);
    console.log(`\nZod validation coverage report`);
    console.log(`  Total API route files scanned : ${files.length}`);
    console.log(`  Unvalidated (request.json direct): ${unvalidated.length}`);
    console.log(
      `  Coverage: ${Math.round(((files.length - unvalidated.length) / files.length) * 100)}%`,
    );
    if (unvalidated.length > 0) {
      console.log(`\nUnvalidated routes (use parseJsonBody from @/lib/guardrails/api):`);
      for (const f of unvalidated) console.log(`  - ${f}`);
    }
    process.exit(0);
  }

  if (files.length === 0) {
    console.log(`No changed API route files to scan.`);
    process.exit(0);
  }

  const violations = [];
  for (const file of files) {
    // Only fail on newly added request.json() lines — not pre-existing debt.
    const addedLines = getAddedLinesForFile(file);
    const hasNewDirectJson = addedLines.some(
      (l) => /\brequest\.json\(\)/.test(l) && !l.trim().startsWith("//"),
    );
    const hasParseJsonBody =
      addedLines.some((l) => /\bparseJsonBody\b/.test(l)) ||
      (existsSync(resolve(file)) && /\bparseJsonBody\b/.test(readFileSync(resolve(file), "utf8")));

    if (hasNewDirectJson && !hasParseJsonBody) {
      violations.push(file);
    }
  }

  if (violations.length === 0) {
    console.log(`No new unvalidated request.json() calls in changed API routes.`);
    process.exit(0);
  }

  console.error(`\nNew unvalidated request.json() calls detected in API routes:`);
  for (const f of violations) {
    console.error(`  - ${f}`);
  }
  console.error(
    `\nUse parseJsonBody(request, YourSchema) from @/lib/guardrails/api instead of request.json().\n` +
      `This validates input early and returns a structured 400 on bad payloads.\n` +
      `Example:\n` +
      `  import { parseJsonBody } from "@/lib/guardrails/api";\n` +
      `  const body = await parseJsonBody(request, myZodSchema);\n`,
  );
  process.exit(1);
}

main();
