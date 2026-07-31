#!/usr/bin/env node
/**
 * Guardrail: Every Next.js page that calls createServiceClient() MUST have
 * `export const dynamic = "force-dynamic"` at the top.
 *
 * Why: createServiceClient() reads SUPABASE_SERVICE_ROLE_KEY, which is absent
 * in CI. Without force-dynamic, Next.js tries to statically prerender the page
 * during `next build`, hits the missing env var, and crashes the build.
 *
 * This has caused 2 production build failures. This script makes it impossible
 * to ship a third.
 *
 * Exit 1 if any violations found; exit 0 if clean.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const APP_DIR = join(ROOT, "frontend/src/app");

const SERVICE_PATTERNS = [
  /createServiceClient\s*\(/,
  /createAdminClient\s*\(/,
];
const FORCE_DYNAMIC_PATTERN = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/;

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test directories and node_modules
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      files.push(...walk(full));
    } else if (entry.isFile() && entry.name === "page.tsx") {
      files.push(full);
    }
  }
  return files;
}

const pages = walk(APP_DIR);
const violations = [];

for (const page of pages) {
  const content = readFileSync(page, "utf8");
  const usesServiceClient = SERVICE_PATTERNS.some((p) => p.test(content));
  if (!usesServiceClient) continue;
  const hasForce = FORCE_DYNAMIC_PATTERN.test(content);
  if (!hasForce) {
    violations.push(relative(ROOT, page));
  }
}

if (violations.length === 0) {
  console.log("✅ server-prerender-safety: all service-client pages have force-dynamic");
  process.exit(0);
}

console.error("❌ server-prerender-safety: pages using createServiceClient() are missing");
console.error('   `export const dynamic = "force-dynamic"`');
console.error("   Without this, next build will crash in CI (SUPABASE_SERVICE_ROLE_KEY absent).");
console.error("");
console.error("   Violations:");
for (const v of violations) {
  console.error(`     ${v}`);
}
console.error("");
console.error('   Fix: add `export const dynamic = "force-dynamic";` as the FIRST LINE of each file.');
process.exit(1);
