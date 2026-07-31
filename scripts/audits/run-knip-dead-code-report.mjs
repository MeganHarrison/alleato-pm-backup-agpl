#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendDir = path.join(repoRoot, "frontend");
const evidenceDir = path.join(
  repoRoot,
  "docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit",
);
const rawReportPath = path.join(evidenceDir, "knip-report.json");
const summaryPath = path.join(evidenceDir, "SUMMARY.md");

fs.mkdirSync(evidenceDir, { recursive: true });

const run = spawnSync(
  "pnpm",
  [
    "--dir",
    "frontend",
    "exec",
    "knip",
    "--config",
    "knip.json",
    "--reporter",
    "json",
    "--no-exit-code",
    "--no-progress",
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80,
  },
);

if (run.error) {
  throw run.error;
}

if (run.status !== 0) {
  process.stderr.write(run.stderr);
  process.stderr.write(run.stdout);
  process.exit(run.status ?? 1);
}

const stdout = run.stdout.trim();
const jsonStart = findJsonStart(stdout);
const prelude = jsonStart > 0 ? stdout.slice(0, jsonStart).trim() : "";
const raw = jsonStart >= 0 ? stdout.slice(jsonStart).trim() : stdout || "{}";
fs.writeFileSync(rawReportPath, `${raw}\n`);
if (prelude) {
  fs.writeFileSync(path.join(evidenceDir, "knip-stdout-prelude.txt"), `${prelude}\n`);
}

let report;
try {
  report = JSON.parse(raw);
} catch (error) {
  fs.writeFileSync(path.join(evidenceDir, "knip-parse-error.txt"), String(error));
  throw new Error(`Knip JSON reporter output was not valid JSON: ${error.message}`);
}

const records = flattenReport(report);
const grouped = groupByType(records);
const highConfidenceFiles = records
  .filter((record) => record.type === "files")
  .filter((record) => isHighConfidenceFile(record.file))
  .sort(byFile)
  .slice(0, 80);
const needsVerificationFiles = records
  .filter((record) => record.type === "files")
  .filter((record) => !isHighConfidenceFile(record.file))
  .sort(byFile)
  .slice(0, 120);
const knownFalsePositiveRisk = records
  .filter((record) => record.file)
  .filter((record) =>
    [
      "src/components/ds/",
      "src/hooks/data/",
      "src/components/ui/",
      "src/app/",
      "src/types/",
      ".stories.",
      "__tests__",
    ].some((marker) => record.file.includes(marker)),
  )
  .sort(byFile)
  .slice(0, 120);

const lines = [
  "# S70 Knip Dead-Code Audit Summary",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Purpose",
  "",
  "This is a deletion-planning report, not a delete list. It exists because the",
  "older orphan-audit scripts can over-flag barrel exports, dynamic imports,",
  "framework entrypoints, and design-system inventory.",
  "",
  "## Issue Counts",
  "",
  "| Issue type | Count |",
  "| --- | ---: |",
  ...Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, items]) => `| ${type} | ${items.length} |`),
  "",
  "## Higher-Confidence Unused File Candidates",
  "",
  "These files are outside the highest-risk dynamic/framework/design-system surfaces.",
  "They still require owner verification before deletion.",
  "",
  ...formatRecords(highConfidenceFiles),
  "",
  "## Needs Verification Before Any Deletion",
  "",
  "These files are in areas where Knip can still be right, but false positives are",
  "more likely because of dynamic routing, public exports, tests, or broad app surfaces.",
  "",
  ...formatRecords(needsVerificationFiles),
  "",
  "## Known False-Positive Risk Buckets",
  "",
  "These are not deletion candidates without manual proof. They often include",
  "barrel exports, generated types, app-router files, tests, Storybook, or",
  "design-system inventory.",
  "",
  ...formatRecords(knownFalsePositiveRisk),
  "",
  "## Deletion Rule",
  "",
  "Do not delete anything from this report in bulk. Create separate task slices by",
  "domain, verify imports/dynamic references/runtime ownership, then delete in small",
  "batches with typecheck/build evidence.",
  "",
  "## Artifacts",
  "",
  `- Raw JSON: ${path.relative(repoRoot, rawReportPath)}`,
  `- Summary: ${path.relative(repoRoot, summaryPath)}`,
  "",
];

