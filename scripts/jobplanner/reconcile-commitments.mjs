#!/usr/bin/env node

/**
 * JOBPLANNER-CANONICAL commitment reconciler with ADOPT-TWIN (dry-run by default).
 *
 * Supersedes the plain create/retire path for duplicate-heavy projects. Per JP
 * commitment, classifies the app-side action:
 *   REBUILD_SOV  app already has a commitment with the JP number -> replace its SOV from JP.
 *   ADOPT        an Acumatica-sourced twin (non-JP number, same SOV total AND same vendor,
 *                UNIQUE match) exists -> RE-KEY that row's contract_number to the JP number
 *                and rebuild its SOV from JP. Preserves the row id, so attached
 *                subcontractor_invoices / commitment_payments stay linked (no orphaning).
 *   CREATE       no JP-number match and no safe twin -> insert a fresh commitment (vendor
 *                resolved from JP contractedContact.companyName).
 * Leftover active non-JP commitments with no JP twin are reported as ACU_ONLY (never
 * touched) with their child invoice/payment counts and a test-data flag.
 *
 * Twin match safety: requires |sovSum - jpTotal| < $0.50 AND vendor id match, AND that the
 * candidate is UNIQUE on both sides (one Acumatica twin <-> one JP commitment). Ambiguous
 * (0 or >1 candidates, or vendor unresolved) -> NOT adopted; falls back to CREATE and is
 * flagged. Adoption of a commitment that carries invoices/payments is surfaced explicitly.
 *
 * GUARDRAIL: per commitment, aborts before writing if sum(JP SOV lines) != JP header total.
 *
 * Usage:
 *   node scripts/jobplanner/reconcile-commitments.mjs --jp=<id> --app=<id>            # dry run
 *   node scripts/jobplanner/reconcile-commitments.mjs --jp=<id> --app=<id> --apply    # execute
 *   node scripts/jobplanner/reconcile-commitments.mjs --batch                         # dry-run all dupe projects -> CSV
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
const BATCH = process.argv.includes("--batch");
// RECONCILE_ONLY: apply only the numbering-migration actions (ADOPT / CREATE / REACTIVATE)
// and SKIP every REBUILD_SOV of a JP-numbered row that already exists in the app. Those rows
// already tie to JP and carry live billed_to_date / invoices; rebuilding their SOV would wipe
// billing for no reconciliation benefit. Use for the numbering-scheme reconciliation pass.
const RECONCILE_ONLY = process.argv.includes("--reconcile-only");
const argValue = (name, fb) => { const h = process.argv.find((a) => a.startsWith(`--${name}=`)); return h ? h.slice(name.length + 3) : fb; };
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-08-jobplanner-commitment-adopt");

const API_V1 = "https://api.jobplanner.com";
const API_V2 = "https://api-v2.jobplanner.com";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!JP_KEY || !SUPABASE_URL || !SERVICE_KEY) { console.error("Missing JP/Supabase env"); process.exit(1); }

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const centsToDollars = (c) => Math.round(Number(c) || 0) / 100;
const dashCostCode = (code) => { const s = String(code ?? "").trim(); return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : null; };
const normNum = (s) => { const m = String(s ?? "").match(/(\d{2})\s*-\s*(\d{2,3})/); return m ? `${m[1]}-${m[2]}` : null; };
const isJpNumber = (n) => /-\d{4}-\d{4}$/.test(String(n || ""));
const isTestData = (n) => /GAUNTLET|TEST|EDITED|SAMPLE/i.test(String(n || ""));
const csv = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

async function jpGet(url) {
  const res = await fetch(url, { headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`JP ${res.status} ${url.replace(API_V2, "").replace(API_V1, "")}`);
  return res.json();
}
const kind = (jp) => { const n = String(jp.number || ""); if (n.startsWith("SC")) return "subcontract"; if (n.startsWith("PO")) return "purchase_order"; return jp.commitmentType === 2 ? "subcontract" : "purchase_order"; };

const SUFFIX = /\b(inc|incorporated|llc|ltd|co|corp|corporation|company|lp|llp|pllc|plc)\b/g;
const normName = (s) => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const normStrip = (s) => normName(s).replace(SUFFIX, "").replace(/\s+/g, " ").trim();

async function planProject(sb, app, jpProjectId, refs) {
  const { costCodeTitleById, costTypeIdByCode, resolveVendor } = refs;
  const [commitments, costCodes, costTypes] = await Promise.all([
    jpGet(`${API_V2}/projects/${jpProjectId}/commitments`),
    jpGet(`${API_V2}/projects/${jpProjectId}/costcodes`),
    jpGet(`${API_V2}/projects/${jpProjectId}/costtypes`),
  ]);
  const jpCodeById = new Map(costCodes.map((c) => [c.id, c]));
  const jpTypeCodeById = new Map(costTypes.map((t) => [t.id, t.code]));

  // app commitments (both tables) — INCLUDING soft-deleted, so a CREATE can never
  // collide with an existing (active or soft-deleted) contract_number on the project.
  const loadApp = async (table, sovTable, fk) => {
    const { data } = await sb.from(table).select("id, contract_number, title, contract_company_id, deleted_at").eq("project_id", app);
    const out = [];
    for (const c of data ?? []) {
      const { data: items } = await sb.from(sovTable).select("amount").eq(fk, c.id);
      const { count: inv } = await sb.from("subcontractor_invoices").select("id", { count: "exact", head: true }).eq(fk, c.id);
      const { count: pay } = await sb.from("commitment_payments").select("id", { count: "exact", head: true }).eq(fk, c.id);
      out.push({ id: c.id, table, sovTable, fk, contract_number: c.contract_number, title: c.title, vendor: c.contract_company_id, deleted: Boolean(c.deleted_at), sovSum: (items ?? []).reduce((a, x) => a + (Number(x.amount) || 0), 0), invoices: inv ?? 0, payments: pay ?? 0 });
    }
    return out;
  };
  const appCommits = [...await loadApp("subcontracts", "subcontract_sov_items", "subcontract_id"), ...await loadApp("purchase_orders", "purchase_order_sov_items", "purchase_order_id")];
  const jpNumberSet = new Set(commitments.map((c) => String(c.number)));
  const activeCommits = appCommits.filter((c) => !c.deleted);
  // Match an existing commitment by EXACT contract_number (any format, e.g. SC-000158
  // when a JP commitment carries that number) — not just JP ####-#### format.
  const byActiveNumber = new Map(activeCommits.map((c) => [String(c.contract_number), c]));
  const byDeletedNumber = new Map(appCommits.filter((c) => c.deleted).map((c) => [String(c.contract_number), c]));
  // Adoption candidates: active commitments whose number is NOT itself a JP number.
  const acuPool = activeCommits.filter((c) => !jpNumberSet.has(String(c.contract_number)));
  const consumed = new Set();

  // resolve JP lineitems for all commitments (parallel)
  const lineArrays = await Promise.all(commitments.map((c) => jpGet(`${API_V2}/commitments/${c.id}/lineitems`).catch(() => null)));

  const plan = [];
  commitments.forEach((jp, i) => {
    const number = String(jp.number);
    const lines = lineArrays[i] || [];
    const headerCents = Number(jp.totalAmount ?? jp.amount ?? 0);
    const jpTotal = centsToDollars(headerCents);
    const integrityOk = lines.reduce((a, x) => a + (Number(x.amount) || 0), 0) === headerCents;
    const vendorName = jp.contractedContact?.companyName || null;
    const vendorCompanyId = resolveVendor(vendorName);

    let unresolvedCodes = 0;
    const resolved = lines.map((x, idx) => {
      const jpCode = jpCodeById.get(x.costCodeId)?.code ?? null;
      const dashed = dashCostCode(jpCode);
      const costCodeId = dashed && costCodeTitleById.has(dashed) ? dashed : null;
      if (jpCode && !costCodeId) unresolvedCodes++;
      const tc = jpTypeCodeById.get(x.costTypeId) ?? null;
      const costTypeId = tc ? costTypeIdByCode.get(tc) ?? null : null;
      // budget_code text must match native "CODE.TYPE" format (e.g. "50-7000.S") so the
      // read-only SOV view resolves it even before project_budget_code_id maps.
      const budgetCodeText = costCodeId ? (tc ? `${costCodeId}.${tc}` : costCodeId) : null;
      return { line_number: idx + 1, costCodeId, costTypeId, budget_code: budgetCodeText, description: x.description?.trim() || costCodeTitleById.get(costCodeId) || jpCodeById.get(x.costCodeId)?.name || `Line ${idx + 1}`, amount: centsToDollars(x.amount) };
    });

    let action, target = null, note = "";
    const activeMatch = byActiveNumber.get(number);
    const deletedMatch = byDeletedNumber.get(number);
    if (activeMatch) { action = "REBUILD_SOV"; target = activeMatch; }
    else if (deletedMatch) { action = "REACTIVATE"; target = deletedMatch; note = "un-delete soft-deleted row with this number"; }
    else {
      // twin: unique unconsumed acu commitment, total match + (vendor match if resolvable)
      const totalMatches = acuPool.filter((c) => !consumed.has(c.id) && Math.abs(c.sovSum - jpTotal) < 0.5 && c.sovSum > 0);
      const vendorMatches = vendorCompanyId ? totalMatches.filter((c) => c.vendor === vendorCompanyId) : totalMatches;
      if (vendorMatches.length === 1) { action = "ADOPT"; target = vendorMatches[0]; consumed.add(target.id); note = vendorCompanyId ? "total+vendor unique" : "total-only (JP vendor unresolved)"; }
      else if (vendorMatches.length > 1) { action = "CREATE"; note = `ambiguous: ${vendorMatches.length} twins`; }
      else if (totalMatches.length >= 1) { action = "CREATE"; note = `total match but vendor mismatch (${totalMatches.length})`; }
      else { action = "CREATE"; note = "no twin"; }
    }
    plan.push({ number, kind: kind(jp), title: jp.title || null, jpTotal, jpSovLines: resolved.length, integrityOk, unresolvedCodes, vendorName, vendorCompanyId, action, note, targetId: target?.id ?? null, targetNumber: target?.contract_number ?? null, targetSovSum: target?.sovSum ?? null, targetInvoices: target?.invoices ?? 0, targetPayments: target?.payments ?? 0, resolvedLines: resolved });
  });

  const acuOnly = acuPool.filter((c) => !consumed.has(c.id)).map((c) => ({ id: c.id, table: c.table, contract_number: c.contract_number, title: c.title, sovSum: c.sovSum, invoices: c.invoices, payments: c.payments, testData: isTestData(c.contract_number) }));
  return { commitments: commitments.length, plan, acuOnly };
}

async function applyProject(sb, app, refs, planResult, reconcileOnly = false) {
  const { costCodeTitleById } = refs;
  const applied = { rebuilt: 0, adopted: 0, created: 0, sovLines: 0, budgetCodes: 0, skippedRebuild: 0 };
  const fails = planResult.plan.filter((p) => !p.integrityOk).map((p) => p.number);
  if (fails.length) throw new Error(`integrity fail: ${fails.join(", ")}`);

  for (const c of planResult.plan) {
    // Reconcile-only: never touch a JP-numbered row that already exists in the app.
    // Its SOV already ties to JP and carries live billed_to_date/invoices — leave it.
    if (reconcileOnly && c.action === "REBUILD_SOV") { applied.skippedRebuild++; continue; }
    const isSub = c.kind === "subcontract";
    const table = isSub ? "subcontracts" : "purchase_orders";
    const sovTable = isSub ? "subcontract_sov_items" : "purchase_order_sov_items";
    const fk = isSub ? "subcontract_id" : "purchase_order_id";

    // budget codes
    const seed = new Map();
    for (const ln of c.resolvedLines) { if (!ln.costCodeId || !ln.costTypeId) continue; const k = `${ln.costCodeId}|${ln.costTypeId}`; if (!seed.has(k)) seed.set(k, { project_id: app, cost_code_id: ln.costCodeId, cost_type_id: ln.costTypeId, description: costCodeTitleById.get(ln.costCodeId) || ln.description, description_mode: "concatenated", is_active: true }); }
    if (seed.size) { const { error } = await sb.from("project_budget_codes").upsert([...seed.values()], { onConflict: "project_id,sub_job_key,cost_code_id,cost_type_id" }); if (error) throw new Error(`bc upsert ${c.number}: ${error.message}`); applied.budgetCodes += seed.size; }
    const { data: bcAll } = await sb.from("project_budget_codes").select("id, cost_code_id, cost_type_id").eq("project_id", app).eq("sub_job_key", ZERO_UUID);
    const bcId = new Map((bcAll ?? []).map((r) => [`${r.cost_code_id}|${r.cost_type_id}`, r.id]));

    let commitmentId = c.targetId;
    if (c.action === "ADOPT") {
      const upd = { contract_number: c.number };
      if (c.title) upd.title = c.title;
      if (c.vendorCompanyId) upd.contract_company_id = c.vendorCompanyId;
      const { error } = await sb.from(table).update(upd).eq("id", commitmentId);
      if (error) throw new Error(`adopt update ${c.number}: ${error.message}`);
      applied.adopted++;
    } else if (c.action === "REACTIVATE") {
      // A soft-deleted row already owns this contract_number; un-delete it and rebuild
      // its SOV rather than inserting a colliding duplicate.
      const upd = { deleted_at: null };
      if (c.title) upd.title = c.title;
      if (c.vendorCompanyId) upd.contract_company_id = c.vendorCompanyId;
      const { error } = await sb.from(table).update(upd).eq("id", commitmentId);
      if (error) throw new Error(`reactivate ${c.number}: ${error.message}`);
      applied.reactivated = (applied.reactivated || 0) + 1;
    } else if (c.action === "CREATE") {
      const { data: ins, error } = await sb.from(table).insert({ project_id: app, contract_number: c.number, title: c.title, status: "Draft", contract_company_id: c.vendorCompanyId }).select("id").single();
      if (error) throw new Error(`create ${c.number}: ${error.message}`);
      commitmentId = ins.id; applied.created++;
    } else { applied.rebuilt++; }

    // rebuild SOV
    const { error: delErr } = await sb.from(sovTable).delete().eq(fk, commitmentId);
    if (delErr) throw new Error(`sov del ${c.number}: ${delErr.message}`);
    const rows = c.resolvedLines.map((ln) => ({ [fk]: commitmentId, line_number: ln.line_number, budget_code: ln.budget_code, project_budget_code_id: (ln.costCodeId && ln.costTypeId) ? bcId.get(`${ln.costCodeId}|${ln.costTypeId}`) ?? null : null, description: ln.description, amount: ln.amount, sort_order: ln.line_number }));
    if (rows.length) { const { error } = await sb.from(sovTable).insert(rows); if (error) throw new Error(`sov ins ${c.number}: ${error.message}`); applied.sovLines += rows.length; }
  }
  return applied;
}

async function buildRefs(sb) {
  const { data: ccRows } = await sb.from("cost_codes").select("id, title");
  const costCodeTitleById = new Map((ccRows ?? []).map((r) => [r.id, r.title]));
  const { data: ctRows } = await sb.from("cost_code_types").select("id, code");
  const costTypeIdByCode = new Map((ctRows ?? []).map((r) => [r.code, r.id]));
  const { data: coRows } = await sb.from("companies").select("id, name");
  const exact = new Map(), strip = new Map();
  for (const co of coRows ?? []) { exact.set(normName(co.name), co.id); const k = normStrip(co.name); if (k && !strip.has(k)) strip.set(k, co.id); }
  const resolveVendor = (name) => (name ? exact.get(normName(name)) ?? strip.get(normStrip(name)) ?? null : null);
  return { costCodeTitleById, costTypeIdByCode, resolveVendor };
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const refs = await buildRefs(sb);

  if (BATCH) {
    const { data: appProjects } = await sb.from("projects").select("id, project_number, name, phase, archived");
    const active = appProjects.filter((p) => !p.archived && p.phase === "Current");
    const jpProjects = await jpGet(`${API_V1}/projects`);
    const jpByNum = new Map(); for (const j of jpProjects) { const n = normNum(j.projectName); if (n) jpByNum.set(n, j); }
    const rows = [], adoptDetail = [];
    for (const app of active) {
      const jp = jpByNum.get(normNum(app.project_number));
      if (!jp) continue;
      try {
        const r = await planProject(sb, app.id, jp.projectId, refs);
        const c = (a) => r.plan.filter((p) => p.action === a).length;
        const adoptWithInvoices = r.plan.filter((p) => p.action === "ADOPT" && (p.targetInvoices > 0 || p.targetPayments > 0));
        rows.push({ project_number: app.project_number, name: app.name, app_project_id: app.id, jp_project_id: jp.projectId, jp_commitments: r.commitments, rebuild: c("REBUILD_SOV"), adopt: c("ADOPT"), adopt_with_billing: adoptWithInvoices.length, create: c("CREATE"), acu_only: r.acuOnly.length, acu_only_with_billing: r.acuOnly.filter((a) => a.invoices > 0 || a.payments > 0).length, acu_only_testdata: r.acuOnly.filter((a) => a.testData).length, integrity_fail: r.plan.filter((p) => !p.integrityOk).length });
        adoptWithInvoices.forEach((p) => adoptDetail.push({ project: app.project_number, jpNumber: p.number, adoptsFrom: p.targetNumber, invoices: p.targetInvoices, payments: p.targetPayments, note: p.note }));
        console.error(`✓ ${app.project_number} ${app.name}: rebuild=${c("REBUILD_SOV")} adopt=${c("ADOPT")} create=${c("CREATE")} acuOnly=${r.acuOnly.length}`);
      } catch (e) { rows.push({ project_number: app.project_number, name: app.name, error: e.message }); console.error(`✗ ${app.project_number}: ${e.message}`); }
    }
    const cols = ["project_number", "name", "app_project_id", "jp_project_id", "jp_commitments", "rebuild", "adopt", "adopt_with_billing", "create", "acu_only", "acu_only_with_billing", "acu_only_testdata", "integrity_fail", "error"];
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "adopt-plan.csv"), [cols.join(",")].concat(rows.map((r) => cols.map((c) => csv(r[c])).join(","))).join("\n") + "\n");
    fs.writeFileSync(path.join(OUT_DIR, "adopt-plan.json"), JSON.stringify({ generatedAt: new Date().toISOString(), rows, adoptWithBilling: adoptDetail }, null, 2) + "\n");
    const tot = rows.reduce((a, r) => ({ adopt: a.adopt + (r.adopt || 0), adoptBilling: a.adoptBilling + (r.adopt_with_billing || 0), create: a.create + (r.create || 0), acuOnly: a.acuOnly + (r.acu_only || 0), acuBilling: a.acuBilling + (r.acu_only_with_billing || 0) }), { adopt: 0, adoptBilling: 0, create: 0, acuOnly: 0, acuBilling: 0 });
    console.log(JSON.stringify({ projects: rows.length, totals: tot, outDir: OUT_DIR }, null, 2));
    return;
  }

  const JP = Number(argValue("jp", NaN)), APP = Number(argValue("app", NaN));
  if (!Number.isInteger(JP) || !Number.isInteger(APP)) { console.error("Need --jp= --app= (or --batch)"); process.exit(1); }
  const r = await planProject(sb, APP, JP, refs);
  const rebuildRows = r.plan.filter((p) => p.action === "REBUILD_SOV");
  const rebuildMismatch = rebuildRows.filter((p) => p.targetSovSum != null && Math.abs(p.targetSovSum - p.jpTotal) >= 0.5).map((p) => `${p.number} app$${p.targetSovSum} vs JP$${p.jpTotal} (Δ${(p.targetSovSum - p.jpTotal).toFixed(2)})`);
  const summary = { mode: APPLY ? (RECONCILE_ONLY ? "APPLY (reconcile-only)" : "APPLY") : "DRY RUN", jp: JP, app: APP, commitments: r.commitments, rebuild: rebuildRows.length, rebuildSkippedInReconcileOnly: RECONCILE_ONLY ? rebuildRows.length : 0, rebuildTotalMismatch: rebuildMismatch, reactivate: r.plan.filter((p) => p.action === "REACTIVATE").length, adopt: r.plan.filter((p) => p.action === "ADOPT").length, adoptWithBilling: r.plan.filter((p) => p.action === "ADOPT" && (p.targetInvoices > 0 || p.targetPayments > 0)).map((p) => `${p.number}<-${p.targetNumber} (${p.targetInvoices}inv/${p.targetPayments}pay)`), create: r.plan.filter((p) => p.action === "CREATE").length, acuOnly: r.acuOnly.map((a) => `${a.contract_number}${a.testData ? " [TEST]" : ""}${a.invoices ? ` (${a.invoices}inv)` : ""}`), integrityFail: r.plan.filter((p) => !p.integrityOk).map((p) => p.number) };
  let applied = null;
  if (APPLY) applied = await applyProject(sb, APP, refs, r, RECONCILE_ONLY);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `plan-${JP}-${APP}.json`), JSON.stringify({ summary, applied, plan: r.plan, acuOnly: r.acuOnly }, null, 2) + "\n");
  console.log(JSON.stringify({ ...summary, applied }, null, 2));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
