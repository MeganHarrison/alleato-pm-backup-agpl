#!/usr/bin/env node

/**
 * Backfill commitment PAYMENTS the app's Acumatica sync missed, using Job Planner.
 *
 * JP payments carry externalObject.externalId = the Acumatica payment ref and an invoice
 * number; the app's commitment_payments dedupe on a unique external_key of the form
 * `Payment|<paymentRef>|Bill|<billRef>` — the SAME key the Acumatica sync uses. So we can
 * safely insert the payments JP has that the app is missing: if the Acumatica sync later
 * catches up, the unique external_key makes it a no-op (no duplicates).
 *
 * Each JP payment is matched to its app invoice by (jobplanner_pay_app_number == JP invoice
 * number) AND (Acumatica bill amount == payment amount) — giving subcontract, invoice, and
 * the bill ref for the external_key.
 *
 * DRY RUN by default. Usage:
 *   node scripts/jobplanner/reconcile-payments.mjs --project=25125 --jp=5092
 *   node scripts/jobplanner/reconcile-payments.mjs --project=25125 --jp=5092 --apply
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
const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

async function main() {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const commits = await jpGet(`${V2}/projects/${JP_ID}/commitments`);

  const { data: subs } = await sb.from("subcontracts").select("id, contract_number").eq("project_id", PROJECT_ID).is("deleted_at", null);
  const scIdByNum = new Map((subs ?? []).map((s) => [String(s.contract_number).toUpperCase(), s.id]));

  const { data: inv } = await sb.from("subcontractor_invoices").select("id, subcontract_id, acumatica_ref_nbr, acumatica_ap_bill_id, jobplanner_pay_app_number").eq("project_id", PROJECT_ID);
  const { data: bills } = await sb.from("acumatica_ap_bills").select("id, amount").in("id", inv.map((i) => i.acumatica_ap_bill_id).filter(Boolean));
  const amtByBill = new Map((bills ?? []).map((b) => [b.id, Number(b.amount) || 0]));

  const { data: existing } = await sb.from("commitment_payments").select("external_key").eq("project_id", PROJECT_ID);
  const haveKeys = new Set((existing ?? []).map((p) => p.external_key));

  const create = [], flags = [];
  for (const c0 of commits) {
    const scId = scIdByNum.get(String(c0.number).toUpperCase());
    if (!scId) continue;
    const detail = await jpGet(`${V2}/commitments/${c0.id}`);
    const scInv = inv.filter((i) => i.subcontract_id === scId);
    // Wash guard: if a payment amount repeats across 2+ pay-apps in this commitment,
    // it's a credit/debit-adjustment zone (e.g. SC-5092-0004 $34,785) — never auto-book money there.
    const amtCounts = new Map();
    for (const pay of detail.payments ?? []) { const a = c2d(pay.amount).toFixed(2); amtCounts.set(a, (amtCounts.get(a) ?? 0) + 1); }
    for (const pay of detail.payments ?? []) {
      if ((amtCounts.get(c2d(pay.amount).toFixed(2)) ?? 0) > 1) { flags.push(`${c0.number} pay ${money(c2d(pay.amount))} inv ${pay.invoiceNumber}: WASH (amount repeats in commitment — adjustment zone)`); continue; }
      const amt = c2d(pay.amount);
      const acuRef = pay.externalObject?.externalId ? String(pay.externalObject.externalId) : null;
      // Require an UNAMBIGUOUS match: exactly one app bill in this pay-app at this amount.
      // Credit/adjustment zones repeat the same amount across bills — never guess money.
      const matches = scInv.filter((i) => i.jobplanner_pay_app_number === pay.invoiceNumber && near(amtByBill.get(i.acumatica_ap_bill_id) ?? -1, amt));
      const target = matches.length === 1 ? matches[0] : null;
      if (!acuRef || !target) { flags.push(`${c0.number} pay ${money(amt)} inv ${pay.invoiceNumber}: ${!acuRef ? "no Acu ref" : matches.length > 1 ? `AMBIGUOUS (${matches.length} bills at this amount)` : "no matching app bill"}`); continue; }
      const billRef = target.acumatica_ref_nbr;
      const external_key = `Payment|${acuRef}|Bill|${billRef}`;
      if (haveKeys.has(external_key)) continue; // already present (dedup)
      haveKeys.add(external_key);
      create.push({ external_key, scId, invoiceId: target.id, billId: target.acumatica_ap_bill_id ?? null, amount: amt, acuRef, checkNumber: pay.checkNumber || null, date: pay.dateReceived || null, vendor: detail.contractedContact?.companyName || null });
    }
  }

  let wrote = 0;
  if (APPLY) {
    for (const p of create) {
      const { error } = await sb.from("commitment_payments").insert({
        project_id: PROJECT_ID, subcontract_id: p.scId, subcontractor_invoice_id: p.invoiceId,
        external_key: p.external_key, payment_number: p.acuRef, payment_ref: p.checkNumber,
        amount: p.amount, status: "Closed", source: "jobplanner", payment_date: p.date,
        vendor_name: p.vendor, acumatica_ap_bill_id: p.billId ?? null,
      });
      if (error) throw new Error(`payment ${p.external_key}: ${error.message}`);
      wrote++;
    }
  }

  console.log(`\nPayment reconcile — project ${PROJECT_ID} (JP ${JP_ID})  (${APPLY ? "APPLIED" : "DRY RUN"})`);
  console.log(`Missing payments to backfill: ${create.length}  |  unmatched (flagged): ${flags.length}`);
  for (const p of create.slice(0, 12)) console.log(`  + ${money(p.amount)}  Acu ${p.acuRef}  check ${p.checkNumber ?? "-"}  key ${p.external_key}`);
  if (create.length > 12) console.log(`  … +${create.length - 12} more`);
  if (flags.length) { console.log(`\nFlagged (no match):`); flags.slice(0, 12).forEach((f) => console.log("  " + f)); }
  if (APPLY) console.log(`\nWROTE ${wrote} commitment_payments`);
}
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
