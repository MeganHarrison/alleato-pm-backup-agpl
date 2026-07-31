#!/usr/bin/env node

/**
 * Reconcile a project's commitment CHANGE ORDERS and PAYMENTS to the current subcontracts.
 *
 * When the JP commitment import rebuilt subcontracts as new SC-#### rows, the
 * Acumatica-sourced change orders (contract_change_orders) and payments
 * (commitment_payments) were left pointing at the OLD (now-deleted) commitment ids, so
 * they show on no commitment. This re-links them to the current subcontract and imports
 * any JP change orders the app is missing, so each commitment matches Job Planner.
 *
 *   Change orders: app contract_change_orders keyed by change_order_number == JP CCO number;
 *                  re-point contract_id to the current subcontract (from JP's CCO->commitment
 *                  map). JP CCOs with no app row are created.
 *   Payments:      commitment_payments re-pointed to subcontract_id via their
 *                  subcontractor_invoice_id -> subcontractor_invoices.subcontract_id
 *                  (invoices were already relinked).
 *
 * DRY RUN by default. Usage:
 *   node scripts/jobplanner/reconcile-noblesville-financials.mjs --project=25125 --jp=5092
 *   node scripts/jobplanner/reconcile-noblesville-financials.mjs --project=25125 --jp=5092 --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const req = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = req("dotenv");
const { createClient } = req("@supabase/supabase-js");
for (const p of [".env", ".env.local", "frontend/.env.local"]) dotenv.config({ path: path.join(repoRoot, p), quiet: true });

const APPLY = process.argv.includes("--apply");
const argValue = (n, fb) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : fb; };
const PROJECT_ID = Number(argValue("project", NaN));
const JP_ID = Number(argValue("jp", NaN));
if (!Number.isInteger(PROJECT_ID) || !Number.isInteger(JP_ID)) { console.error("Required: --project=<appId> --jp=<jpId>"); process.exit(1); }

const V2 = "https://api-v2.jobplanner.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!JP_KEY || !URL || !KEY) { console.error("Missing env (JOBPLANNER_API_KEY / Supabase service)"); process.exit(1); }

const c2d = (c) => Math.round(Number(c) || 0) / 100;
const jpGet = async (u) => { const r = await fetch(u, { headers: { ApiKey: JP_KEY, "User-Agent": UA, Accept: "application/json" } }); if (!r.ok) throw new Error(`JP ${r.status} ${u}`); return r.json(); };

async function main() {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });

  const jpCcos = await jpGet(`${V2}/projects/${JP_ID}/commitmentchangeorders`);
  const jpByNumber = new Map(jpCcos.map((c) => [String(c.number).toUpperCase(), c]));

  const { data: subs, error: sErr } = await sb.from("subcontracts").select("id, contract_number").eq("project_id", PROJECT_ID).is("deleted_at", null);
  if (sErr) throw new Error(`subcontracts: ${sErr.message}`);
  const scIdByNum = new Map((subs ?? []).map((s) => [String(s.contract_number).toUpperCase(), s.id]));

  // ---------- CHANGE ORDERS ----------
  const { data: appCcos, error: cErr } = await sb.from("contract_change_orders").select("id, change_order_number, contract_id, amount").eq("project_id", PROJECT_ID);
  if (cErr) throw new Error(`contract_change_orders: ${cErr.message}`);
  const appCoByNum = new Map((appCcos ?? []).map((c) => [String(c.change_order_number).toUpperCase(), c]));

  const coRelink = [], coCreate = [], coFlag = [];
  for (const [num, jp] of jpByNumber) {
    const commitNum = String(jp.commitmentNumber ?? "").toUpperCase();
    const scId = scIdByNum.get(commitNum);
    if (!scId) { coFlag.push({ num, reason: `no current subcontract for ${jp.commitmentNumber}` }); continue; }
    const app = appCoByNum.get(num);
    if (app) { if (app.contract_id !== scId) coRelink.push({ id: app.id, num, scId, commitNum }); }
    else coCreate.push({ num, scId, commitNum, amount: c2d(jp.totalAmount ?? jp.amount), desc: jp.description ?? null, executed: jp.statusId === 8 });
  }

  // ---------- PAYMENTS ----------
  const { data: pays, error: pErr } = await sb.from("commitment_payments").select("id, subcontract_id, subcontractor_invoice_id").eq("project_id", PROJECT_ID);
  if (pErr) throw new Error(`commitment_payments: ${pErr.message}`);
  const invIds = [...new Set((pays ?? []).map((p) => p.subcontractor_invoice_id).filter(Boolean))];
  const { data: invs } = invIds.length ? await sb.from("subcontractor_invoices").select("id, subcontract_id").in("id", invIds) : { data: [] };
  const scByInv = new Map((invs ?? []).map((i) => [i.id, i.subcontract_id]));
  const payRelink = [];
  for (const p of pays ?? []) {
    const target = p.subcontractor_invoice_id ? scByInv.get(p.subcontractor_invoice_id) : null;
    if (target && p.subcontract_id !== target) payRelink.push({ id: p.id, scId: target });
  }

  const writes = { coRelinked: 0, coCreated: 0, payRelinked: 0 };
  if (APPLY) {
    // 1. relink existing change orders to the current subcontract
    for (const r of coRelink) { const { error } = await sb.from("contract_change_orders").update({ contract_id: r.scId }).eq("id", r.id); if (error) throw new Error(`CO relink ${r.num}: ${error.message}`); writes.coRelinked++; }
    // 2. relink payments (independent of CO creation)
    for (const r of payRelink) { const { error } = await sb.from("commitment_payments").update({ subcontract_id: r.scId }).eq("id", r.id); if (error) throw new Error(`pay relink ${r.id}: ${error.message}`); writes.payRelinked++; }
    // 3. create the JP change orders the app is missing. Status 'pending' (approved
    //    requires approved_date+approved_by per valid_approval_date CHECK; no approver
    //    to attribute here) — visible on the commitment, executed flag reflects JP.
    for (const r of coCreate) {
      const { error } = await sb.from("contract_change_orders").insert({ project_id: PROJECT_ID, contract_id: r.scId, change_order_number: r.num, title: r.num, description: r.desc, amount: r.amount, status: "pending", executed: r.executed, contract_type: "subcontract" });
      if (error) throw new Error(`CO create ${r.num}: ${error.message}`); writes.coCreated++;
    }
  }

  console.log(`\nReconcile financials — project ${PROJECT_ID} (JP ${JP_ID})  (${APPLY ? "APPLIED" : "DRY RUN"})`);
  console.log(`JP change orders: ${jpByNumber.size}  |  app contract_change_orders: ${(appCcos ?? []).length}`);
  console.log(`  CHANGE ORDERS: relink ${coRelink.length}, create ${coCreate.length}, flag ${coFlag.length}`);
  if (coFlag.length) for (const f of coFlag) console.log(`     FLAG ${f.num}: ${f.reason}`);
  console.log(`  PAYMENTS: relink ${payRelink.length} / ${(pays ?? []).length}`);
  if (APPLY) console.log(`  WROTE: CO relinked ${writes.coRelinked}, CO created ${writes.coCreated}, payments relinked ${writes.payRelinked}`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
