#!/usr/bin/env node

/**
 * JOB PLANNER change-management import (change requests -> change events + PCOs).
 *
 * Job Planner's change request (CR) is the parent of the whole change-management
 * chain: each CR line item forks to a prime change order (`pccoId`) or a commitment
 * change order (`ccoId`). Importing COs without their CRs orphans them; importing CRs
 * blindly DUPLICATES change events an operator already hand-entered.
 *
 * DEFAULT MODE IS DRY-RUN (no writes). It fetches JP change requests / PCCOs / CCOs for a
 * project, loads the app's existing change_events (+ line items) and Acumatica-owned
 * executed COs, runs the three-tier matcher, and emits an ADOPT / CREATE / FLAG report.
 * With --apply it executes those decisions.
 *
 * Match tiers for each JP CR against existing app change_events (same project):
 *   1. jobplanner_id already stamped        -> ADOPT (re-run/update-in-place)
 *   2. trailing-sequence match (last 4)     -> ADOPT if title/amount corroborate, else FLAG
 *   3. no seq match                         -> strong title+amount elsewhere = FLAG, else CREATE
 * Existing CEs that no JP CR matches are reported as "app-only" (left untouched).
 *
 * Executed COs (contract_change_orders / prime_contract_change_orders) are Acumatica-owned.
 * We NEVER write there — we only LINK a PCO's promoted_to_co_id to a confident amount-twin.
 *
 * JP endpoints (V2, browser UA required — Cloudflare blocks default UAs):
 *   change requests (w/ lineItems)  GET /projects/{jp}/changerequests
 *   commitment change orders        GET /projects/{jp}/commitmentchangeorders
 *   prime contract change orders    GET /projects/{jp}/primecontractchangeorders
 *   cost codes / cost types         GET /projects/{jp}/costcodes | /costtypes
 *
 * Mapping (identical chain to import-commitments.mjs):
 *   - JP amounts are CENTS -> app columns store DOLLARS (/100).
 *   - JP 6-digit cost code "013144" -> cost_codes.id "01-3144".
 *   - JP cost type L/E/M/S/X (by .code) -> cost_code_types.id.
 *   - budget code = one project_budget_codes per (project, sub_job_key=zeroUUID,
 *     cost_code_id, cost_type_id); upsert on uq_project_budget_code.
 *   - deducts: JP stores negatives; ADOPT never overwrites an existing CE amount.
 *
 * Usage:
 *   node scripts/jobplanner/import-change-requests.mjs --jp=5092 --app=25125            # DRY RUN
 *   node scripts/jobplanner/import-change-requests.mjs --jp=5092 --app=25125 --apply     # execute
 *
 * Flags:
 *   --jp=<id>    Job Planner projectId (required)
 *   --app=<id>   PM app projects.id INTEGER (required)
 *   --apply      Execute writes (default: dry run)
 *   --out=<path> Report JSON path (a sibling .md is written alongside)
 *
 * Writes obey the reconcile decisions: ADOPT updates the existing CE row in place (stamp
 * jobplanner_id, backfill missing linkage) and reconciles its line against the JP line;
 * CREATE inserts a new CE under the JP number; FLAG is skipped (left for a human).
 */

import fs from "node:fs";
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

