#!/usr/bin/env node

/**
 * Create budget_lines for change-scope cost codes introduced by JobPlanner change
 * requests but absent from the project's base budget.
 *
 * WHY THIS EXISTS
 * A change request routinely adds scope at cost codes the original budget never had a
 * `budget_lines` row for. `backfill-change-event-budget-codes.mjs` then can't link those
 * change_event_line_items / pco_line_items (it reports `no_budget_line`), so the budget
 * code renders blank even though the line's dollars are correct. This script creates the
 * missing budget_lines (and the project_budget_codes they need) for exactly those codes,
 * after which the standard backfill links everything.
 *
 * SCOPE / SAFETY
 * - MONEY-DOMAIN WRITE. It creates budget_lines at `original_amount = 0` (a budget line
 *   with no baseline value — the change order carries the dollars, not the budget line),
 *   so project budget totals are unchanged.
 * - Only creates for (cost_code, cost_type) pairs that (a) a JP-imported change_event_line
 *   references AND (b) have no existing budget_line in the project. Never touches existing
 *   budget_lines. Idempotent: re-running creates nothing once the lines exist.
 * - Resolution is identical to backfill-change-event-budget-codes.mjs: JP 6-digit code ->
 *   cost_codes.id "NN-NNNN"; JP cost type .code -> cost_code_types.id. Unresolved pairs are
 *   reported, never guessed.
 *
 * After this runs with --apply, run:
 *   node scripts/jobplanner/backfill-change-event-budget-codes.mjs --jp=<id> --app=<id> --apply
 *
 * Usage:
 *   node scripts/jobplanner/create-change-scope-budget-lines.mjs --jp=9299 --app=1067          # DRY RUN
 *   node scripts/jobplanner/create-change-scope-budget-lines.mjs --jp=9299 --app=1067 --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const argValue = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const JP_PROJECT_ID = Number(argValue("jp"));
const APP_PROJECT_ID = Number(argValue("app"));
if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Required: --jp=<jobplannerProjectId> --app=<appProjectId> [--apply]");
  process.exit(1);
}

const API_V2 = "https://api-v2.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!JP_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing JOBPLANNER_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
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

  const [changeRequests, jpCostCodes, jpCostTypes] = await Promise.all([
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/changerequests`),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costcodes`).catch(() => []),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costtypes`).catch(() => []),
  ]);
  const jpCodeById = new Map(jpCostCodes.map((c) => [c.id, c]));
  const jpTypeCodeById = new Map(jpCostTypes.map((t) => [t.id, t.code]));

  const { data: ctRows } = await sb.from("cost_code_types").select("id, code");
  const costTypeIdByCode = new Map((ctRows ?? []).map((r) => [r.code, r.id]));
  const { data: ccRows } = await sb.from("cost_codes").select("id, title");
  const codeTitleById = new Map((ccRows ?? []).map((r) => [r.id, r.title]));

  const { data: blRows } = await sb
    .from("budget_lines")
    .select("cost_code_id, cost_type_id")
    .eq("project_id", APP_PROJECT_ID);
  const budgetLineKeys = new Set((blRows ?? []).map((r) => `${r.cost_code_id}|${r.cost_type_id}`));

  const { data: pbcRows } = await sb
    .from("project_budget_codes")
    .select("id, cost_code_id, cost_type_id")
    .eq("project_id", APP_PROJECT_ID);
  const pbcByKey = new Map((pbcRows ?? []).map((r) => [`${r.cost_code_id}|${r.cost_type_id}`, r.id]));

  // Which (cost_code, cost_type) pairs do JP-imported CE lines still reference with no budget_line?
  const { data: ceRows } = await sb
    .from("change_events")
    .select("id")
    .eq("project_id", APP_PROJECT_ID)
    .not("jobplanner_id", "is", null)
    .is("deleted_at", null);
  const ceIds = (ceRows ?? []).map((r) => r.id);
  const { data: celiRows } = await sb
    .from("change_event_line_items")
    .select("jobplanner_id, budget_line_id")
    .in("change_event_id", ceIds.length ? ceIds : [ZERO_UUID])
    .not("jobplanner_id", "is", null);
  const neededJpLineIds = new Set(
    (celiRows ?? []).filter((r) => !r.budget_line_id).map((r) => String(r.jobplanner_id)),
  );

  const missing = new Map(); // key -> { costCodeId, costTypeId }
  const unresolved = [];
  for (const cr of changeRequests) {
    for (const li of Array.isArray(cr.lineItems) ? cr.lineItems : []) {
      if (!neededJpLineIds.has(String(li.id))) continue;
      const jpCode = jpCodeById.get(li.costCodeId);
      const dashed = jpCode ? dashCostCode(jpCode.code) : null;
      const typeCode = jpTypeCodeById.get(li.costTypeId);
      const costTypeId = typeCode ? costTypeIdByCode.get(typeCode) : null;
      if (!dashed || !costTypeId) {
        unresolved.push({ cr: cr.number, jpLine: li.id, dashed, typeCode: typeCode ?? null });
        continue;
      }
      const key = `${dashed}|${costTypeId}`;
      if (budgetLineKeys.has(key)) continue; // budget_line already exists
      if (!missing.has(key)) missing.set(key, { costCodeId: dashed, costTypeId, typeCode });
    }
  }

  const plan = [...missing.values()].map((m) => ({
    costCode: m.costCodeId,
    type: m.typeCode,
    title: codeTitleById.get(m.costCodeId) ?? null,
    pbcExists: pbcByKey.has(`${m.costCodeId}|${m.costTypeId}`),
    codeKnown: codeTitleById.has(m.costCodeId),
  }));

  console.log(`\n=== Create change-scope budget_lines  JP ${JP_PROJECT_ID} -> app ${APP_PROJECT_ID}  (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`unlinked JP CE lines: ${neededJpLineIds.size} | distinct missing budget-code pairs: ${missing.size}`);
  if (plan.length) console.table(plan);
  if (unresolved.length) { console.log(`unresolved (no cost code/type — skipped):`); console.table(unresolved); }

  const blocked = plan.filter((p) => !p.codeKnown);
  if (blocked.length) {
    console.error(`\nABORT: ${blocked.length} cost code(s) not found in cost_codes (needed for NOT-NULL pbc.description). Fix cost_codes first.`);
    console.table(blocked);
    process.exit(2);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes. --apply would create ${missing.size} budget_lines (+ pbc as needed).`);
    return;
  }

  let createdBl = 0, createdPbc = 0;
  for (const m of missing.values()) {
    const key = `${m.costCodeId}|${m.costTypeId}`;
    let pbcId = pbcByKey.get(key);
    if (!pbcId) {
      const { data, error } = await sb
        .from("project_budget_codes")
        .insert({
          project_id: APP_PROJECT_ID,
          cost_code_id: m.costCodeId,
          cost_type_id: m.costTypeId,
          description: codeTitleById.get(m.costCodeId), // NOT NULL — canonical cost code title
        })
        .select("id")
        .single();
      if (error) throw new Error(`create pbc ${m.costCodeId}/${m.typeCode}: ${error.message}`);
      pbcId = data.id;
      pbcByKey.set(key, pbcId);
      createdPbc++;
    }
    // budget_line: trigger fills cost_code_id/cost_type_id/description from the pbc.
    // sub_job_key is a GENERATED column (from sub_job_id -> zero-UUID when null) — omit it.
    const { error: blErr } = await sb.from("budget_lines").insert({
      project_id: APP_PROJECT_ID,
      project_budget_code_id: pbcId,
      original_amount: 0,
    });
    if (blErr) throw new Error(`create budget_line ${m.costCodeId}/${m.typeCode}: ${blErr.message}`);
    createdBl++;
  }
  console.log(`\nAPPLIED: budget_lines created=${createdBl}, project_budget_codes created=${createdPbc}.`);
  console.log(`Next: node scripts/jobplanner/backfill-change-event-budget-codes.mjs --jp=${JP_PROJECT_ID} --app=${APP_PROJECT_ID} --apply`);
}

main().catch((e) => { console.error(e); process.exit(1); });
