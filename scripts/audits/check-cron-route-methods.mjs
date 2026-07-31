#!/usr/bin/env node
/**
 * Guardrail: every cron path registered in frontend/vercel.json must have a
 * route handler that exports GET.
 *
 * Vercel triggers cron jobs with an HTTP GET request (vercel.com/docs/cron-jobs).
 * A cron route that only exports POST returns 405 to the scheduler on every
 * run — a silent failure: the app's own telemetry never sees the request.
 * This happened to 7 of 8 registered crons (found 2026-07-10); this check
 * makes the class unrepresentable.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const vercelJsonPath = join(root, "frontend", "vercel.json");

const config = JSON.parse(readFileSync(vercelJsonPath, "utf8"));
const crons = config.crons ?? [];

if (crons.length === 0) {
  console.log("✅ cron-route-methods: no crons registered in vercel.json");
  process.exit(0);
}

const failures = [];

for (const { path } of crons) {
  const routeFile = join(root, "frontend", "src", "app", ...path.split("/").filter(Boolean), "route.ts");
  if (!existsSync(routeFile)) {
    failures.push(`${path} → route file not found: ${routeFile}`);
    continue;
  }
  const src = readFileSync(routeFile, "utf8");
  const exportsGet =
    /export\s+(const|async\s+function|function)\s+GET\b/.test(src) ||
    /export\s*\{[^}]*\bGET\b[^}]*\}/.test(src);
  if (!exportsGet) {
    failures.push(`${path} → route.ts does not export GET (Vercel cron sends GET; POST-only = 405 on every scheduled run)`);
  }
}

if (failures.length > 0) {
  console.error("❌ cron-route-methods: registered cron routes missing a GET export:\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\nFix: add `export const GET = POST;` (handlers are auth-gated via CRON_SECRET, method-agnostic).');
  process.exit(1);
}

console.log(`✅ cron-route-methods: all ${crons.length} registered cron routes export GET`);
