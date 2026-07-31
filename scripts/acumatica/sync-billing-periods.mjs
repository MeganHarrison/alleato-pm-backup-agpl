#!/usr/bin/env node

/**
 * Sync invoicing BILLING PERIODS from Acumatica financial periods.
 *
 * The app's Billing Periods tab and the "Billing Period" invoice column read the
 * `billing_periods` table (+ `subcontractor_invoices.billing_period_id`). For
 * Acumatica-imported projects both were empty — the periods were never created and
 * invoices were never linked. Acumatica AP bills carry a `post_period` (MMYYYY, the GL
 * financial period), which is the source of truth for which period an invoice bills.
 *
 * This tool, per project:
 *   1. Reads every subcontractor invoice's linked Acumatica AP bill `post_period`.
 *   2. Creates one `billing_periods` row per distinct period (name "September 2025",
 *      start/end = calendar-month bounds), idempotent on (project_id, start_date).
 *   3. Links each `subcontractor_invoices.billing_period_id` to its period.
 *
 * Synced periods are marked is_closed=true (they are posted Acumatica periods), which
 * also keeps the app's "one open period at a time" rule intact.
 *
 * DRY RUN by default. Usage:
 *   node scripts/acumatica/sync-billing-periods.mjs --project=25125
 *   node scripts/acumatica/sync-billing-periods.mjs --project=25125 --apply
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
const argValue = (name, fb) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
};
const PROJECT_ID = Number(argValue("project", NaN));
if (!Number.isInteger(PROJECT_ID)) { console.error("Required: --project=<appProjectId>"); process.exit(1); }

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// post_period "MMYYYY" -> { ym, name, start_date, end_date }; null if unparseable
function parsePostPeriod(pp) {
  const s = String(pp ?? "").trim();
  if (!/^\d{6}$/.test(s)) return null;
  const mm = Number(s.slice(0, 2));
  const yyyy = Number(s.slice(2));
  if (mm < 1 || mm > 12) return null;
  const lastDay = new Date(yyyy, mm, 0).getDate(); // day 0 of next month = last day of this month
  return {
    ym: yyyy * 100 + mm,
    name: `${MONTHS[mm - 1]} ${yyyy}`,
    start_date: `${yyyy}-${String(mm).padStart(2, "0")}-01`,
    end_date: `${yyyy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1. invoices + their AP bill post_period
  const { data: invoices, error: invErr } = await sb
    .from("subcontractor_invoices")
    .select("id, billing_period_id, acumatica_ap_bill_id")
    .eq("project_id", PROJECT_ID);
  if (invErr) throw new Error(`subcontractor_invoices: ${invErr.message}`);
  const billIds = [...new Set((invoices ?? []).map((i) => i.acumatica_ap_bill_id).filter((x) => x != null))];
  const billPeriodById = new Map();
  if (billIds.length) {
    const { data: bills, error: bErr } = await sb.from("acumatica_ap_bills").select("id, post_period").in("id", billIds);
    if (bErr) throw new Error(`acumatica_ap_bills: ${bErr.message}`);
    for (const b of bills ?? []) billPeriodById.set(b.id, b.post_period);
  }

  // 2. distinct periods needed
  const needed = new Map(); // ym -> parsed
  for (const inv of invoices ?? []) {
    const pp = inv.acumatica_ap_bill_id != null ? billPeriodById.get(inv.acumatica_ap_bill_id) : null;
    const parsed = parsePostPeriod(pp);
    if (parsed) needed.set(parsed.ym, parsed);
  }
  const neededSorted = [...needed.values()].sort((a, b) => a.ym - b.ym);

  // 3. existing billing_periods
  const { data: existing, error: exErr } = await sb
    .from("billing_periods")
    .select("id, start_date, period_number, name")
    .eq("project_id", PROJECT_ID);
  if (exErr) throw new Error(`billing_periods read: ${exErr.message}`);
  const periodIdByStart = new Map((existing ?? []).map((p) => [p.start_date, p.id]));
  let nextNum = Math.max(0, ...(existing ?? []).map((p) => p.period_number || 0)) + 1;

  const created = [];
  const periodIdByYm = new Map();
  for (const p of neededSorted) {
    if (periodIdByStart.has(p.start_date)) { periodIdByYm.set(p.ym, periodIdByStart.get(p.start_date)); continue; }
    if (!APPLY) { periodIdByYm.set(p.ym, `(new:${p.name})`); created.push(p.name); continue; }
    const { data, error } = await sb
      .from("billing_periods")
      .insert({ project_id: PROJECT_ID, name: p.name, start_date: p.start_date, end_date: p.end_date, period_number: nextNum++, is_closed: true })
      .select("id")
      .single();
    if (error) throw new Error(`billing_periods insert ${p.name}: ${error.message}`);
    periodIdByStart.set(p.start_date, data.id);
    periodIdByYm.set(p.ym, data.id);
    created.push(p.name);
  }

  // 4. link invoices
  let toLink = 0, linked = 0, alreadyLinked = 0, noPeriod = 0;
  for (const inv of invoices ?? []) {
    const pp = inv.acumatica_ap_bill_id != null ? billPeriodById.get(inv.acumatica_ap_bill_id) : null;
    const parsed = parsePostPeriod(pp);
    if (!parsed) { noPeriod++; continue; }
    const pid = periodIdByYm.get(parsed.ym);
    if (inv.billing_period_id && inv.billing_period_id === pid) { alreadyLinked++; continue; }
    toLink++;
    if (!APPLY || typeof pid !== "string" || pid.startsWith("(new:")) continue;
    const { error } = await sb.from("subcontractor_invoices").update({ billing_period_id: pid }).eq("id", inv.id);
    if (error) throw new Error(`link invoice ${inv.id}: ${error.message}`);
    linked++;
  }

  console.log(`\nBilling-period sync — project ${PROJECT_ID}   (${APPLY ? "APPLIED" : "DRY RUN"})`);
  console.log(`Invoices: ${(invoices ?? []).length}  (no period: ${noPeriod}, already linked: ${alreadyLinked})`);
  console.log(`Periods needed: ${neededSorted.length}  →  ${APPLY ? "created" : "would create"} ${created.length}: ${created.join(", ") || "(none)"}`);
  console.log(`Invoice links: ${APPLY ? `${linked} linked` : `${toLink} to link`}`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
