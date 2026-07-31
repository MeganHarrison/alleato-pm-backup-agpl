// Clears stale Next.js build OUTPUT while preserving the incremental compile
// cache (`.next/cache`).
//
// Why this exists: `postinstall` used to run `rm -rf .next`, which deletes the
// ENTIRE `.next` directory — including `.next/cache`. On Vercel, `.next/cache`
// is restored from the build cache *before* install runs, so wiping it forced a
// cold, full recompile on every deployment (~8-10 min production builds instead
// of incremental ones). The original intent was only ever to clear stale build
// output for local `npm install`, never to destroy the compiler cache.
//
// This script removes everything inside `.next` except `cache`, keeping the
// stale-output cleanup the original commit ("Fix Vercel deployment failure")
// wanted while letting Vercel's incremental cache survive.

import { readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..", "..");
const nextDir = resolve(frontendRoot, ".next");

const PRESERVE = new Set(["cache"]);

let entries;
try {
  entries = readdirSync(nextDir, { withFileTypes: true });
} catch {
  // No `.next` directory yet (fresh clone) — nothing to clean.
  process.exit(0);
}

for (const entry of entries) {
  if (PRESERVE.has(entry.name)) continue;
  rmSync(join(nextDir, entry.name), { recursive: true, force: true });
}
