#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const args = new Set(process.argv.slice(2));
const baseRefFromFlagIndex = process.argv.indexOf("--base");
const baseRefFromFlag =
  baseRefFromFlagIndex >= 0 ? process.argv[baseRefFromFlagIndex + 1] : undefined;

const mode = args.has("--staged") ? "staged" : "changed";
const baseRef = baseRefFromFlag || process.env.GUARDRAIL_BASE_REF || "origin/main";
const scanPathPrefixes = ["frontend/src/app/", "frontend/src/components/", "frontend/src/hooks/", "frontend/src/lib/"];
const codeExtensions = /\.(ts|tsx|js|jsx)$/;
const rawSidePanelAllowedFiles = new Set([
  "frontend/src/components/ui/sheet.tsx",
  "frontend/src/components/ui/side-panel.tsx",
  "frontend/src/components/ui/unified-slideover.tsx",
]);
const employeeAssigneePickerFiles = new Set([
  "frontend/src/components/meetings/meeting-tasks-manager.tsx",
]);

const addedLineMatchers = [
  {
    name: "explicit any",
    re: /:\s*any\b|<\s*any\s*>|\bas any\b|\bArray<\s*any\s*>|\bReadonlyArray<\s*any\s*>|\bRecord<[^>]*,\s*any\s*>|\bPromise<\s*any\s*>|\bany\[\]/,
    message: "Replace new explicit any usage with a concrete type.",
  },
  {
    name: "unknown double-cast",
    re: /\bas\s+unknown\s+as\b/,
    message: "Replace new as-unknown-as casts with a typed adapter or runtime validation.",
  },
  {
    name: "unreasoned suppression",
    re: /eslint-disable|@ts-ignore|@ts-expect-error/,
    message: "Do not add suppressions without a documented guardrail-approved exception.",
  },
  {
    name: "hard-coded data fallback",
    re: /\b(useFallback|fallbackData|mockData|dummyData|sampleData|hardcodedData|hardCodedData)\b|mock data|dummy data|sample data|hard[- ]coded data/i,
    message: "Do not add hard-coded data or synthetic fallback data. Surface the real data failure instead.",
  },
  {
    name: "silent best-effort failure",
    re: /silent|silently|best-effort|best effort|fail silently/i,
    message: "Do not add silent/best-effort failure paths. Report, throw, or show a degraded state.",
  },
  {
    name: "generic toast error",
    re: /toast\.error\(\s*["'`](?:Failed|Unable|Error)(?:\s+to|\s+\w+)?[^"'`]*["'`]\s*\)/,
    message: "Do not add generic error toasts. Include the caught error detail and structured reporting.",
  },
  {
    name: "raw side panel primitive",
    re: /<\s*(?:SheetContent|SlideoverContent)\b|className\s*=\s*["'`][^"'`]*(?:fixed\s+inset-y-0\s+right-0|right-0\s+top-0\s+h-(?:full|dvh)|p-0[^"'`]*(?:Sheet|panel|drawer))/,
    message:
      "Do not hand-roll side panels. Use the shared SidePanel primitive so width, padding, header, body, footer, and accessibility stay consistent.",
  },
  {
    name: "task assignee auth-user picker",
    re: /["'`]\/api\/users["'`]|assignee_user_id|assigneeUserId/,
    message:
      "Task assignee pickers must use active employee people records, not auth-only users. Use /api/employees and assignee_person_id.",
  },
];

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trimEnd();
  } catch {
    return "";
  }
}

function shouldScanPath(path) {
  return scanPathPrefixes.some((prefix) => path.startsWith(prefix)) && codeExtensions.test(path);
}

function splitLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCandidateFiles() {
  const commands =
    mode === "staged"
      ? ["git diff --cached --name-only --diff-filter=ACMR"]
      : [
          `git diff --name-only ${baseRef}...HEAD --diff-filter=ACMR`,
          "git diff --cached --name-only --diff-filter=ACMR",
          "git diff --name-only --diff-filter=ACMR",
        ];

  return [
    ...new Set(
      commands.flatMap((cmd) => splitLines(run(cmd))).filter(shouldScanPath),
    ),
  ].sort();
}

function getAddedLinesForFile(path) {
  const commands =
    mode === "staged"
      ? [`git diff --cached --unified=0 -- "${path}"`]
      : [
          `git diff --unified=0 ${baseRef}...HEAD -- "${path}"`,
          `git diff --cached --unified=0 -- "${path}"`,
          `git diff --unified=0 -- "${path}"`,
        ];

  const added = [];
  for (const cmd of commands) {
    const diffText = run(cmd);
    if (!diffText) continue;
    for (const rawLine of diffText.split("\n")) {
      if (!rawLine.startsWith("+")) continue;
      if (rawLine.startsWith("+++")) continue;
      added.push(rawLine.slice(1));
    }
  }
  return added;
}

function stripComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
}