fs.writeFileSync(summaryPath, `${lines.join("\n")}`);
console.log(`Knip report written to ${path.relative(repoRoot, rawReportPath)}`);
console.log(`Knip summary written to ${path.relative(repoRoot, summaryPath)}`);

function flattenReport(value) {
  if (Array.isArray(value?.issues)) {
    return value.issues.flatMap((issue) => {
      const file = relativeFrontendPath(issue.file ?? "");
      return Object.entries(issue).flatMap(([key, items]) => {
        const type = issueTypeFromKey(key);
        if (!type || !Array.isArray(items)) return [];
        return items.map((item) => ({
          type,
          file: relativeFrontendPath(item.file ?? file),
          name: item.name ?? item.symbol ?? item.exportName ?? "",
          raw: item,
        }));
      });
    });
  }

  const records = [];
  visit(value, []);
  return records;

  function visit(node, trail) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, trail);
      return;
    }

    if (looksLikeIssue(node, trail)) {
      records.push(normalizeIssue(node, trail));
    }

    for (const [key, child] of Object.entries(node)) {
      visit(child, [...trail, key]);
    }
  }
}

function looksLikeIssue(node, trail) {
  if (Object.keys(node).some((key) => Array.isArray(node[key]) && issueTypeFromKey(key))) {
    return false;
  }
  if (typeof node.file === "string") return true;
  if (typeof node.name === "string" && trail.some((part) => issueTypeFromKey(part))) return true;
  return false;
}

function normalizeIssue(node, trail) {
  const type = [...trail].reverse().map(issueTypeFromKey).find(Boolean) ?? "unknown";
  const file = relativeFrontendPath(node.file ?? node.parentFile ?? node.importedBy ?? "");
  return {
    type,
    file,
    name: node.name ?? node.symbol ?? node.exportName ?? "",
    raw: node,
  };
}

function issueTypeFromKey(key) {
  const normalized = String(key);
  const known = new Set([
    "files",
    "dependencies",
    "devDependencies",
    "optionalPeerDependencies",
    "unlisted",
    "binaries",
    "unresolved",
    "exports",
    "types",
    "nsExports",
    "nsTypes",
    "duplicates",
    "enumMembers",
    "namespaceMembers",
    "catalog",
  ]);
  return known.has(normalized) ? normalized : null;
}

function groupByType(records) {
  return records.reduce((groups, record) => {
    groups[record.type] ??= [];
    groups[record.type].push(record);
    return groups;
  }, {});
}

function formatRecords(records) {
  if (records.length === 0) return ["- None in this bucket."];
  return records.map((record) => {
    const subject = record.file || record.name || "(unknown)";
    const name = record.name && record.name !== subject ? ` - ${record.name}` : "";
    return `- \`${subject}\`${name} (${record.type})`;
  });
}

function isHighConfidenceFile(file) {
  if (!file) return false;
  const riskyMarkers = [
    "src/app/",
    "src/components/ds/",
    "src/components/ui/",
    "src/hooks/data/",
    "src/types/",
    "src/stories/",
    ".stories.",
    "__tests__",
    "tests/",
    "config/",
    "scripts/",
    ".config.",
    "middleware.ts",
    "instrumentation.ts",
  ];
  return !riskyMarkers.some((marker) => file.includes(marker));
}

function relativeFrontendPath(file) {
  if (!file) return "";
  const absolute = path.isAbsolute(file) ? file : path.join(frontendDir, file);
  return path.relative(frontendDir, absolute).replaceAll(path.sep, "/");
}

function byFile(a, b) {
  return `${a.file}${a.name}`.localeCompare(`${b.file}${b.name}`);
}

function findJsonStart(text) {
  const match = text.match(/(^|\n)\s*{/);
  if (!match || match.index === undefined) return -1;
  return match[0].startsWith("\n") ? match.index + 1 : match.index;
}
