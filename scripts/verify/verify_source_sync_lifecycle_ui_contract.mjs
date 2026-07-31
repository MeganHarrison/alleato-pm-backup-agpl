#!/usr/bin/env node

/**
 * Static guard for the daily RAG lifecycle trust surface.
 *
 * Live data coverage is verified by `verify_source_lifecycle_health.mjs`; this
 * check prevents the required source families and lifecycle stages from being
 * removed from the source-sync API/UI contract without an explicit update.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

const files = [
  "frontend/src/app/api/admin/source-sync/_contracts.ts",
  "frontend/src/app/api/admin/source-sync/status/route.ts",
  "frontend/src/components/ai-intelligence/source-sync-health-panel.tsx",
];

const requiredTokens = [
  "ragLifecycle",
  "meetings",
  "teams",
  "emails",
  "sharepoint",
  "synced",
  "vectorized",
  "projectAssigned",
  "tasksExtracted",
  "projectIntelligenceUpdated",
  "ownerHint",
  "notifications",
];

const contentByFile = new Map(
  files.map((file) => [
    file,
    fs.readFileSync(path.join(repoRoot, file), "utf8"),
  ]),
);

const failures = [];

for (const token of requiredTokens) {
  const presentInEveryLayer = files.every((file) =>
    contentByFile.get(file)?.includes(token),
  );
  if (!presentInEveryLayer) {
    failures.push(`Missing required lifecycle token in every layer: ${token}`);
  }
}

if (!contentByFile.get(files[1])?.includes("createRagServiceClient")) {
  failures.push("Status route must read back from the RAG database service client.");
}

if (!contentByFile.get(files[2])?.includes("Daily RAG trust")) {
  failures.push("Source sync UI must render the Daily RAG trust matrix.");
}

if (failures.length > 0) {
  console.error("[FAIL] Source sync lifecycle UI contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[PASS] Source sync lifecycle UI contract passed.");