export function findSilentCatchBlocks(source) {
  const violations = [];
  const catchBlockRe = /catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\n\s*\}/g;
  let match;

  while ((match = catchBlockRe.exec(source)) !== null) {
    const body = match[1] ?? "";
    if (stripComments(body).length > 0) continue;
    const line = source.slice(0, match.index).split("\n").length;
    violations.push({ line, preview: "empty or comment-only catch block" });
  }

  return violations;
}

export function findSyntheticDataFallbacks(source) {
  const violations = [];
  const patterns = [
    {
      re: /\buseFallback\b\s*[?:=]/g,
      preview: "useFallback option",
    },
    {
      re: /\bfallbackData\b\s*[?:=]/g,
      preview: "fallbackData option",
    },
    {
      re: /\b(?:mock|dummy|sample)(?:Data|Rows|Items|Records)\b\s*[=:]/gi,
      preview: "mock/dummy/sample data assignment",
    },
    {
      re: /\b(?:mock|dummy|sample) data\b/gi,
      preview: "mock/dummy/sample data wording",
    },
    {
      re: /\bhard[- ]coded data\b/gi,
      preview: "hard-coded data wording",
    },
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.re.exec(source)) !== null) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push({ line, preview: pattern.preview });
    }
  }

  return violations;
}

function findAddedLineViolations(file, addedLines) {
  const violations = [];
  const allowedRawSidePanel = rawSidePanelAllowedFiles.has(file);
  for (const line of addedLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    for (const matcher of addedLineMatchers) {
      if (matcher.name === "raw side panel primitive" && allowedRawSidePanel) {
        continue;
      }
      if (
        matcher.name === "task assignee auth-user picker" &&
        !employeeAssigneePickerFiles.has(file)
      ) {
        continue;
      }
      if (!matcher.re.test(line)) continue;
      violations.push({
        file,
        kind: matcher.name,
        message: matcher.message,
        preview: trimmed,
      });
    }
  }
  return violations;
}

export function buildUnsafePatternReport(
  files = getCandidateFiles(),
  addedLinesByFile = new Map(),
) {
  const violations = [];

  for (const file of files) {
    const addedLines = addedLinesByFile.has(file)
      ? addedLinesByFile.get(file)
      : getAddedLinesForFile(file);
    violations.push(...findAddedLineViolations(file, addedLines));

    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const catchViolation of findSilentCatchBlocks(source)) {
      violations.push({
        file,
        kind: "silent catch",
        message: "Catch blocks must fail loudly via structured reporting, user-visible state, or rethrow.",
        preview: `${catchViolation.preview} near line ${catchViolation.line}`,
      });
    }
    for (const fallbackViolation of findSyntheticDataFallbacks(source)) {
      violations.push({
        file,
        kind: "synthetic data fallback",
        message: "Hard-coded fallback/mock/sample data is not allowed in app code. Use real data or fail loudly.",
        preview: `${fallbackViolation.preview} near line ${fallbackViolation.line}`,
      });
    }
  }

  return { files, violations };
}

function main() {
  const report = buildUnsafePatternReport();
  if (report.files.length === 0) {
    console.log(`No ${mode} frontend source files to scan for unsafe patterns.`);
    process.exit(0);
  }

  if (report.violations.length === 0) {
    console.log(`No unsafe patterns detected in ${report.files.length} ${mode} file(s).`);
    process.exit(0);
  }

  console.error("Unsafe quality patterns detected:");
  for (const violation of report.violations) {
    console.error(`- ${violation.file}: ${violation.kind}`);
    console.error(`  ${violation.message}`);
    console.error(`  + ${violation.preview}`);
  }
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
