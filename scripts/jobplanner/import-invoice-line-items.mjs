#!/usr/bin/env node

/**
 * Populate per-invoice SOV line detail from Acumatica AP bills (dry-run by default).
 *
 * A commitment's Invoices tab renders `subcontractor_invoice_line_items`. For invoices
 * imported from Acumatica (`subcontractor_invoices.acumatica_ap_bill_id IS NOT NULL`)
 * we only stored the header + (via PR #723) a rolled-up `billed_to_date` on the SOV —
 * so the Invoices tab showed a total but NO line detail. This creates one invoice line
 * item per `acumatica_ap_bill_lines` row of the linked bill so the tab shows real lines.
 *
 * Scope: Acumatica-linked invoices ONLY (per the accounting-source-of-truth decision —
 * JobPlanner-only invoices are not trusted). Idempotent: invoices that already have any
 * line items are skipped, so re-running never duplicates.
 *
 * Mapping (verified against the working McLane pilot invoice #919 / bill 29865):
 *   - one line item per acumatica_ap_bill_lines row
 *   - budget_code            = dashed cost code ("507000" -> "50-7000"); null if garbage ("{}")
 *   - description            = transaction_description || description
 *   - scheduled_value        = work_completed_period = amount (falls back to extended_cost)
 *   - work_completed_pct     = 100 (scheduled == completed this period)
 *   - retainage / materials  = 0 (Acumatica bills carry no per-line retainage here)
 *   - sort_order             = line index + 1
 *   - net_amount_this_period, total_completed_stored, balance_to_finish are GENERATED
 *     columns — never inserted.
 *
 * Because work_completed_period == amount and retainage == 0, the generated
 * net_amount_this_period == amount, so `subcontracts_with_invoice_stats.total_billed_from_line_items`
 * (sum of the line items) equals each commitment's Acumatica billed total — the value
 * PR #723 wrote to subcontract_sov_items.billed_to_date. A --verify pass confirms this.
 *
 * Usage:
 *   node scripts/jobplanner/import-invoice-line-items.mjs            # dry run (report only)
 *   node scripts/jobplanner/import-invoice-line-items.mjs --apply    # execute
 *   node scripts/jobplanner/import-invoice-line-items.mjs --verify   # compare stats vs billed_to_date (post-apply)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
// node_modules live under frontend/; when run from a bare worktree, fall back to the
// primary checkout's frontend/package.json for module resolution.
function resolveRequire() {
  const candidates = [
    path.join(repoRoot, "frontend", "package.json"),
    "/Users/meganharrison/Documents/alleato-pm/frontend/package.json",
  ];
  for (const c of candidates) {
    try {
      const r = createRequire(c);
      r.resolve("dotenv");
      return r;
    } catch {
      /* try next */
    }
  }
  throw new Error("Could not resolve node modules (dotenv/@supabase/supabase-js)");
}
const frontendRequire = resolveRequire();
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-09-invoice-line-items-from-acumatica");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

/** "507000" -> "50-7000"; garbage ("{}", "", "null") -> null so we never store junk budget codes. */
const dashOrNull = (c) => {
  const s = String(c ?? "").trim();
  if (/^\d{6}$/.test(s)) return `${s.slice(0, 2)}-${s.slice(2)}`;
  return null;
};
const round2 = (n) => Math.round(n * 100) / 100;

async function fetchAll(sb, table, select, applyFilter) {
  const out = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    let q = sb.from(table).select(select).range(from, from + page - 1);
    q = applyFilter ? applyFilter(q) : q;
    const { data, error } = await q;
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
    from += page;
  }
  return out;
}