const APPLY = process.argv.includes("--apply");
const argValue = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const JP_PROJECT_ID = Number(argValue("jp", NaN));
const APP_PROJECT_ID = Number(argValue("app", NaN));
const OUT = argValue(
  "out",
  path.join(
    repoRoot,
    `docs/ops/evidence/2026-07-09-jobplanner-change-management-import/reconcile-${JP_PROJECT_ID}-${APP_PROJECT_ID}.json`,
  ),
);
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

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const centsToDollars = (c) => Math.round(Number(c) || 0) / 100;
const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dashCostCode = (code) => {
  const s = String(code ?? "").trim();
  return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : null;
};
const seqOf = (num) => {
  const digits = String(num ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return String(Number(digits.slice(-4)));
};
const normTitle = (t) => String(t ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const titleSim = (a, b) => {
  const A = new Set(normTitle(a).split(" ").filter(Boolean));
  const B = new Set(normTitle(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / new Set([...A, ...B]).size;
};
// non-zero amount within $1 or 1%; a $0==$0 "match" is NOT corroboration
const amountCorroborates = (a, b) => {
  const da = Number(a) || 0, db = Number(b) || 0;
  if (da === 0 && db === 0) return false;
  return Math.abs(da - db) <= Math.max(1, Math.abs(da) * 0.01);
};
const amountTwin = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) <= Math.max(1, Math.abs(Number(a) || 0) * 0.01);

async function jpGet(url) {
  const res = await fetch(url, { headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Job Planner ${res.status} on ${url.replace(API_V2, "")}`);
  return res.json();
}

function commitmentKindFromNumber(num) {
  const s = String(num || "");
  if (s.startsWith("SC")) return "subcontract";
  if (s.startsWith("PO")) return "purchase_order";
  return null;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ---- JP source ----
  const [changeRequests, jpCcos, jpPccos, jpCostCodes, jpCostTypes] = await Promise.all([
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/changerequests`),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/commitmentchangeorders`).catch(() => []),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/primecontractchangeorders`).catch(() => []),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costcodes`).catch(() => []),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costtypes`).catch(() => []),
  ]);
  const jpCodeById = new Map(jpCostCodes.map((c) => [c.id, c]));
  const jpTypeCodeById = new Map(jpCostTypes.map((t) => [t.id, t.code]));
  const ccoById = new Map(jpCcos.map((c) => [c.id, c]));
  const pccoById = new Map(jpPccos.map((p) => [p.id, p]));

  // The list endpoints return change-order HEADERS without line items. A JP change order
  // has its OWN line items — including lines added directly on the CO (no change-request
  // line behind them) and CO-level amounts — which is the authoritative source for
  // pco_line_items. Only the detail endpoint returns them, so hydrate every header here.
  async function attachCoLines(headers, seg) {
    await Promise.all(
      (headers ?? []).map(async (h) => {
        try {
          const detail = await jpGet(`${API_V2}/${seg}/${h.id}`);
          h.lineItems = Array.isArray(detail?.lineItems) ? detail.lineItems : [];
        } catch {
          h.lineItems = [];
        }
      }),
    );
  }
  await attachCoLines(jpPccos, "primecontractchangeorders");
  await attachCoLines(jpCcos, "commitmentchangeorders");

  // ---- App reference maps for cost-code -> budget-code resolution ----
  const { data: ctRows } = await sb.from("cost_code_types").select("id, code");
  const costTypeIdByCode = new Map((ctRows ?? []).map((r) => [r.code, r.id]));
  const { data: ccRows } = await sb.from("cost_codes").select("id");
  const costCodeIds = new Set((ccRows ?? []).map((r) => r.id));
  const { data: pbcRows } = await sb
    .from("project_budget_codes")
    .select("id, cost_code_id, cost_type_id")
    .eq("project_id", APP_PROJECT_ID);
  const budgetCodeByKey = new Map((pbcRows ?? []).map((r) => [`${r.cost_code_id}|${r.cost_type_id}`, r.id]));

  // resolve (jp cost code id, jp cost type id) -> project_budget_codes.id, creating as needed
  async function resolveBudgetCode(jpCostCodeId, jpCostTypeId) {
    const jpCode = jpCodeById.get(jpCostCodeId);
    const dashed = jpCode ? dashCostCode(jpCode.code) : null;
    if (!dashed || !costCodeIds.has(dashed)) return { budgetCodeId: null, costCodeId: dashed };
    const typeCode = jpTypeCodeById.get(jpCostTypeId);
    const costTypeId = typeCode ? costTypeIdByCode.get(typeCode) : null;
    if (!costTypeId) return { budgetCodeId: null, costCodeId: dashed };
    const key = `${dashed}|${costTypeId}`;
    if (budgetCodeByKey.has(key)) return { budgetCodeId: budgetCodeByKey.get(key), costCodeId: dashed };
    if (!APPLY) return { budgetCodeId: "(would-create)", costCodeId: dashed };
    const { data: created, error } = await sb
      .from("project_budget_codes")
      .upsert(
        { project_id: APP_PROJECT_ID, sub_job_id: null, cost_code_id: dashed, cost_type_id: costTypeId, description_mode: "concatenated" },
        { onConflict: "project_id,sub_job_key,cost_code_id,cost_type_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`budget code upsert (${dashed}/${typeCode}): ${error.message}`);
    budgetCodeByKey.set(key, created.id);
    return { budgetCodeId: created.id, costCodeId: dashed };
  }

  // ---- App existing change events (+ line items) ----
  const { data: ceRows, error: ceErr } = await sb
    .from("change_events")
    .select("id, number, title, status, scope, type, prime_contract_id, jobplanner_id")
    .eq("project_id", APP_PROJECT_ID)
    .is("deleted_at", null);
  if (ceErr) throw new Error(`change_events read: ${ceErr.message}`);
  const existing = [];
  for (const ce of ceRows ?? []) {
    const { data: li } = await sb
      .from("change_event_line_items")
      .select("id, cost_rom, revenue_rom, budget_code_id, jobplanner_id")
      .eq("change_event_id", ce.id);
    const cost = (li ?? []).reduce((s, r) => s + (Number(r.cost_rom) || 0), 0);
    existing.push({ ...ce, seq: seqOf(ce.number), lines: li ?? [], cost });
  }

  // ---- Acumatica-owned executed COs (twin coverage only) ----
  const { data: coCommit } = await sb
    .from("contract_change_orders")
    .select("id, change_order_number, amount")
    .eq("project_id", APP_PROJECT_ID);
  const { data: coPrime } = await sb
    .from("prime_contract_change_orders")
    .select("id, pcco_number, total_amount")
    .eq("project_id", APP_PROJECT_ID);

  // ---- Resolve app prime contract + commitments for FK targets ----
  const { data: primeRows } = await sb.from("prime_contracts").select("id, contract_number").eq("project_id", APP_PROJECT_ID);
  const primeIdByNumber = new Map((primeRows ?? []).map((r) => [String(r.contract_number), r.id]));
  const primeIdSingle = (primeRows ?? []).length === 1 ? primeRows[0].id : null;
  const { data: scRows } = await sb.from("subcontracts").select("id, contract_number").eq("project_id", APP_PROJECT_ID).is("deleted_at", null);
  const { data: poRows } = await sb.from("purchase_orders").select("id, contract_number").eq("project_id", APP_PROJECT_ID).is("deleted_at", null);
  const commitmentByNumber = new Map();
  for (const r of scRows ?? []) commitmentByNumber.set(String(r.contract_number), { id: r.id, type: "subcontract" });
  for (const r of poRows ?? []) commitmentByNumber.set(String(r.contract_number), { id: r.id, type: "purchase_order" });

  // ---- Reconcile each JP change request ----
  const matchedExistingIds = new Set();
  const decisions = changeRequests.map((cr) => {
    const crSeq = seqOf(cr.number);
    const lines = Array.isArray(cr.lineItems) ? cr.lineItems : [];
    const liCost = lines.reduce((s, li) => s + (Number(li.amount) || 0), 0);
    const crCost = centsToDollars(liCost || cr.amount);

    // Tier 1: jobplanner_id already stamped
    const byJp = existing.find((e) => e.jobplanner_id === cr.id);
    let decision, candidate = null, reason;
    if (byJp) {
      decision = "ADOPT"; candidate = byJp; reason = `jobplanner_id ${cr.id} already linked to ${byJp.number}`;
    } else {
      const seqHits = existing.filter((e) => e.seq && crSeq && e.seq === crSeq && !matchedExistingIds.has(e.id));
      if (seqHits.length) {
        candidate = seqHits.map((e) => ({ e, sim: titleSim(cr.title, e.title) })).sort((a, b) => b.sim - a.sim)[0].e;
        const sim = titleSim(cr.title, candidate.title);
        const amtOk = amountCorroborates(crCost, candidate.cost);
        if (sim >= 0.4 || amtOk) {
          decision = "ADOPT";
          reason = `seq ${crSeq} == ${candidate.number}; ${amtOk ? "amount corroborates" : `amountΔ ${money(crCost - candidate.cost)}`}; titleSim ${sim.toFixed(2)}`;
        } else {
          decision = "FLAG"; candidate = null;
          reason = `seq ${crSeq} matches ${seqHits[0].number} but title (sim ${sim.toFixed(2)}) AND amount both diverge — verify manually`;
        }
      } else {
        const scored = existing
          .filter((e) => !matchedExistingIds.has(e.id))
          .map((e) => ({ e, sim: titleSim(cr.title, e.title), amtOk: amountCorroborates(crCost, e.cost) }))
          .sort((a, b) => b.sim - a.sim)[0];
        if (scored && scored.sim >= 0.7 && scored.amtOk) {
          decision = "FLAG"; candidate = null;
          reason = `no seq match, but "${scored.e.number}" is a strong title+amount match (sim ${scored.sim.toFixed(2)}) — possible renumber, verify`;
        } else {
          decision = "CREATE";
          reason = `no existing change event matches seq ${crSeq}, title, or amount`;
        }
      }
    }
    if (candidate) matchedExistingIds.add(candidate.id);

    const primeLines = lines.filter((l) => l.pccoId).length;
    const commitLines = lines.filter((l) => l.ccoId).length;
    const unlinked = lines.filter((l) => !l.pccoId && !l.ccoId).length;

    return {
      jpChangeRequestId: cr.id,
      number: cr.number,
      title: cr.title,
      statusId: cr.statusId,
      primeContractNumber: cr.primeContractNumber ?? null,
      cost: crCost,
      lineItems: lines.length,
      fork: { prime: primeLines, commitment: commitLines, unlinked },
      decision,
      reason,
      matchedExisting: candidate ? { id: candidate.id, number: candidate.number, cost: candidate.cost, lineCount: candidate.lines.length } : null,
      _cr: cr,
      _candidate: candidate,
    };
  });

  const appOnly = existing
    .filter((e) => !matchedExistingIds.has(e.id))
    .map((e) => ({ id: e.id, number: e.number, title: e.title, cost: e.cost, lineCount: e.lines.length }));

  // ---- executed-CO twin coverage ----
  const ccoTwins = jpCcos.map((c) => {
    const amt = centsToDollars(c.totalAmount ?? c.amount);
    const twin = (coCommit ?? []).find((x) => amountTwin(amt, x.amount));
    return { number: c.number, amount: amt, twinId: twin ? twin.id : null };
  });
  const pccoTwins = jpPccos.map((p) => {
    const amt = centsToDollars(p.totalAmount ?? p.amount);
    const twin = (coPrime ?? []).find((x) => amountTwin(amt, x.total_amount));
    return { number: p.number, amount: amt, twinId: twin ? twin.id : null };
  });
  const ccoTwinByNumber = new Map(ccoTwins.map((t) => [t.number, t.twinId]));
  const pccoTwinByNumber = new Map(pccoTwins.map((t) => [t.number, t.twinId]));

  const writes = { ceAdopted: 0, ceCreated: 0, ceLines: 0, primePcos: 0, commitPcos: 0, pcoLines: 0, ceLinks: 0, skippedFlags: 0, warnings: [] };

  if (APPLY) {
    // status map: JP statusId 8 == executed/approved
    const ceStatus = (sid) => (sid === 8 ? "Approved" : "Open");
    const pcoStatus = (sid) => (sid === 8 ? "approved" : "pending");

    // Manual upsert keyed by an arbitrary match object — the partial unique indexes
    // (WHERE jobplanner_id IS NOT NULL) can't be ON CONFLICT arbiters, so
    // select-then-update/insert. `match` fields are written on insert.
    async function upsertByMatch(table, match, row, tag) {
      let q = sb.from(table).select("id");
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      const { data: found, error: selErr } = await q.maybeSingle();
      if (selErr) throw new Error(`${table} select ${tag}: ${selErr.message}`);
      if (found) {
        const { error } = await sb.from(table).update(row).eq("id", found.id);
        if (error) throw new Error(`${table} update ${tag}: ${error.message}`);
        return { id: found.id, created: false };
      }
      const { data, error } = await sb.from(table).insert({ ...row, ...match }).select("id").single();
      if (error) throw new Error(`${table} insert ${tag}: ${error.message}`);
      return { id: data.id, created: true };
    }
    const upsertByJp = (table, jpId, row, tag) => upsertByMatch(table, { jobplanner_id: jpId }, row, tag);

    // one PCO header per JP CCO / PCCO the CR lines reference, return app id
    const primePcoIdByJp = new Map();
    const commitPcoIdByJp = new Map();
    // JP change-request line item id -> app change_event_line_item.id (for linking CO lines
    // back to their originating CE line), and app PCO id -> owning change_event.id.
    const celiIdByCrLineId = new Map();
    const ceIdByPcoAppId = new Map();
    // CR cost lines that reference a commitment (subcontract) but have NO materialized JP
    // commitment change order (ccoId null) -> grouped per (change event, commitment) so a
    // commitment PCO can be SYNTHESIZED from them. Key: `${ceId}|${commitmentNumber}`.
    const synthCommitGroups = new Map();
    // (ceId|commitment_id) already covered by a materialized JP CCO -> don't also synthesize.
    const materializedCommitKeys = new Set();

    async function ensurePrimePco(pcco) {
      if (primePcoIdByJp.has(pcco.id)) return primePcoIdByJp.get(pcco.id);
      const primeId = pcco.primeContractNumber ? primeIdByNumber.get(String(pcco.primeContractNumber)) : primeIdSingle;
      if (!primeId) { writes.warnings.push(`PCCO ${pcco.number}: no app prime contract`); return null; }
      const row = {
        project_id: APP_PROJECT_ID, prime_contract_id: primeId,
        pco_number: pcco.number, title: pcco.description || pcco.number, description: pcco.description ?? null,
        // `amount` is the CO subtotal that ties to the sum of the CO line items' `amount`
        // (JP's line grid). `totalAmount` adds CO-level markup, which the app has no field
        // for; the PCO line sync recomputes this from the actual lines to stay consistent.
        total_amount: centsToDollars(pcco.amount ?? pcco.totalAmount), status: pcoStatus(pcco.statusId),
        executed: pcco.statusId === 8, promoted_to_co_id: pccoTwinByNumber.get(pcco.number) ?? null,
        change_reason: pcco.changeReason ?? null,
      };
      const { id, created } = await upsertByJp("prime_contract_pcos", pcco.id, row, pcco.number);
      if (created) writes.primePcos++;
      primePcoIdByJp.set(pcco.id, id); return id;
    }
    async function ensureCommitPco(cco) {
      if (commitPcoIdByJp.has(cco.id)) return commitPcoIdByJp.get(cco.id);
      const commit = cco.commitmentNumber ? commitmentByNumber.get(String(cco.commitmentNumber)) : null;
      if (!commit) { writes.warnings.push(`CCO ${cco.number}: no app commitment for ${cco.commitmentNumber}`); return null; }
      const row = {
        project_id: APP_PROJECT_ID, commitment_id: commit.id, commitment_type: commit.type,
        pco_number: cco.number, title: cco.description || cco.number, description: cco.description ?? null,
        total_amount: centsToDollars(cco.amount ?? cco.totalAmount), status: pcoStatus(cco.statusId),
        executed: cco.statusId === 8, promoted_to_co_id: ccoTwinByNumber.get(cco.number) ?? null,
        change_reason: cco.changeReason ?? null, contract_company: cco.contractedContact?.companyName ?? null,
      };
      const { id, created } = await upsertByJp("commitment_pcos", cco.id, row, cco.number);
      if (created) writes.commitPcos++;
      commitPcoIdByJp.set(cco.id, id); return id;
    }

    for (const d of decisions) {
      if (d.decision === "FLAG") { writes.skippedFlags++; continue; }
      const cr = d._cr;
      const primeId = cr.primeContractNumber ? primeIdByNumber.get(String(cr.primeContractNumber)) : primeIdSingle;

      // 1) change_events header (ADOPT update-in-place / CREATE insert)
      let ceId;
      if (d.decision === "ADOPT") {
        ceId = d._candidate.id;
        const patch = { jobplanner_id: cr.id };
        if (primeId) patch.prime_contract_id = primeId;
        patch.expecting_revenue = Number(cr.revenue || 0) > 0;
        const { error } = await sb.from("change_events").update(patch).eq("id", ceId);
        if (error) throw new Error(`change_events adopt ${cr.number}: ${error.message}`);
        writes.ceAdopted++;
      } else {
        const insert = {
          project_id: APP_PROJECT_ID, jobplanner_id: cr.id, number: cr.number,
          title: cr.title || cr.number, description: cr.description ?? null, type: "Owner Change",
          scope: "TBD", status: ceStatus(cr.statusId), prime_contract_id: primeId ?? null,
          expecting_revenue: Number(cr.revenue || 0) > 0, origin: "JobPlanner", origin_id: String(cr.id),
        };
        const { data, error } = await sb.from("change_events").insert(insert).select("id").single();
        if (error) throw new Error(`change_events create ${cr.number}: ${error.message}`);
        ceId = data.id; writes.ceCreated++;
      }

      // 2) line items + junctions.
      // Budget-code linkage is intentionally deferred to a follow-up backfill: on
      // change_event_line_items `budget_code_id` targets budget_lines.id (not
      // project_budget_codes.id) and is trigger-guarded to match budget_line_id, and
      // budget_lines.project_budget_code_id is unpopulated on these projects. The pilot
      // proves structure + no-dup; cost-code mapping is a separate slice.
      void resolveBudgetCode;
      const lines = Array.isArray(cr.lineItems) ? cr.lineItems : [];
      // Adopt: match a JP line to an existing CE line by jobplanner_id (re-run) first,
      // then consume any not-yet-claimed existing lines, then insert new ones. Stable.
      const claimed = new Set();
      const existingByJp = new Map((d.decision === "ADOPT" ? d._candidate.lines : []).filter((l) => l.jobplanner_id != null).map((l) => [String(l.jobplanner_id), l]));
      const unclaimed = (d.decision === "ADOPT" ? d._candidate.lines : []).filter((l) => l.jobplanner_id == null);
      let sort = 0;
      for (const li of lines) {
        const cco = li.ccoId ? ccoById.get(li.ccoId) : null;
        const pcco = li.pccoId ? pccoById.get(li.pccoId) : null;
        // Commitment linkage comes from the line's own commitmentNumber (the subcontract) —
        // it is set even when JobPlanner has NOT materialized a commitment change order
        // record (ccoId null, e.g. Playmakers). `cco` is only the materialized-CCO case.
        const commitInfo = li.commitmentNumber ? commitmentByNumber.get(String(li.commitmentNumber)) : null;

        const fields = {
          change_event_id: ceId, description: li.description ?? null, sort_order: sort,
          cost_rom: centsToDollars(li.amount), revenue_rom: centsToDollars(li.revenue),
          unit_cost: li.unitPrice != null ? centsToDollars(li.unitPrice) : null, quantity: li.quantity ?? null,
          budget_code_id: null, commitment_id: commitInfo?.id ?? null,
          commitment_type: commitInfo?.type ?? null, contract_id: primeId ?? null,
        };
        // pick an existing line to reuse (by jp id, else next unclaimed), else insert
        let reuse = existingByJp.get(String(li.id));
        if (!reuse) { while (unclaimed.length && claimed.has(unclaimed[0].id)) unclaimed.shift(); reuse = unclaimed.shift(); }
        let celiId;
        if (reuse) {
          claimed.add(reuse.id);
          const { error } = await sb.from("change_event_line_items").update({ ...fields, jobplanner_id: li.id }).eq("id", reuse.id);
          if (error) throw new Error(`celi reuse ${cr.number}: ${error.message}`);
          celiId = reuse.id;
        } else {
          const { id, created } = await upsertByJp("change_event_line_items", li.id, fields, cr.number);
          celiId = id; if (created) writes.ceLines++;
        }

        // Record CR-line -> celi so the PCO line sync (below) can link each change-order
        // line back to its originating change-event line.
        celiIdByCrLineId.set(String(li.id), celiId);

        // Commitment cost lines with NO materialized JP change order (ccoId null): group by
        // (change event, commitment) to synthesize a commitment PCO after the loop.
        if (!li.ccoId && commitInfo) {
          const key = `${ceId}|${li.commitmentNumber}`;
          let g = synthCommitGroups.get(key);
          if (!g) {
            g = { ceId, cr, commitmentNumber: String(li.commitmentNumber), commitInfo, lines: [] };
            synthCommitGroups.set(key, g);
          }
          g.lines.push({ li, celiId });
        }

        // Ensure the PCO header(s) this line forks to and one CE↔PCO link per side.
        // pco_line_items are NOT built from the CR fork here — a JP change order has its
        // OWN line items (incl. lines added directly on the CO, and CO-level amounts), so
        // they are synced from the change order after all CEs exist (see below).
        const forks = [];
        if (pcco) forks.push({ type: "prime", pcoId: await ensurePrimePco(pcco) });
        if (cco) forks.push({ type: "commitment", pcoId: await ensureCommitPco(cco) });
        if (cco && commitInfo) materializedCommitKeys.add(`${ceId}|${commitInfo.id}`);
        for (const f of forks) {
          if (!f.pcoId) continue;
          if (!ceIdByPcoAppId.has(f.pcoId)) ceIdByPcoAppId.set(f.pcoId, ceId);
          // one CE↔PCO link per (change_event, pco)
          const { data: existLink } = await sb.from("change_event_pco_links")
            .select("id").eq("change_event_id", ceId).eq("pco_id", f.pcoId).maybeSingle();
          if (!existLink) {
            const { error: lkErr } = await sb.from("change_event_pco_links")
              .insert({ change_event_id: ceId, pco_id: f.pcoId, pco_type: f.type });
            if (lkErr) throw new Error(`change_event_pco_links ${cr.number}: ${lkErr.message}`);
            writes.ceLinks++;
          }
        }
        sort++;
      }
    }

    // ---- PCO line items: rebuild from each change order's OWN line items ----
    // JobPlanner's change-order line grid is authoritative: it includes lines added
    // directly on the CO (e.g. contingency draws, no change-request line behind them) and
    // CO-level amounts. We replace any existing pco_line_items for each touched PCO with
    // the CO's actual lines, linking each back to its originating CE line via
    // changeRequestLineItemId when present, and resolving its budget code from its own
    // cost code. pco_line_items.budget_code_id follows budget_lines.id by convention.
    const { data: blRows } = await sb
      .from("budget_lines")
      .select("id, cost_code_id, cost_type_id")
      .eq("project_id", APP_PROJECT_ID);
    const budgetLineByKey = new Map((blRows ?? []).map((r) => [`${r.cost_code_id}|${r.cost_type_id}`, r.id]));
    const resolveBudgetLine = (jpCostCodeId, jpCostTypeId) => {
      const jpCode = jpCodeById.get(jpCostCodeId);
      const dashed = jpCode ? dashCostCode(jpCode.code) : null;
      const typeCode = jpTypeCodeById.get(jpCostTypeId);
      const costTypeId = typeCode ? costTypeIdByCode.get(typeCode) : null;
      if (!dashed || !costTypeId) return null;
      return budgetLineByKey.get(`${dashed}|${costTypeId}`) ?? null;
    };

    async function syncPcoLines(jpIdToAppId, headerById, pco_type) {
      const table = pco_type === "prime" ? "prime_contract_pcos" : "commitment_pcos";
      for (const [jpId, appPcoId] of jpIdToAppId) {
        if (!appPcoId) continue;
        const header = headerById.get(jpId);
        const coLines = Array.isArray(header?.lineItems) ? header.lineItems : [];
        const ceId = ceIdByPcoAppId.get(appPcoId) ?? null;
        // Replace this PCO's lines wholesale (idempotent re-sync).
        const { error: delErr } = await sb.from("pco_line_items").delete().eq("pco_id", appPcoId);
        if (delErr) throw new Error(`pco_line_items delete ${header?.number}: ${delErr.message}`);
        let sort = 0;
        let total = 0;
        for (const line of coLines) {
          const celiId =
            line.changeRequestLineItemId != null
              ? celiIdByCrLineId.get(String(line.changeRequestLineItemId)) ?? null
              : null;
          const amount = centsToDollars(line.amount);
          total += Number(amount) || 0;
          const { error } = await sb.from("pco_line_items").insert({
            pco_id: appPcoId, pco_type, change_event_id: ceId, change_event_line_item_id: celiId,
            budget_code_id: resolveBudgetLine(line.costCodeId, line.costTypeId),
            amount, unit_cost: line.unitPrice != null ? centsToDollars(line.unitPrice) : null,
            quantity: line.quantity ?? null, description: line.description ?? null,
            sort_order: line.sortOrder ?? sort, jobplanner_id: line.id,
          });
          if (error) throw new Error(`pco_line_items insert ${header?.number} L${line.id}: ${error.message}`);
          writes.pcoLines++; sort++;
        }
        // Keep the PCO header total consistent with the lines we just wrote (JP subtotal).
        const { error: upErr } = await sb.from(table).update({ total_amount: Number(total.toFixed(2)) }).eq("id", appPcoId);
        if (upErr) throw new Error(`${table} total ${header?.number}: ${upErr.message}`);
      }
    }
    await syncPcoLines(primePcoIdByJp, pccoById, "prime");
    await syncPcoLines(commitPcoIdByJp, ccoById, "commitment");

    // ---- Synthesized commitment PCOs (JobPlanner has NO materialized change order) ----
    // A change request's cost lines can be assigned to a commitment (subcontract) without a
    // materialized JP commitment change order (ccoId null). JobPlanner shows these in the
    // change request SOV's "Commitment" column; the app models them as one commitment PCO
    // per (change event, commitment). Create/rebuild those here from the grouped cost lines.
    for (const g of synthCommitGroups.values()) {
      // If a real JP CCO already covers this commitment for this CE, don't duplicate it.
      if (materializedCommitKeys.has(`${g.ceId}|${g.commitInfo.id}`)) continue;
      const commitTail = String(g.commitmentNumber).split("-").pop(); // e.g. "0002"
      const pcoNumber = `${g.cr.number}-${commitTail}`; // deterministic, e.g. "CR-9299-0030-0002"
      const total = g.lines.reduce((a, { li }) => a + (Number(centsToDollars(li.amount)) || 0), 0);
      const { id: pcoId, created } = await upsertByMatch(
        "commitment_pcos",
        { project_id: APP_PROJECT_ID, pco_number: pcoNumber },
        {
          commitment_id: g.commitInfo.id, commitment_type: g.commitInfo.type,
          title: g.cr.title || g.cr.number, description: g.cr.description ?? null,
          total_amount: Number(total.toFixed(2)), status: pcoStatus(g.cr.statusId),
          change_reason: g.cr.changeReason ?? null,
        },
        pcoNumber,
      );
      if (created) writes.commitPcos++;
      // Rebuild the synthesized PCO's lines from the CR cost lines (idempotent).
      const { error: delErr } = await sb.from("pco_line_items").delete().eq("pco_id", pcoId);
      if (delErr) throw new Error(`pco_line_items delete ${pcoNumber}: ${delErr.message}`);
      let sort = 0;
      for (const { li, celiId } of g.lines) {
        const { error } = await sb.from("pco_line_items").insert({
          pco_id: pcoId, pco_type: "commitment", change_event_id: g.ceId, change_event_line_item_id: celiId,
          budget_code_id: resolveBudgetLine(li.costCodeId, li.costTypeId),
          amount: centsToDollars(li.amount),
          unit_cost: li.unitPrice != null ? centsToDollars(li.unitPrice) : null,
          quantity: li.quantity ?? null, description: li.description ?? null,
          sort_order: sort, jobplanner_id: li.id,
        });
        if (error) throw new Error(`pco_line_items insert ${pcoNumber} L${li.id}: ${error.message}`);
        writes.pcoLines++; sort++;
      }
      // Link the change event to the synthesized commitment PCO.
      const { data: existLink } = await sb.from("change_event_pco_links")
        .select("id").eq("change_event_id", g.ceId).eq("pco_id", pcoId).maybeSingle();
      if (!existLink) {
        const { error: lkErr } = await sb.from("change_event_pco_links")
          .insert({ change_event_id: g.ceId, pco_id: pcoId, pco_type: "commitment" });
        if (lkErr) throw new Error(`change_event_pco_links ${pcoNumber}: ${lkErr.message}`);
        writes.ceLinks++;
      }
    }
  }

  const counts = {
    changeRequests: changeRequests.length,
    adopt: decisions.filter((d) => d.decision === "ADOPT").length,
    create: decisions.filter((d) => d.decision === "CREATE").length,
    flag: decisions.filter((d) => d.decision === "FLAG").length,
    existingChangeEvents: existing.length,
    appOnly: appOnly.length,
    jpCcos: jpCcos.length,
    ccoWithExecutedTwin: ccoTwins.filter((t) => t.twinId).length,
    jpPccos: jpPccos.length,
    pccoWithExecutedTwin: pccoTwins.filter((t) => t.twinId).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    jpProjectId: JP_PROJECT_ID, appProjectId: APP_PROJECT_ID,
    mode: APPLY ? "APPLIED" : "DRY-RUN — READ ONLY — NO WRITES",
    counts, writes: APPLY ? writes : undefined,
    decisions: decisions.map(({ _cr, _candidate, ...d }) => d),
    appOnly,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  const mdPath = OUT.replace(/\.json$/, ".md");
  const md = [];
  md.push(`# JP change-management reconcile — ${report.mode}`);
  md.push(`\nJP project ${JP_PROJECT_ID} → app project ${APP_PROJECT_ID} · ${report.generatedAt}\n`);
  md.push(`**Change requests:** ${counts.changeRequests}  →  ADOPT ${counts.adopt} · CREATE ${counts.create} · FLAG ${counts.flag}`);
  md.push(`**Existing app change events:** ${counts.existingChangeEvents} (app-only: ${counts.appOnly})`);
  md.push(`**Executed-CO twins:** commitment ${counts.ccoWithExecutedTwin}/${counts.jpCcos} · prime ${counts.pccoWithExecutedTwin}/${counts.jpPccos}`);
  if (APPLY) md.push(`**Writes:** CE adopted ${writes.ceAdopted} · CE created ${writes.ceCreated} · CE lines ${writes.ceLines} · prime PCOs ${writes.primePcos} · commit PCOs ${writes.commitPcos} · pco lines ${writes.pcoLines} · CE↔PCO links ${writes.ceLinks} · flags skipped ${writes.skippedFlags}` + (writes.warnings.length ? `\n\nWarnings:\n` + writes.warnings.map((w) => `- ${w}`).join("\n") : ""));
  md.push(`\n## Change-request decisions\n`);
  md.push(`| JP CR | Title | Cost | Fork (P/C/–) | Decision | Matched existing | Reason |`);
  md.push(`|---|---|---|---|---|---|---|`);
  for (const d of report.decisions) {
    const fork = `${d.fork.prime}/${d.fork.commitment}/${d.fork.unlinked}`;
    const m = d.matchedExisting ? `${d.matchedExisting.number} (${money(d.matchedExisting.cost)})` : "—";
    md.push(`| ${d.number} | ${String(d.title).slice(0, 32)} | ${money(d.cost)} | ${fork} | **${d.decision}** | ${m} | ${d.reason} |`);
  }
  if (appOnly.length) {
    md.push(`\n## App-only change events (no JP CR matched — left untouched)\n`);
    for (const e of appOnly) md.push(`- ${e.number} · ${money(e.cost)} · ${String(e.title).slice(0, 44)}`);
  }
  fs.writeFileSync(mdPath, md.join("\n") + "\n");

  console.log(`\nJP ${JP_PROJECT_ID} → app ${APP_PROJECT_ID}   (${report.mode})`);
  console.log(`Change requests: ${counts.changeRequests}  →  ADOPT ${counts.adopt} · CREATE ${counts.create} · FLAG ${counts.flag}`);
  console.log(`Existing change events: ${counts.existingChangeEvents}  (app-only: ${counts.appOnly})`);
  console.log(`Executed-CO twins: commitment ${counts.ccoWithExecutedTwin}/${counts.jpCcos} · prime ${counts.pccoWithExecutedTwin}/${counts.jpPccos}`);
  if (APPLY) console.log(`Writes: CE adopted ${writes.ceAdopted} · created ${writes.ceCreated} · CE lines ${writes.ceLines} · prime PCOs ${writes.primePcos} · commit PCOs ${writes.commitPcos} · pco lines ${writes.pcoLines} · links ${writes.ceLinks} · flags skipped ${writes.skippedFlags}` + (writes.warnings.length ? ` · warnings ${writes.warnings.length}` : ""));
  else console.log(`Per-CR:`), report.decisions.forEach((d) => console.log(`  ${String(d.number).padEnd(14)} ${d.decision.padEnd(6)} ${money(d.cost).padStart(13)}  fork P${d.fork.prime}/C${d.fork.commitment}/-${d.fork.unlinked}  ${d.matchedExisting ? "→ " + d.matchedExisting.number : ""}`));
  console.log(`\nReport: ${OUT}\n        ${mdPath}`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
