#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "frontend", "src");

const legacyTables = [
  "attachments",
  "cco_attachments",
  "pcco_attachments",
  "prime_contract_pco_attachments",
  "invoice_attachments",
  "change_event_attachments",
  "submittal_attachments",
  "subcontract_attachments",
  "purchase_order_attachments",
];

const excludedSuffixes = [
  path.join("frontend", "src", "types", "database.types.ts"),
  path.join("frontend", "src", "types", "database.local.types.ts"),
  path.join("frontend", "src", "components", "dev-tools", "db-inventory.generated.ts"),
];

const sourceExtensions = new Set([".ts", ".tsx"]);

function walk(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walk(fullPath);
    if (!sourceExtensions.has(path.extname(fullPath))) return [];
    const relative = path.relative(repoRoot, fullPath);
    if (excludedSuffixes.includes(relative)) return [];
    return [fullPath];
  });
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const findings = [];

for (const filePath of walk(sourceRoot)) {
  const text = readFileSync(filePath, "utf8");
  const relative = path.relative(repoRoot, filePath);

  for (const table of legacyTables) {
    const escaped = escapeRegExp(table);
    const checks = [
      {
        label: "direct Supabase table access",
        regex: new RegExp(`\\.from\\(\\s*['"]${escaped}['"]\\s*\\)`, "g"),
      },
      {
        label: "generated Database table type usage",
        regex: new RegExp(`Database\\s*\\[\\s*['"]public['"]\\s*\\]\\s*\\[\\s*['"]Tables['"]\\s*\\]\\s*\\[\\s*['"]${escaped}['"]\\s*\\]`, "g"),
      },
    ];

    if (table !== "attachments") {
      checks.push({
        label: "embedded Supabase relation select",
        regex: new RegExp(`\\b${escaped}\\s*\\(`, "g"),
      });
    }

    for (const check of checks) {
      for (const match of text.matchAll(check.regex)) {
        findings.push({
          file: relative,
          line: lineNumberForIndex(text, match.index ?? 0),
          table,
          label: check.label,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Pattern C attachment audit failed. Legacy attachment table usage remains:");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} ${finding.table} (${finding.label})`,
    );
  }
  process.exit(1);
}

console.log("Pattern C attachment audit passed: no legacy attachment table reads/writes found in app source.");
