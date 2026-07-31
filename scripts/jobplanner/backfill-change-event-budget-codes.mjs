#!/usr/bin/env node

/**
 * BACKFILL budget-code linkage on JP-imported change events (follow-up to
 * import-change-requests.mjs, which intentionally deferred it).
 *
 * WHY THIS EXISTS
 * The importer wrote change_event_line_items / pco_line_items with budget_code_id = null
 * because change_event_line_items.budget_code_id targets budget_lines.id (NOT
 * project_budget_codes.id) and the intended hop project_budget_codes.id -> budget_lines.id
 * runs through budget_lines.project_budget_code_id, which is unpopulated on these projects.
 *
 * THE UNBLOCK (verified live 2026-07-09): budget_lines carries the SAME natural key as
 * project_budget_codes -> (cost_code_id, cost_type_id) -- fully populated and UNIQUE per
 * project. So we skip the dead bridge and resolve the JP line's cost code + type straight
 * to budget_lines.id.
 *
 * WRITE SHAPE (verified against live FKs/triggers):
 *   - change_event_line_items: set budget_line_id = budget_lines.id. Trigger
 *     sync_change_event_line_item_budget_line_alias mirrors it into the legacy
 *     budget_code_id automatically (and raises if they disagree).
 *   - pco_line_items.budget_code_id has NO FK but the existing convention is
 *     budget_lines.id (3/3 populated rows match budget_lines, 0 match project_budget_codes),
 *     so we write budget_lines.id there too.
 *
 * Matches importer conventions: JP 6-digit cost code "013144" -> cost_codes.id "01-3144";
 * JP cost type letter (by .code) -> cost_code_types.id. Rows only get touched when their JP
 * cost code + type resolve to exactly one budget_lines.id for the project; unresolved rows
 * are reported, never guessed.
 *
 * DEFAULT MODE IS DRY-RUN. --apply executes. Idempotent: only fills rows whose linkage is
 * still null.
 *
 * Usage:
 *   node scripts/jobplanner/backfill-change-event-budget-codes.mjs --jp=5092 --app=25125
 *   node scripts/jobplanner/backfill-change-event-budget-codes.mjs --jp=5092 --app=25125 --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const argValue = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const JP_PROJECT_ID = Number(argValue("jp", NaN));
const APP_PROJECT_ID = Number(argValue("app", NaN));
if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Required: --jp=<jobplannerProjectId> --app=<appProjectId>");
  process.exit(1);
}

const API_V2 = "https://api-v2.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!JP_KEY) { console.error("Missing JOBPLANNER_API_KEY"); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

const dashCostCode = (code) => {
  const s = String(code ?? "").trim();
  return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : null;
};

async function jpGet(url) {
  const res = await fetch(url, { headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Job Planner ${res.status} on ${url.replace(API_V2, "")}`);
  return res.json();
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ---- JP source: CR line items carry the cost code + type; celi.jobplanner_id === line.id ----
  const [changeRequests, jpCostCodes, jpCostTypes] = await Promise.all([
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/changerequests`),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costcodes`).catch(() => []),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costtypes`).catch(() => []),
  ]);
  const jpCodeById = new Map(jpCostCodes.map((c) => [c.id, c]));
  const jpTypeCodeById = new Map(jpCostTypes.map((t) => [t.id, t.code]));

  // ---- App reference maps ----
  const { data: ctRows } = await sb.from("cost_code_types").select("id, code");
  const costTypeIdByCode = new Map((ctRows ?? []).map((r) => [r.code, r.id]));
  const { data: blRows, error: blErr } = await sb
    .from("budget_lines")
    .select("id, cost_code_id, cost_type_id, sub_job_id, description")
    .eq("project_id", APP_PROJECT_ID);
  if (blErr) throw new Error(`budget_lines read: ${blErr.message}`);
  // (cost_code_id, cost_type_id) is unique per project -> single budget line per key
  const budgetLineByKey = new Map((blRows ?? []).map((r) => [`${r.cost_code_id}|${r.cost_type_id}`, r]));

  // JP line id -> resolution result {budgetLineId, dashed, typeCode, reason}
  const resolveLine = (li) => {
    const jpCode = jpCodeById.get(li.costCodeId);
    const dashed = jpCode ? dashCostCode(jpCode.code) : null;
    if (!dashed) return { reason: "no_cost_code", dashed: null };
    const typeCode = jpTypeCodeById.get(li.costTypeId);
    const costTypeId = typeCode ? costTypeIdByCode.get(typeCode) : null;
    if (!costTypeId) return { reason: "no_cost_type", dashed, typeCode: typeCode ?? null };
    const bl = budgetLineByKey.get(`${dashed}|${costTypeId}`);
    if (!bl) return { reason: "no_budget_line", dashed, typeCode };
    return { budgetLineId: bl.id, dashed, typeCode, blDesc: bl.description };
  };

  const lineResById = new Map();
  for (const cr of changeRequests) {
    for (const li of Array.isArray(cr.lineItems) ? cr.lineItems : []) {
      lineResById.set(String(li.id), { cr: cr.number, li, res: resolveLine(li) });
    }
  }

  // ---- Target rows: JP-imported lines still missing budget linkage ----
  const { data: ceRows } = await sb
    .from("change_events")
    .select("id, number")
    .eq("project_id", APP_PROJECT_ID)
    .not("jobplanner_id", "is", null)
    .is("deleted_at", null);
  const ceIds = (ceRows ?? []).map((r) => r.id);
  const ceNumById = new Map((ceRows ?? []).map((r) => [r.id, r.number]));

  const { data: celiRows } = await sb
    .from("change_event_line_items")
    .select("id, change_event_id, jobplanner_id, budget_line_id, budget_code_id, description")
    .in("change_event_id", ceIds.length ? ceIds : ["00000000-0000-0000-0000-000000000000"])
    .not("jobplanner_id", "is", null);

  const { data: pliRows } = await sb
    .from("pco_line_items")
    .select("id, change_event_id, jobplanner_id, budget_code_id, description")
    .in("change_event_id", ceIds.length ? ceIds : ["00000000-0000-0000-0000-000000000000"])
    .not("jobplanner_id", "is", null);

  // ---- Plan + report ----
  const report = { celi: { total: 0, alreadyLinked: 0, resolved: 0, unresolved: [] },
                   pli: { total: 0, alreadyLinked: 0, resolved: 0, unresolved: [] } };
  const celiUpdates = [];
  for (const row of celiRows ?? []) {
    report.celi.total++;
    if (row.budget_line_id) { report.celi.alreadyLinked++; continue; }
    const entry = lineResById.get(String(row.jobplanner_id));
    if (entry?.res?.budgetLineId) {
      report.celi.resolved++;
      celiUpdates.push({ id: row.id, budgetLineId: entry.res.budgetLineId,
        note: `${ceNumById.get(row.change_event_id)} ${entry.res.dashed}/${entry.res.typeCode} -> ${entry.res.blDesc}` });
    } else {
      report.celi.unresolved.push({ ce: ceNumById.get(row.change_event_id), jpLine: row.jobplanner_id,
        desc: (row.description || "").slice(0, 40), reason: entry?.res?.reason ?? "no_jp_line",
        dashed: entry?.res?.dashed ?? null, typeCode: entry?.res?.typeCode ?? null });
    }
  }
  const pliUpdates = [];
  for (const row of pliRows ?? []) {
    report.pli.total++;
    if (row.budget_code_id) { report.pli.alreadyLinked++; continue; }
    const entry = lineResById.get(String(row.jobplanner_id));
    if (entry?.res?.budgetLineId) {
      report.pli.resolved++;
      pliUpdates.push({ id: row.id, budgetLineId: entry.res.budgetLineId });
    } else {
      report.pli.unresolved.push({ ce: ceNumById.get(row.change_event_id), jpLine: row.jobplanner_id,
        reason: entry?.res?.reason ?? "no_jp_line", dashed: entry?.res?.dashed ?? null });
    }
  }

  console.log(`\n=== Budget-code backfill  JP ${JP_PROJECT_ID} -> app ${APP_PROJECT_ID}  (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`budget_lines in project: ${blRows?.length ?? 0}   JP CR lines: ${lineResById.size}`);
  console.log(`\nchange_event_line_items: total=${report.celi.total} alreadyLinked=${report.celi.alreadyLinked} resolvable=${report.celi.resolved} unresolved=${report.celi.unresolved.length}`);
  console.log(`pco_line_items:          total=${report.pli.total} alreadyLinked=${report.pli.alreadyLinked} resolvable=${report.pli.resolved} unresolved=${report.pli.unresolved.length}`);
  if (report.celi.unresolved.length) {
    console.log(`\n-- unresolved change_event_line_items --`);
    console.table(report.celi.unresolved);
  }
  if (report.pli.unresolved.length) {
    console.log(`\n-- unresolved pco_line_items --`);
    console.table(report.pli.unresolved);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes. Re-run with --apply to link ${celiUpdates.length} celi + ${pliUpdates.length} pco lines.`);
    return;
  }

  let celiDone = 0, pliDone = 0;
  for (const u of celiUpdates) {
    // Set budget_line_id; the alias trigger mirrors it into budget_code_id.
    const { error } = await sb.from("change_event_line_items").update({ budget_line_id: u.budgetLineId }).eq("id", u.id);
    if (error) throw new Error(`celi ${u.id} update: ${error.message}`);
    celiDone++;
  }
  for (const u of pliUpdates) {
    const { error } = await sb.from("pco_line_items").update({ budget_code_id: u.budgetLineId }).eq("id", u.id);
    if (error) throw new Error(`pco_line_items ${u.id} update: ${error.message}`);
    pliDone++;
  }
  console.log(`\nAPPLIED: change_event_line_items linked=${celiDone}, pco_line_items linked=${pliDone}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
