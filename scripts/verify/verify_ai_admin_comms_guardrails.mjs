#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");

const files = {
  timelineRoute: "frontend/src/app/api/ai-assistant/timeline/route.ts",
  operationalTools: "frontend/src/lib/ai/tools/operational.ts",
};

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function requireFragments(label, content, fragments) {
  const failures = fragments
    .filter((fragment) => !content.includes(fragment))
    .map((fragment) => `${label} missing fragment: ${fragment}`);
  return failures;
}

const failures = [];

const operationalTools = read(files.operationalTools);
failures.push(
  ...requireFragments(files.operationalTools, operationalTools, [
    'requireAdminForCommunications("Email and Teams")',
    "Email and Teams access is admin-only in Alleato",
  ]),
);

const timelineRoute = read(files.timelineRoute);
failures.push(
  ...requireFragments(files.timelineRoute, timelineRoute, [
    "allowAdminCommsSources",
    "projectId is required",
    "enforceProjectAccess",
  ]),
);

if (failures.length > 0) {
  console.error("AI admin comms guardrail verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI admin comms guardrail verification passed.");

