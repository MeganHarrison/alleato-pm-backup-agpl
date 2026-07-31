#!/usr/bin/env node

/**
 * Manual JobPlanner -> app sync of the SAFE, verified entities only.
 *
 * Runs for every Current, non-archived, JobPlanner-mapped project and, per project:
 *   1. imports NEW photos (incremental, --new-only), RFIs, submittals, punch items
 *      (all idempotent — only add what's new),
 *   2. runs the field-by-field verifier (verify-nonfinancial-import.mjs) that ties every
 *      RFI / punch / submittal back to JobPlanner.
 *
 * It NEVER touches financial data (commitments, change orders, prime contracts, invoices)
 * — that stays manual and human-reviewed.
 *
 * FAIL LOUD: if any importer errors, or any project's verifier finds a discrepancy, the
 * run exits non-zero (so the manual workflow goes red and alerts) and prints exactly
 * which project + entity is off. It never silently writes mismatched data.
 *
 * Env: JOBPLANNER_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.
 * Reads the JP<->app project mapping from
 *   docs/ops/evidence/2026-07-07-jobplanner-commitment-batch-plan/batch-plan.csv
 *
 * Usage:
 *   JOBPLANNER_MANUAL_SYNC_CONFIRMED=true \
 *     node scripts/jobplanner/nightly-sync.mjs --manual # deliberate write run
 *   node scripts/jobplanner/nightly-sync.mjs --dry-run  # select projects + report, no writes
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { assertManualJobPlannerSync } from "./manual-sync-mode.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DRY = process.argv.includes("--dry-run");

// Fail before loading credentials or provider/database clients. A schedule
// cannot restart writes unless it also carries two deliberate confirmations.
assertManualJobPlannerSync({ dryRun: DRY });

const require = createRequire(path.join(repoRoot, "frontend", "package.json"));
try { require("dotenv").config({ path: path.join(repoRoot, ".env"), quiet: true }); } catch {}
try { require("dotenv").config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true }); } catch {}
const { createClient } = require("@supabase/supabase-js");

// The mapping snapshot uses "Current", while the live projects table uses
// "Development" for active projects. Treat both as active; archived remains a
// separate hard exclusion so phase vocabulary drift cannot produce a false
// successful zero-project run.
const ACTIVE_PHASES = new Set(["current", "development"]);
// Projects that are active in the app but are NOT actually active for sync (per Megan).
const EXCLUDE_APP_IDS = new Set([25125]); // Goodwill Noblesville

async function selectProjects() {
  const csv = fs.readFileSync(path.join(repoRoot, "docs/ops/evidence/2026-07-07-jobplanner-commitment-batch-plan/batch-plan.csv"), "utf8")
    .split("\n").slice(1).filter(Boolean);
  const pairs = csv.map((l) => { const x = l.split(","); return { name: x[1], jp: Number(x[3]), app: Number(x[4]) }; })
    .filter((r) => Number.isInteger(r.jp) && Number.isInteger(r.app));
  // Use the Supabase REST client (HTTPS/IPv4) — NOT a raw pg connection. GitHub Actions
  // runners have no IPv6, and the direct DB host resolves to IPv6 (ENETUNREACH on :5432).
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data: projRows, error: pErr } = await sb.from("projects").select("id, phase, archived");
  if (pErr) throw new Error(`projects read: ${pErr.message}`);
  const currentIds = new Set(
    (projRows ?? []).filter((r) => ACTIVE_PHASES.has(String(r.phase || "").toLowerCase()) && !r.archived).map((r) => Number(r.id)),
  );
  // Projects that already have a JobPlanner photo baseline — only THESE get the nightly
  // incremental photo pull. Onboarding a new project's photos stays a manual decision
  // (that's where the per-project volume cap lives), so the cron never backfills GBs.
  const { data: photoRows, error: phErr } = await sb.from("project_photos").select("project_id").not("jobplanner_photo_guid", "is", null);
  if (phErr) throw new Error(`project_photos read: ${phErr.message}`);
  const photoBaseline = new Set((photoRows ?? []).map((r) => Number(r.project_id)));
  return pairs
    .filter((p) => currentIds.has(p.app) && !EXCLUDE_APP_IDS.has(p.app))
    .map((p) => ({ ...p, syncPhotos: photoBaseline.has(p.app) }));
}

function run(script, args) {
  const res = spawnSync("node", [path.join(repoRoot, "scripts/jobplanner", script), ...args], {
    cwd: repoRoot, env: process.env, encoding: "utf8",
  });
  const out = (res.stdout || "") + (res.stderr || "");
  const lastLine = out.trim().split("\n").filter(Boolean).pop() || "";
  return { code: res.status ?? 1, lastLine, out };
}

async function main() {
  const projects = await selectProjects();
  console.log(`Manual JobPlanner sync — ${projects.length} active, JP-mapped projects${DRY ? " (DRY RUN)" : ""}\n`);
  if (DRY) { for (const p of projects) console.log(`  ${p.app}  ${p.name} (jp ${p.jp})`); return; }

  const failures = [];
  for (const p of projects) {
    const tag = `${p.name} (app ${p.app})`;
    // Idempotent, additive imports. Photos incremental; the field entities re-run cheaply.
    const steps = [
      // Photos only for already-onboarded projects (incremental); RFIs/submittals/punch
      // are small + verified, so they sync everywhere.
      ...(p.syncPhotos ? [["photos", () => run("import-photos.mjs", [`--jp=${p.jp}`, `--app=${p.app}`, "--new-only", "--apply"])]] : []),
      ["rfis", () => run("import-rfis.mjs", [`--jp=${p.jp}`, `--app=${p.app}`])],
      ["submittals", () => run("import-submittals.mjs", [`--jp=${p.jp}`, `--app=${p.app}`])],
      ["punch", () => run("import-punch-list.mjs", [`--jp=${p.jp}`, `--app=${p.app}`])],
    ];
    const summary = [];
    for (const [name, fn] of steps) {
      const r = fn();
      summary.push(`${name}:${r.code === 0 ? "ok" : "ERR"}`);
      if (r.code !== 0) failures.push(`${tag} — ${name} import failed: ${r.lastLine}`);
    }
    // Verification gate — ties every RFI/punch/submittal back to JobPlanner.
    const v = run("verify-nonfinancial-import.mjs", [`--jp=${p.jp}`, `--app=${p.app}`]);
    if (v.code !== 0) failures.push(`${tag} — VERIFY FAILED:\n${v.out.trim().split("\n").filter((l) => l.includes("✗")).join("\n")}`);
    console.log(`  ${v.code === 0 ? "✓" : "✗"} ${tag.padEnd(38)} ${summary.join("  ")}  verify:${v.code === 0 ? "PASS" : "FAIL"}`);
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`ALL ${projects.length} PROJECTS SYNCED & VERIFIED ✓`);
  } else {
    console.log(`${failures.length} FAILURE(S) — data NOT trusted, run marked failed:`);
    for (const f of failures) console.log("  ✗ " + f);
    process.exit(1);
  }
}
main().catch((e) => { console.error("manual JobPlanner sync crashed:", e.message); process.exit(1); });
