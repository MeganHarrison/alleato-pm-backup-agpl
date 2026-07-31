#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { assertFormerProjectIntelligencePathsAbsent } from "../../project-intelligence/core/ownership-contract.mjs";

const repoRoot = process.cwd();

const activeDailyBriefFiles = [
  "frontend/src/app/(main)/executive/intelligence-brief/page.tsx",
  "frontend/src/app/(tables)/daily-briefs/page.tsx",
  "frontend/src/app/(tables)/daily-briefs/[briefId]/page.tsx",
  "frontend/src/app/api/executive/daily-brief/route.ts",
  "frontend/src/app/api/executive/daily-brief/route-helpers.ts",
  "frontend/src/app/api/executive/daily-brief/history/route.ts",
  "frontend/src/app/api/executive/daily-brief/widget/route.ts",
  "frontend/src/app/api/executive/daily-brief/preview-teams/route.ts",
  "frontend/src/app/api/executive/daily-brief/send-teams/route.ts",
  "frontend/src/app/api/executive/intelligence-brief/route.ts",
  "frontend/src/app/api/executive/brandon-daily-update/route.ts",
  "frontend/src/lib/ai/eve-runtime/production-tool-registry.ts",
  "frontend/src/lib/ai/tools/executive-brief-tools.ts",
  "frontend/src/lib/ai/tool-registry.ts",
  "frontend/src/lib/ai-ops/executive-daily-brief-workflow.ts",
  "frontend/src/lib/ai-ops/source-adapters.ts",
  "frontend/src/lib/ai-ops/tool-registry.ts",
  "project-intelligence/core/compile-daily-executive-brief.mjs",
  "project-intelligence/projections/daily-deep-read-consumers.mjs",
  "project-intelligence/maintenance/daily-deep-read-backfill.mjs",
];

const forbiddenRules = [
  {
    pattern: /\bdaily_recaps\b/,
    message:
      "Active Daily Brief surfaces must use the canonical packet adapter, not daily_recaps.",
  },
  {
    pattern: /\bgenerateExecutiveDailyBrief\b/,
    message:
      "Assistant Daily Brief access must be read-only; generation is retired until rebuilt on the canonical packet compiler.",
  },
  {
    pattern: /\bgenerate-executive-daily-brief-packet\b/,
    message:
      "AI Ops Daily Brief generation is retired until it writes to intelligence_packets/daily-executive-brief.",
  },
  {
    pattern: /\bpersist-executive-daily-brief-artifact\b/,
    message:
      "AI Ops Daily Brief persistence is retired unless it writes only to intelligence_packets.",
  },
  {
    pattern: /\b(?:from|table)\(["']document_chunks["']\)|\bsearch_document_chunks\b/,
    message:
      "Daily Deep Read synthesis must not query document_chunks directly; chunks are search/discovery/citation support only.",
  },
];

const failures = [];

assertFormerProjectIntelligencePathsAbsent({ root: repoRoot });

for (const relativePath of activeDailyBriefFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;

  const source = fs.readFileSync(absolutePath, "utf8");
  for (const rule of forbiddenRules) {
    if (rule.pattern.test(source)) {
      failures.push(`${relativePath}: ${rule.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Daily Brief source-of-truth guardrail failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Daily Brief source-of-truth guardrail passed.");
