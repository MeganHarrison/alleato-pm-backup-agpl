#!/usr/bin/env node

/**
 * Tag each Acumatica subcontractor invoice with the Job Planner PAY APPLICATION it belongs to.
 *
 * Acumatica splits each JP pay-app into a progress bill + a retainage bill, so the app shows
 * ~2x the rows JP does. JP pay-apps carry `externalObject.externalId` = the Acumatica ref of
 * the PROGRESS bill; the RETAINAGE bill is the one whose amount completes the pay-app total.
 * This maps both to `subcontractor_invoices.jobplanner_pay_app_number` so the UI can group the
 * real granular bills into JP's pay-app view and totals tie out (no data discarded).
 *
 * DRY RUN by default. Usage:
 *   node scripts/jobplanner/map-payapps.mjs --project=25125 --jp=5092
 *   node scripts/jobplanner/map-payapps.mjs --project=25125 --jp=5092 --apply
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
const arg = (n, fb) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : fb; };
const PROJECT_ID = Number(arg("project", NaN)), JP_ID = Number(arg("jp", NaN));
if (!Number.isInteger(PROJECT_ID) || !Number.isInteger(JP_ID)) { console.error("Required: --project= --jp="); process.exit(1); }

const V2 = "https://api-v2.jobplanner.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
const jpGet = async (u) => { const r = await fetch(u, { headers: { ApiKey: JP_KEY, "User-Agent": UA } }); if (!r.ok) throw new Error(`JP ${r.status}`); return r.json(); };
const c2d = (c) => Math.round(Number(c) || 0) / 100;
const near = (a, b) => Math.abs(a - b) <= 1;

async function main() {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const commits = await jpGet(`${V2}/projects/${JP_ID}/commitments`);

  const { data: subs } = await sb.from("subcontracts").select("id, contract_number").eq("project_id", PROJECT_ID).is("deleted_at", null);
  const scIdByNum = new Map((subs ?? []).map((s) => [String(s.contract_number).toUpperCase(), s.id]));

  const { data: inv } = await sb.from("subcontractor_invoices").select("id, subcontract_id, acumatica_ref_nbr, acumatica_ap_bill_id").eq("project_id", PROJECT_ID);
  const { data: bills } = await sb.from("acumatica_ap_bills").select("id, amount").in("id", inv.map((i) => i.acumatica_ap_bill_id).filter(Boolean));
  const amtByBill = new Map((bills ?? []).map((b) => [b.id, Number(b.amount) || 0]));
  const invBySc = new Map();
  for (const i of inv) { const arr = invBySc.get(i.subcontract_id) ?? []; arr.push(i); invBySc.set(i.subcontract_id, arr); }

  const assign = new Map(); // invoiceId -> pay-app number
  let payApps = 0, tie = 0, notie = 0, unmapped = 0;
  const flags = [];

  for (const c0 of commits) {
    const scId = scIdByNum.get(String(c0.number).toUpperCase());
    if (!scId) continue;
    const detail = await jpGet(`${V2}/commitments/${c0.id}`);
    const jpInvs = detail.invoices ?? [];
    const appInvs = (invBySc.get(scId) ?? []).slice();
    const byRef = new Map(appInvs.map((i) => [String(i.acumatica_ref_nbr), i]));
    const used = new Set();

    for (const pa of jpInvs) {
      payApps++;
      const num = pa.number;
      const jpTotal = c2d(pa.totalAmount ?? pa.amount);
      const extId = pa.externalObject?.externalId ? String(pa.externalObject.externalId) : null;
      let progress = extId ? byRef.get(extId) : null;
      let groupSum = 0;
      if (progress && !used.has(progress.id)) { used.add(progress.id); assign.set(progress.id, num); groupSum += amtByBill.get(progress.acumatica_ap_bill_id) ?? 0; }
      // retainage / remaining bill(s) that complete the pay-app total
      const remaining = appInvs.filter((i) => !used.has(i.id));
      const need = jpTotal - groupSum;
      const retain = remaining.find((i) => near(amtByBill.get(i.acumatica_ap_bill_id) ?? 0, need));
      if (retain && need > 0.01) { used.add(retain.id); assign.set(retain.id, num); groupSum += amtByBill.get(retain.acumatica_ap_bill_id) ?? 0; }
      if (near(groupSum, jpTotal)) tie++; else { notie++; flags.push(`${c0.number}/${num}: group ${groupSum.toFixed(2)} vs JP ${jpTotal.toFixed(2)}`); }
    }
    unmapped += appInvs.filter((i) => !used.has(i.id)).length;
  }

  let wrote = 0;
  if (APPLY) {
    for (const [invId, num] of assign) {
      const { error } = await sb.from("subcontractor_invoices").update({ jobplanner_pay_app_number: num }).eq("id", invId);
      if (error) throw new Error(`tag ${invId}: ${error.message}`);
      wrote++;
    }
  }

  console.log(`\nPay-app mapping — project ${PROJECT_ID} (JP ${JP_ID})  (${APPLY ? "APPLIED" : "DRY RUN"})`);
  console.log(`JP pay-apps: ${payApps}  |  tie exactly: ${tie}  |  don't tie: ${notie}`);
  console.log(`App invoices tagged: ${assign.size} / ${inv.length}  |  left untagged (non-pay-app bills): ${unmapped}`);
  if (APPLY) console.log(`WROTE jobplanner_pay_app_number on ${wrote} invoices`);
  if (flags.length) { console.log(`\nNon-tying pay-apps (${flags.length}):`); flags.slice(0, 20).forEach((f) => console.log("  " + f)); }
}
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
