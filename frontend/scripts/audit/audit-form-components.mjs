#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const strict = process.argv.includes("--strict");

const args = [
  "eslint",
  "src",
  "--format",
  "json",
  "--rule",
  "design-system/no-raw-form-controls:error",
  "--rule",
  "design-system/require-approved-form-components:error",
  "--rule",
  "design-system/require-money-field:error",
];

const run = spawnSync("npx", args, {
  cwd: process.cwd(),
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 50,
});

if (run.error) {
  throw run.error;
}

const raw = run.stdout?.trim() || "[]";
const parsed = JSON.parse(raw);

const targetRules = new Set([
  "design-system/no-raw-form-controls",
  "design-system/require-approved-form-components",
  "design-system/require-money-field",
]);

const byRule = new Map();
const byFile = new Map();
let total = 0;

for (const fileResult of parsed) {
  for (const msg of fileResult.messages ?? []) {
    if (!targetRules.has(msg.ruleId ?? "")) continue;
    total += 1;
    byRule.set(msg.ruleId, (byRule.get(msg.ruleId) ?? 0) + 1);
    byFile.set(fileResult.filePath, (byFile.get(fileResult.filePath) ?? 0) + 1);
  }
}

console.log(`Form component audit: ${total} violation(s)`);

if (total > 0) {
  console.log("\nBy rule:");
  for (const [ruleId, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`- ${ruleId}: ${count}`);
  }

  console.log("\nTop files:");
  for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`- ${file}: ${count}`);
  }
}

if (strict && total > 0) {
  process.exit(1);
}