async function runVerify(sb) {
  // For every Acumatica-linked SUBCONTRACT invoice, compare the subcontract's
  // total_billed_from_line_items (now sourced from the line items we created) to the
  // sum of subcontract_sov_items.billed_to_date (written by PR #723). They should match.
  const invs = await fetchAll(
    sb,
    "subcontractor_invoices",
    "subcontract_id, acumatica_ap_bill_id",
    (q) => q.not("acumatica_ap_bill_id", "is", null).not("subcontract_id", "is", null),
  );
  const subIds = [...new Set(invs.map((i) => i.subcontract_id))];
  const mismatches = [];
  let matched = 0;
  for (const sid of subIds) {
    const { data: stat } = await sb
      .from("subcontracts_with_invoice_stats")
      .select("contract_number, total_billed_from_line_items")
      .eq("id", sid)
      .maybeSingle();
    if (!stat) continue;
    const sov = await fetchAll(sb, "subcontract_sov_items", "billed_to_date", (q) => q.eq("subcontract_id", sid));
    const billedToDate = round2(sov.reduce((a, r) => a + (Number(r.billed_to_date) || 0), 0));
    const fromLines = round2(Number(stat.total_billed_from_line_items) || 0);
    if (Math.abs(fromLines - billedToDate) >= 0.01) {
      mismatches.push({ subcontract_id: sid, contract_number: stat.contract_number, total_billed_from_line_items: fromLines, sum_billed_to_date: billedToDate, delta: round2(fromLines - billedToDate) });
    } else {
      matched++;
    }
  }
  const summary = { subcontractsChecked: subIds.length, matched, mismatches: mismatches.length };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "verify.json"), JSON.stringify({ summary, mismatches }, null, 2) + "\n");
  console.log("VERIFY", JSON.stringify(summary, null, 2));
  if (mismatches.length) console.log("Sample mismatches:", mismatches.slice(0, 10));
  return;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (VERIFY) return runVerify(sb);

  // 1. all Acumatica-linked invoices
  const invoices = await fetchAll(
    sb,
    "subcontractor_invoices",
    "id, acumatica_ap_bill_id, project_id, subcontract_id, purchase_order_id, invoice_number",
    (q) => q.not("acumatica_ap_bill_id", "is", null),
  );

  // 2. invoice_ids that already have >=1 line item (skip — idempotent)
  const existing = await fetchAll(sb, "subcontractor_invoice_line_items", "invoice_id");
  const haveLineItems = new Set(existing.map((r) => r.invoice_id));

  const targets = invoices.filter((i) => !haveLineItems.has(i.id));

  let invoicesTouched = 0;
  let linesCreated = 0;
  let skippedNoBillLines = 0;
  let commitmentLinkedTouched = 0;
  let nullBudgetCodeLines = 0;
  const flagged = [];

  for (const inv of targets) {
    const billLines = await fetchAll(
      sb,
      "acumatica_ap_bill_lines",
      "amount, extended_cost, cost_code, transaction_description, description, line_nbr, id",
      (q) => q.eq("bill_id", inv.acumatica_ap_bill_id),
    );
    if (billLines.length === 0) {
      skippedNoBillLines++;
      continue;
    }
    // deterministic order: by line_nbr then id
    billLines.sort((a, b) => (Number(a.line_nbr ?? a.id) - Number(b.line_nbr ?? b.id)));

    const rows = billLines.map((l, index) => {
      const amount = round2(Number(l.amount ?? l.extended_cost ?? 0));
      const budgetCode = dashOrNull(l.cost_code);
      if (!budgetCode) nullBudgetCodeLines++;
      const workCompletedPct = amount !== 0 ? 100 : 0; // scheduled == completed this period
      return {
        invoice_id: inv.id,
        budget_code: budgetCode,
        description: l.transaction_description || l.description || null,
        scheduled_value: amount,
        work_completed_previous: 0,
        work_completed_period: amount,
        materials_stored: 0,
        retainage_pct: 0,
        retainage_amount: 0,
        materials_retainage_pct: 0,
        materials_retainage_amount: 0,
        previous_work_retainage: 0,
        previous_materials_retainage: 0,
        work_retainage_released: 0,
        materials_retainage_released: 0,
        retainage_released: 0,
        work_completed_pct: workCompletedPct,
        sort_order: index + 1,
        // net_amount_this_period / total_completed_stored / balance_to_finish are GENERATED — omitted.
      };
    });

    const billTotal = round2(billLines.reduce((a, l) => a + Number(l.amount ?? l.extended_cost ?? 0), 0));
    const rowsTotal = round2(rows.reduce((a, r) => a + r.work_completed_period, 0));
    if (Math.abs(billTotal - rowsTotal) >= 0.01) {
      flagged.push({ invoice_id: inv.id, invoice_number: inv.invoice_number, reason: `row/bill total drift rows=${rowsTotal} bill=${billTotal}` });
    }

    if (APPLY) {
      const { error } = await sb.from("subcontractor_invoice_line_items").insert(rows);
      if (error) throw new Error(`insert line items invoice ${inv.id} (${inv.invoice_number}): ${error.message}`);
    }

    invoicesTouched++;
    linesCreated += rows.length;
    if (inv.subcontract_id || inv.purchase_order_id) commitmentLinkedTouched++;
  }

  const summary = {
    mode: APPLY ? "APPLY" : "DRY RUN",
    acumaticaLinkedInvoices: invoices.length,
    alreadyHadLineItems: invoices.length - targets.length,
    invoicesTouched,
    commitmentLinkedTouched,
    linesCreated,
    nullBudgetCodeLines,
    skippedNoBillLines,
    flaggedCount: flagged.length,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "line-items-plan.json"), JSON.stringify({ summary, flagged }, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  if (flagged.length) console.log(`\n${flagged.length} flagged (see line-items-plan.json). Sample:`, flagged.slice(0, 5));
  if (!APPLY) console.log("\nDry run only. Re-run with --apply to insert, then --verify.");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
