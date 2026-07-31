#!/usr/bin/env node

/**
 * JOBPLANNER-CANONICAL commitment + SOV importer / reconciler.
 *
 * Business decision (Megan, 2026-07-07): Job Planner is the source of truth for
 * commitments and their Schedule of Values. This tool pulls each JP commitment's
 * full cost-coded SOV, writes it into the PM app's commitment tables, links every
 * line to a `project_budget_codes` row (creating them as needed), and RETIRES the
 * duplicate Acumatica-sourced commitments (soft delete). Acumatica commitments that
 * have NO Job Planner twin are FLAGGED for human review, never auto-deleted.
 *
 * Tables (subcontract vs purchase order chosen by JP commitment number prefix):
 *   subcontract   -> subcontracts        + subcontract_sov_items
 *   purchase order-> purchase_orders     + purchase_order_sov_items
 *
 * Job Planner endpoints (V2, browser UA required — Cloudflare blocks default UAs):
 *   commitments (project list)  GET /projects/{jp}/commitments
 *   SOV line items              GET /commitments/{commitmentId}/lineitems   (NOT project-scoped)
 *   cost codes / cost types     GET /projects/{jp}/costcodes | /costtypes
 *
 * Mapping (identical chain to import-prime-contract.mjs):
 *   - JP amounts are CENTS -> app columns store DOLLARS (/100).
 *   - JP 6-digit cost code "013144" -> cost_codes.id "01-3144".
 *   - JP cost type L/E/M/S/X (by .code) -> cost_code_types.id.
 *   - budget code = one project_budget_codes per (project, sub_job_key=zeroUUID,
 *     cost_code_id, cost_type_id); upsert on uq_project_budget_code.
 *   - commitment SOV items store `amount` (dollars) directly; quantity/unit_cost
 *     left null (they are nullable and not generated).
 *   - App commitment matched to a JP commitment by contract_number == JP `number`.
 *   - Acumatica duplicate = a non-JP app commitment on the same project whose SOV
 *     total equals a JP commitment's total (within $0.50).
 *
 * GUARDRAIL: per commitment, aborts before writing if sum(JP SOV lines) != JP header
 * total. Retirement uses soft delete (deleted_at) — reversible.
 *
 * Usage:
 *   node scripts/jobplanner/import-commitments.mjs --jp=8189 --app=754            # DRY RUN (plan only)
 *   node scripts/jobplanner/import-commitments.mjs --jp=8189 --app=754 --apply    # execute
 *   node scripts/jobplanner/import-commitments.mjs --jp=8189 --app=754 --apply --retire-dupes
 *
 * Flags:
 *   --jp=<id>         Job Planner projectId (required)
 *   --app=<id>        PM app projects.id INTEGER (required)
 *   --apply           Execute writes (default: dry run, no writes)
 *   --retire-dupes    Also soft-delete confirmed Acumatica duplicate commitments
 *                     (only meaningful with --apply; off by default for safety)
 *   --out=<path>      Evidence JSON output path
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
const RETIRE_DUPES = process.argv.includes("--retire-dupes");
const argValue = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const JP_PROJECT_ID = Number(argValue("jp", NaN));
const APP_PROJECT_ID = Number(argValue("app", NaN));
const OUT = argValue(
  "out",
  path.join(repoRoot, `docs/ops/evidence/2026-07-07-jobplanner-commitment-import/plan-${JP_PROJECT_ID}-${APP_PROJECT_ID}.json`),
);
if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Required: --jp=<jobplannerProjectId> --app=<appProjectId>");
  process.exit(1);
}

const API_V2 = "https://api-v2.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!JP_KEY) { console.error("Missing JOBPLANNER_API_KEY"); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const centsToDollars = (c) => Math.round(Number(c) || 0) / 100;
const dashCostCode = (code) => {
  const s = String(code ?? "").trim();
  return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : null;
};

async function jpGet(url) {
  const res = await fetch(url, { headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Job Planner ${res.status} on ${url.replace(API_V2, "")}`);
  return res.json();
}

function commitmentKind(jp) {
  const num = String(jp.number || "");
  if (num.startsWith("SC")) return "subcontract";
  if (num.startsWith("PO")) return "purchase_order";
  // commitmentType: 1 = purchase order, 2 = subcontract (observed on live data)
  return jp.commitmentType === 2 ? "subcontract" : "purchase_order";
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // --- Load JP source ---
  const [commitments, costCodes, costTypes] = await Promise.all([
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/commitments`),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costcodes`),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costtypes`),
  ]);
  const jpCodeById = new Map(costCodes.map((c) => [c.id, c]));
  const jpTypeCodeById = new Map(costTypes.map((t) => [t.id, t.code]));

  // --- Load app reference maps ---
  const { data: ccRows, error: ccErr } = await sb.from("cost_codes").select("id, title");
  if (ccErr) throw new Error(`cost_codes read: ${ccErr.message}`);
  const costCodeTitleById = new Map((ccRows ?? []).map((r) => [r.id, r.title]));
  const { data: ctRows, error: ctErr } = await sb.from("cost_code_types").select("id, code");
  if (ctErr) throw new Error(`cost_code_types read: ${ctErr.message}`);
  const costTypeIdByCode = new Map((ctRows ?? []).map((r) => [r.code, r.id]));

  // Vendor resolution: JP contractedContact.companyName -> companies.id (exact, then legal-suffix-stripped).
  const { data: coRows } = await sb.from("companies").select("id, name");
  const SUFFIX = /\b(inc|incorporated|llc|ltd|co|corp|corporation|company|lp|llp|pllc|plc)\b/g;
  const normName = (s) => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const normStrip = (s) => normName(s).replace(SUFFIX, "").replace(/\s+/g, " ").trim();
  const coByExact = new Map(), coByStrip = new Map();
  for (const co of coRows ?? []) { coByExact.set(normName(co.name), co.id); const k = normStrip(co.name); if (k && !coByStrip.has(k)) coByStrip.set(k, co.id); }
  const resolveVendor = (name) => (name ? coByExact.get(normName(name)) ?? coByStrip.get(normStrip(name)) ?? null : null);

  // Existing app commitments on this project (both tables), with SOV totals.
  async function loadAppCommitments(table, sovTable, fk) {
    const { data, error } = await sb.from(table).select("id, contract_number, title, contract_company_id, deleted_at").eq("project_id", APP_PROJECT_ID);
    if (error) throw new Error(`${table} read: ${error.message}`);
    const out = [];
    for (const c of data ?? []) {
      const { data: items } = await sb.from(sovTable).select("amount, project_budget_code_id").eq(fk, c.id);
      const sum = (items ?? []).reduce((a, x) => a + (Number(x.amount) || 0), 0);
      out.push({ ...c, table, sovTable, fk, sovCount: (items ?? []).length, sovSum: sum });
    }
    return out;
  }
  const appSubs = await loadAppCommitments("subcontracts", "subcontract_sov_items", "subcontract_id");
  const appPos = await loadAppCommitments("purchase_orders", "purchase_order_sov_items", "purchase_order_id");
  const appAll = [...appSubs, ...appPos].filter((c) => !c.deleted_at);
  const jpNumbers = new Set(commitments.map((c) => String(c.number)));
  const byNumber = new Map(appAll.map((c) => [String(c.contract_number), c]));

  // --- Build the plan (read-only) ---
  const plan = { jpCommitments: [], retireDuplicates: [], acumaticaOnlyFlags: [], errors: [] };

  for (const jp of commitments) {
    const kind = commitmentKind(jp);
    const number = String(jp.number);
    let lines = [];
    try { lines = await jpGet(`${API_V2}/commitments/${jp.id}/lineitems`); } catch (e) { plan.errors.push(`${number}: lineitems ${e.message}`); continue; }
    const headerCents = Number(jp.totalAmount ?? jp.amount ?? 0);
    const sovCents = lines.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const integrityOk = sovCents === headerCents;

    let unresolvedCodes = 0, unresolvedTypes = 0;
    const resolved = lines.map((x, idx) => {
      const jpCode = jpCodeById.get(x.costCodeId)?.code ?? null;
      const dashed = dashCostCode(jpCode);
      const costCodeId = dashed && costCodeTitleById.has(dashed) ? dashed : null;
      if (jpCode && !costCodeId) unresolvedCodes++;
      const typeCode = jpTypeCodeById.get(x.costTypeId) ?? null;
      const costTypeId = typeCode ? costTypeIdByCode.get(typeCode) ?? null : null;
      if (typeCode && !costTypeId) unresolvedTypes++;
      // budget_code text uses native "CODE.TYPE" format (e.g. "50-7000.S") so the
      // read-only/locked SOV view resolves it, matching how the app writes SOV rows.
      const budgetCodeText = costCodeId ? (typeCode ? `${costCodeId}.${typeCode}` : costCodeId) : null;
      return {
        line_number: idx + 1,
        costCodeId, costTypeId,
        budget_code: budgetCodeText,
        description: x.description?.trim() || costCodeTitleById.get(costCodeId) || jpCodeById.get(x.costCodeId)?.name || `Line ${idx + 1}`,
        amount: centsToDollars(x.amount),
      };
    });
    const existing = byNumber.get(number) || null;
    const vendorName = jp.contractedContact?.companyName || null;
    const vendorCompanyId = resolveVendor(vendorName);
    plan.jpCommitments.push({
      number, kind, title: jp.title || null,
      vendorName, vendorCompanyId,
      jpHeaderTotal: centsToDollars(headerCents),
      jpSovLineCount: resolved.length,
      integrityOk,
      action: existing ? "REBUILD_SOV" : "CREATE",
      appCommitmentId: existing?.id ?? null,
      appCurrentSovCount: existing?.sovCount ?? 0,
      appHasVendor: Boolean(existing?.contract_company_id),
      budgetCodesNeeded: new Set(resolved.filter((r) => r.costCodeId && r.costTypeId).map((r) => `${r.costCodeId}|${r.costTypeId}`)).size,
      unresolvedCodes, unresolvedTypes,
      resolvedLines: resolved,
    });
  }

  // Acumatica duplicates: non-JP app commitments whose total matches a JP commitment total.
  const jpTotals = plan.jpCommitments.map((c) => c.jpHeaderTotal);
  for (const c of appAll) {
    if (jpNumbers.has(String(c.contract_number))) continue; // it IS a JP commitment
    const twin = plan.jpCommitments.find((j) => Math.abs(j.jpHeaderTotal - c.sovSum) < 0.5 && c.sovSum > 0);
    if (twin) {
      plan.retireDuplicates.push({ appCommitmentId: c.id, table: c.table, contract_number: c.contract_number, title: c.title, sovSum: c.sovSum, sovCount: c.sovCount, jpTwin: twin.number });
    } else {
      plan.acumaticaOnlyFlags.push({ appCommitmentId: c.id, table: c.table, contract_number: c.contract_number, title: c.title, sovSum: c.sovSum, sovCount: c.sovCount });
    }
  }

  // --- Summary ---
  const summary = {
    mode: APPLY ? (RETIRE_DUPES ? "APPLY + RETIRE" : "APPLY (no retire)") : "DRY RUN",
    jpProjectId: JP_PROJECT_ID, appProjectId: APP_PROJECT_ID,
    jpCommitments: plan.jpCommitments.length,
    toCreate: plan.jpCommitments.filter((c) => c.action === "CREATE").length,
    toRebuildSov: plan.jpCommitments.filter((c) => c.action === "REBUILD_SOV").length,
    createsWithVendor: plan.jpCommitments.filter((c) => c.action === "CREATE" && c.vendorCompanyId).length,
    createsMissingVendor: plan.jpCommitments.filter((c) => c.action === "CREATE" && !c.vendorCompanyId).map((c) => `${c.number} (${c.vendorName || "no name"})`),
    integrityFailures: plan.jpCommitments.filter((c) => !c.integrityOk).map((c) => c.number),
    totalJpSovLines: plan.jpCommitments.reduce((a, c) => a + c.jpSovLineCount, 0),
    acumaticaDuplicatesToRetire: plan.retireDuplicates.length,
    acumaticaOnlyFlagged: plan.acumaticaOnlyFlags.length,
    unresolvedCodeLines: plan.jpCommitments.reduce((a, c) => a + c.unresolvedCodes, 0),
    unresolvedTypeLines: plan.jpCommitments.reduce((a, c) => a + c.unresolvedTypes, 0),
  };

  // --- Execute (only with --apply) ---
  const applied = { headersUpserted: 0, sovLinesWritten: 0, budgetCodesUpserted: 0, retired: 0 };
  if (APPLY) {
    if (summary.integrityFailures.length) {
      throw new Error(`Refusing to apply: ${summary.integrityFailures.length} commitment(s) fail SOV integrity: ${summary.integrityFailures.join(", ")}`);
    }
    for (const c of plan.jpCommitments) {
      const isSub = c.kind === "subcontract";
      const table = isSub ? "subcontracts" : "purchase_orders";
      const sovTable = isSub ? "subcontract_sov_items" : "purchase_order_sov_items";
      const fk = isSub ? "subcontract_id" : "purchase_order_id";

      // Budget codes for this commitment's distinct (code,type) pairs.
      const seed = new Map();
      for (const ln of c.resolvedLines) {
        if (!ln.costCodeId || !ln.costTypeId) continue;
        const key = `${ln.costCodeId}|${ln.costTypeId}`;
        if (!seed.has(key)) seed.set(key, { project_id: APP_PROJECT_ID, cost_code_id: ln.costCodeId, cost_type_id: ln.costTypeId, description: costCodeTitleById.get(ln.costCodeId) || ln.description, description_mode: "concatenated", is_active: true });
      }
      if (seed.size) {
        const { error } = await sb.from("project_budget_codes").upsert([...seed.values()], { onConflict: "project_id,sub_job_key,cost_code_id,cost_type_id" });
        if (error) throw new Error(`budget code upsert ${c.number}: ${error.message}`);
        applied.budgetCodesUpserted += seed.size;
      }
      const { data: bcAll } = await sb.from("project_budget_codes").select("id, cost_code_id, cost_type_id").eq("project_id", APP_PROJECT_ID).eq("sub_job_key", ZERO_UUID);
      const bcIdByKey = new Map((bcAll ?? []).map((r) => [`${r.cost_code_id}|${r.cost_type_id}`, r.id]));

      let commitmentId = c.appCommitmentId;
      if (!commitmentId) {
        const { data: ins, error } = await sb.from(table).insert({ project_id: APP_PROJECT_ID, contract_number: c.number, title: c.title, status: "Draft", contract_company_id: c.vendorCompanyId }).select("id").single();
        if (error) throw new Error(`${table} insert ${c.number}: ${error.message}`);
        commitmentId = ins.id;
      }
      applied.headersUpserted++;

      // Replace SOV lines with JP breakdown.
      const { error: delErr } = await sb.from(sovTable).delete().eq(fk, commitmentId);
      if (delErr) throw new Error(`SOV delete ${c.number}: ${delErr.message}`);
      const rows = c.resolvedLines.map((ln) => ({
        [fk]: commitmentId, line_number: ln.line_number,
        budget_code: ln.budget_code, project_budget_code_id: (ln.costCodeId && ln.costTypeId) ? bcIdByKey.get(`${ln.costCodeId}|${ln.costTypeId}`) ?? null : null,
        description: ln.description, amount: ln.amount, sort_order: ln.line_number,
      }));
      if (rows.length) {
        const { error: insErr } = await sb.from(sovTable).insert(rows);
        if (insErr) throw new Error(`SOV insert ${c.number}: ${insErr.message}`);
        applied.sovLinesWritten += rows.length;
      }
    }
    if (RETIRE_DUPES) {
      for (const d of plan.retireDuplicates) {
        const { error } = await sb.from(d.table).update({ deleted_at: new Date().toISOString() }).eq("id", d.appCommitmentId);
        if (error) throw new Error(`retire ${d.contract_number}: ${error.message}`);
        applied.retired++;
      }
    }
  }

  const evidence = { summary, applied: APPLY ? applied : null, plan, completedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ ...summary, applied: APPLY ? applied : undefined, out: OUT }, null, 2));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
