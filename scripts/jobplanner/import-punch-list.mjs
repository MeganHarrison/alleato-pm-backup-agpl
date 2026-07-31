#!/usr/bin/env node

/**
 * Idempotent import of Job Planner punch-list items into the PM app
 * `punch_items` table. Scoped to Goodwill Noblesville for the first pass.
 *
 * Job Planner endpoint (verified live 2026-06-17):
 *   list  GET /projects/{jpProjectId}/punchlists   (V1)  -> array of items
 *
 * Idempotency: keyed on the new `jobplanner_punchlist_item_id` column
 * (migration 20260617220000). Re-runs UPDATE the matching row instead of
 * inserting a duplicate. `source_system` is stamped 'jobplanner'.
 *
 * Field mapping (JP -> punch_items):
 *   punchlistItemId  -> jobplanner_punchlist_item_id (idempotency key)
 *   itemNumber "001" -> number (int)
 *   title            -> title
 *   notes            -> description
 *   category         -> trade            (JP has no dedicated trade field)
 *   location         -> location
 *   status 1|2       -> "initiated" | "closed"
 *   priority 1|2|3   -> "low" | "medium" | "high"  (0/other -> null)
 *   assignedTo.name  -> assignee_company  (JP assignee is a company string)
 *   ballInCourt.name -> ball_in_court     (text column)
 *   dueDate          -> due_date (date)
 *   resolvedOn       -> date_resolved     (skips JP 0001-01-01 sentinel)
 *   workCompletedOn  -> date_closed       (skips sentinel)
 *   createdOn        -> created_at
 *   modifiedOn       -> updated_at
 *
 * UUID person FKs (assignee_id, created_by, punch_item_manager_id, ...) are left
 * NULL: Job Planner returns display names / company names with email null, and
 * there is no JP-user -> app-user identity map yet.
 *
 * Secrets: reads JOBPLANNER_API_KEY + SUPABASE_SERVICE_ROLE_KEY from env. Never printed.
 *
 * Usage:
 *   node scripts/jobplanner/import-punch-list.mjs            # apply
 *   node scripts/jobplanner/import-punch-list.mjs --dry-run  # preview, no writes
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const DRY_RUN = process.argv.includes("--dry-run");

// --- Job Planner mapping (per-project via CLI args) ---
const argValue = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const JP_PROJECT_ID = Number(argValue("jp"));
const APP_PROJECT_ID = Number(argValue("app"));
if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Usage: node scripts/jobplanner/import-punch-list.mjs --jp=<jobplannerProjectId> --app=<appProjectId> [--dry-run]");
  process.exit(1);
}

const API_V1 = "https://api.jobplanner.com";
// Cloudflare blocks default script user-agents (err 1010); send a browser UA.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

if (!JP_KEY) {
  console.error("Missing JOBPLANNER_API_KEY. Add it to frontend/.env.local.");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function jpGet(pathname) {
  const res = await fetch(`${API_V1}${pathname}`, {
    headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Job Planner ${res.status} on ${pathname}`);
  }
  return res.json();
}

// JP uses 0001-01-01T00:00:00 as a "no date" sentinel.
function realDateOrNull(value) {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith("0001-01-01")) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// punch_items.due_date is a DATE column; emit yyyy-mm-dd.
function dateOnlyOrNull(value) {
  const iso = realDateOrNull(value);
  return iso ? iso.slice(0, 10) : null;
}

function mapStatus(jpStatus) {
  // JP: 1 = open/active, 2 = closed (observed on the Noblesville set).
  return jpStatus === 2 ? "closed" : "initiated";
}

function mapPriority(jpPriority) {
  // JP scale observed: 0 (none), 2, 3. Treat 1/2/3 as low/medium/high.
  switch (jpPriority) {
    case 1:
      return "low";
    case 2:
      return "medium";
    case 3:
      return "high";
    default:
      return null; // 0 / unknown
  }
}

function buildRow(item) {
  const status = mapStatus(item.status);
  const resolvedOn = realDateOrNull(item.resolvedOn);
  const workCompletedOn = realDateOrNull(item.workCompletedOn);

  return {
    project_id: APP_PROJECT_ID,
    number: parseInt(String(item.itemNumber), 10),
    title: item.title || `Punch item ${item.itemNumber}`,
    description: item.notes || null,
    status,
    priority: mapPriority(item.priority),
    location: item.location || null,
    trade: item.category || null,
    assignee_company: item.assignedTo?.contactName || null,
    ball_in_court: item.ballInCourt?.contactName || null,
    due_date: dateOnlyOrNull(item.dueDate),
    date_resolved: resolvedOn,
    date_closed: status === "closed" ? workCompletedOn || resolvedOn : null,
    is_private: false,
    is_deleted: false,
    source_system: "jobplanner",
    jobplanner_punchlist_item_id: item.punchlistItemId,
    created_at: realDateOrNull(item.createdOn) || new Date().toISOString(),
    updated_at: realDateOrNull(item.modifiedOn) || new Date().toISOString(),
  };
}

async function main() {
  console.log(
    `Importing Job Planner punch list: JP project ${JP_PROJECT_ID} -> app project ${APP_PROJECT_ID}${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  const list = await jpGet(`/projects/${JP_PROJECT_ID}/punchlists`);
  if (!Array.isArray(list) || list.length === 0) {
    console.log("No punch-list items returned from Job Planner. Nothing to import.");
    return;
  }
  console.log(`Job Planner returned ${list.length} punch-list items.`);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Existing JP-sourced rows for this project -> idempotency map.
  const { data: existing, error: readErr } = await supabase
    .from("punch_items")
    .select("id, jobplanner_punchlist_item_id")
    .eq("project_id", APP_PROJECT_ID)
    .eq("source_system", "jobplanner");
  if (readErr) {
    throw new Error(`Failed to read existing punch items: ${readErr.message}`);
  }
  const byJpId = new Map(
    (existing ?? [])
      .map((r) => [r.jobplanner_punchlist_item_id, r.id])
      .filter(([k]) => k != null),
  );

  let inserted = 0;
  let updated = 0;

  for (const item of list) {
    const row = buildRow(item);
    const existingId = byJpId.get(row.jobplanner_punchlist_item_id);
    const label = `#${item.itemNumber} "${row.title.slice(0, 40)}" [${row.status}/${row.priority ?? "-"}] assignee="${row.assignee_company ?? ""}"`;

    if (DRY_RUN) {
      console.log(`  ${existingId ? "UPDATE" : "INSERT"} ${label}`);
      existingId ? updated++ : inserted++;
      continue;
    }

    if (existingId) {
      const { error } = await supabase.from("punch_items").update(row).eq("id", existingId);
      if (error) throw new Error(`Update failed for ${label}: ${error.message}`);
      updated++;
      console.log(`  UPDATED ${label}`);
    } else {
      const { error } = await supabase.from("punch_items").insert(row);
      if (error) throw new Error(`Insert failed for ${label}: ${error.message}`);
      inserted++;
      console.log(`  INSERTED ${label}`);
    }
  }

  console.log(`\nDone. inserted=${inserted} updated=${updated} (JP project ${JP_PROJECT_ID}).`);
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
