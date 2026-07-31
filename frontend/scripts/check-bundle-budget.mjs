#!/usr/bin/env node
/**
 * First Load JS bundle-budget guardrail.
 *
 * Parses a `next build` (App Router) output log and checks the **shared First
 * Load JS baseline** — the JS every route downloads before its own code —
 * against a budget. This is the single highest-signal bundle metric: it grew to
 * 469 kB (healthy target ~150-200 kB) and the perf audit's whole point is to
 * keep it from silently drifting back up.
 *
 * NON-BLOCKING by default: exits 0 and prints a warning if over budget, so a
 * mis-set threshold can never block a PR. Pass `--strict` to exit non-zero when
 * over budget (opt-in for CI once the threshold is trusted).
 *
 * Usage:
 *   # capture the build log, then check it
 *   pnpm run build:production 2>&1 | tee build.log
 *   node scripts/check-bundle-budget.mjs build.log
 *   # or via stdin
 *   pnpm run build:production 2>&1 | node scripts/check-bundle-budget.mjs
 *   # blocking mode (opt-in)
 *   node scripts/check-bundle-budget.mjs build.log --strict
 *
 * To wire into CI (non-blocking): add a step that tees the existing production
 * build to a log and runs this script without --strict. Flip to --strict once
 * the baseline is trusted to only go down.
 */

import { readFileSync } from "node:fs";

// Budget for the App Router shared First Load JS baseline, in kB.
// Current baseline is 469 kB (measured 2026-07); 500 gives modest headroom so
// this fires on real drift, not noise. Lower it as the baseline is reduced.
const SHARED_FIRST_LOAD_BUDGET_KB = 500;

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const filePath = args.find((a) => !a.startsWith("--"));

async function readInput() {
  if (filePath) {
    return readFileSync(filePath, "utf8");
  }
  // No file argument: read piped stdin. If stdin is an interactive TTY (the
  // script was run bare, with no file and no pipe), don't block waiting on
  // fd 0 — print usage and skip.
  if (process.stdin.isTTY) {
    console.warn(
      "[bundle-budget] No build-log file argument and no piped input. " +
        "Usage: node scripts/check-bundle-budget.mjs <build.log>  " +
        "(or pipe the build: `pnpm run build:production 2>&1 | node scripts/check-bundle-budget.mjs`). " +
        "Skipping — not a failure.",
    );
    return "";
  }
  // Read the piped stream rather than readFileSync(0): a synchronous fd-0 read
  // returns empty for a non-seekable pipe (`... | node script`) on some
  // platforms, which would silently skip the check. Streaming reads it reliably.
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  } catch {
    return "";
  }
}

/** Normalize a Next size token ("469 kB", "1.39 MB", "463 B") to kB. */
function toKb(value, unit) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  switch (unit) {
    case "MB":
      return n * 1024;
    case "B":
      return n / 1024;
    case "kB":
    default:
      return n;
  }
}

const log = await readInput();
if (!log.trim()) {
  console.warn("[bundle-budget] No build output provided (empty log/stdin). Skipping — not a failure.");
  process.exit(0);
}

// The App Router summary prints first; the Pages Router (/_app) summary prints
// a second, smaller "shared by all" line. Take the FIRST occurrence = App Router.
const sharedMatches = [
  ...log.matchAll(/First Load JS shared by all\s+([\d.]+)\s*(kB|MB|B)/g),
];

if (sharedMatches.length === 0) {
  console.warn(
    "[bundle-budget] Could not find 'First Load JS shared by all' in the build output. " +
      "Skipping — not a failure. (Was the full `next build` route table captured?)",
  );
  process.exit(0);
}

const sharedKb = toKb(sharedMatches[0][1], sharedMatches[0][2]);

// Heaviest per-route First Load JS (last size token on each route row), for context only.
let heaviest = { route: null, kb: 0 };
for (const line of log.split("\n")) {
  const m = line.match(/^\s*[├└]\s+[ƒ○●]\s+(\S+).*?([\d.]+)\s*(kB|MB|B)\s*$/);
  if (!m) continue;
  const kb = toKb(m[2], m[3]);
  if (kb != null && kb > heaviest.kb) heaviest = { route: m[1], kb };
}

const overBudget = sharedKb > SHARED_FIRST_LOAD_BUDGET_KB;
const fmt = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} kB`);

console.log("");
console.log("── First Load JS bundle budget ─────────────────────────────");
console.log(`  Shared baseline (every route): ${fmt(sharedKb)}`);
console.log(`  Budget:                        ${SHARED_FIRST_LOAD_BUDGET_KB} kB`);
if (heaviest.route) {
  console.log(`  Heaviest route:                ${heaviest.route} — ${fmt(heaviest.kb)} (informational)`);
}
console.log("────────────────────────────────────────────────────────────");

if (overBudget) {
  const over = Math.round(sharedKb - SHARED_FIRST_LOAD_BUDGET_KB);
  const msg = `[bundle-budget] ⚠️  Shared First Load JS ${fmt(sharedKb)} exceeds budget ${SHARED_FIRST_LOAD_BUDGET_KB} kB (+${over} kB). Something heavy likely entered the root layout / a shared provider.`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg + " (non-blocking)");
  process.exit(0);
}

console.log(`[bundle-budget] ✅ Shared First Load JS ${fmt(sharedKb)} is within budget (${SHARED_FIRST_LOAD_BUDGET_KB} kB).`);
process.exit(0);
