#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const scanRoots = [
  path.join(repoRoot, "frontend", "src", "app"),
  path.join(repoRoot, "frontend", "scripts"),
];
const forbidden = [
  {
    pattern: /\bregenerateExecutiveBriefingDraft\b/,
    message:
      "App routes/actions/scripts must regenerate the Executive Daily Brief through regenerateDailyBriefDraftWithLedger so every generated draft has an ai_work_runs record.",
  },
];
const fileScopedForbidden = [
  {
    file: path.join(
      "frontend",
      "src",
      "app",
      "api",
      "admin",
      "owner-briefing",
      "send-test",
      "route.ts",
    ),
    rules: [
      {
        pattern: /\.from\(["']daily_recaps["']\)/,
        message:
          "Deprecated admin owner briefing test-send must not query daily_recaps; use the canonical Daily Brief gateway.",
      },
      {
        pattern: /\bsendProactive(Message|Card)\b/,
        message:
          "Deprecated admin owner briefing test-send must not call the Teams provider directly; use the canonical Daily Brief gateway.",
      },
    ],
  },
];

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return listFiles(fullPath);
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

const failures = [];

for (const root of scanRoots) {
  if (!fs.existsSync(root)) continue;
  for (const file of listFiles(root)) {
    const source = fs.readFileSync(file, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(source)) {
        failures.push({
          file: path.relative(repoRoot, file),
          message: rule.message,
        });
      }
    }
    for (const scoped of fileScopedForbidden) {
      if (path.relative(repoRoot, file) !== scoped.file) continue;
      for (const rule of scoped.rules) {
        if (rule.pattern.test(source)) {
          failures.push({
            file: path.relative(repoRoot, file),
            message: rule.message,
          });
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Executive Daily Brief gateway guardrail failed:");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.message}`);
  }
  process.exit(1);
}

console.log("Executive Daily Brief gateway guardrail passed.");
