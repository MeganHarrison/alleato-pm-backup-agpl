#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);

const scanRoots = [
  "frontend/src/app",
  "frontend/src/components",
  "frontend/src/hooks",
  "frontend/src/lib",
  "frontend/src/services",
  "backend/src",
];

const ignoredPathParts = [
  "/__tests__/",
  "/test-utils/",
  "/dev-tools/README.md",
  "database.types.ts",
];

const fileExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);

const patterns = [
  {
    category: "synthetic-data",
    severity: "critical",
    re: /\b(useFallback|fallbackData|mockData|dummyData|sampleData|hardcodedData|hardCodedData)\b|mock data|dummy data|sample data|hard[- ]coded data/i,
    why: "Can make broken real data paths look healthy.",
    prevention: "Use real data only; return an explicit degraded/error state when unavailable.",
  },
  {
    category: "silent-catch",
    severity: "critical",
    re: /catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)?\}/,
    why: "Exceptions disappear with no telemetry, state, or user signal.",
    prevention: "Report via telemetry, show a degraded state, or rethrow.",
  },
  {
    category: "silent-language",
    severity: "high",
    re: /fail silently|skip silently|swallowed|intentionally swallowed|silently/i,
    why: "The code explicitly documents hidden failure behavior.",
    prevention: "Convert to structured reporting or a visible degraded state.",
  },
  {
    category: "best-effort",
    severity: "medium",
    re: /best[- ]effort/i,
    why: "Non-blocking work can still hide broken workflows.",
    prevention: "Keep non-blocking behavior only with telemetry and clear owner action.",
  },
];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (!fileExtensions.has(path.extname(entry.name))) continue;
    const relative = path.relative(root, fullPath);
    if (ignoredPathParts.some((part) => relative.includes(part))) continue;
    files.push(relative);
  }
  return files;
}

function lineNumberFor(source, index) {
  return source.slice(0, index).split("\n").length;
}

function snippetFor(source, lineNumber) {
  return source.split("\n")[lineNumber - 1]?.trim().slice(0, 220) ?? "";
}

function scanFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) return [];
  const source = readFileSync(absolutePath, "utf8");
  const findings = [];

  for (const pattern of patterns) {
    const re = new RegExp(pattern.re.source, `${pattern.re.flags.includes("i") ? "i" : ""}g`);
    let match;
    while ((match = re.exec(source)) !== null) {
      const line = lineNumberFor(source, match.index);
      findings.push({
        file: relativePath,
        line,
        severity: pattern.severity,
        category: pattern.category,
        snippet: snippetFor(source, line),
        why: pattern.why,
        prevention: pattern.prevention,
      });
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  return findings;
}

function severityRank(value) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[value] ?? 9;
}

function recommendedAction(finding) {
  if (finding.category === "synthetic-data") {
    return "Remove synthetic data and make the route/component show real empty/error state.";
  }
  if (finding.category === "silent-catch") {
    return "Add structured reporting or rethrow with a typed error.";
  }
  if (finding.category === "silent-language") {
    return "Replace hidden failure path with telemetry and user-visible degraded state.";
  }
  return "Verify this non-blocking path records evidence and has an owner-visible failure signal.";
}

function renderMarkdown(findings) {
  const bySeverity = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  const rows = findings
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line)
    .map((finding) => [
      `| ${finding.severity.toUpperCase()} | \`${finding.category}\` | \`${finding.file}:${finding.line}\` | ${finding.snippet.replaceAll("|", "\\|")} | ${recommendedAction(finding)} |`,
    ].join(""))
    .join("\n");

  return `# Silent/Fallback Debt Audit - ${today}

This report identifies app-code patterns that can hide broken data paths or runtime failures. It is intentionally conservative: each finding needs human review before removal, but no finding should be treated as acceptable without a visible failure signal or telemetry.

## Summary

- Critical: ${bySeverity.critical ?? 0}
- High: ${bySeverity.high ?? 0}
- Medium: ${bySeverity.medium ?? 0}
- Total: ${findings.length}

## Required Policy

- No synthetic business data in production app paths.
- No silent catch blocks.
- No "best effort" path unless it records structured evidence and the user-facing workflow remains truthful.
- Empty real data is acceptable. Fake substitute data is not.

## Findings

| Severity | Category | Location | Evidence | Recommended action |
|---|---|---|---|---|
${rows || "| - | - | - | No findings. | - |"}
`;
}

function parseOutputPath() {
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) return process.argv[outputIndex + 1];
  return `docs/reports/silent-fallback-debt-${today}.md`;
}

async function main() {
  const files = scanRoots.flatMap((dir) => walk(path.join(root, dir)));
  const findings = files.flatMap(scanFile);
  const outputPath = parseOutputPath();
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, renderMarkdown(findings));
  console.log(`Silent/fallback debt audit: ${findings.length} finding(s).`);
  console.log(`Report written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
