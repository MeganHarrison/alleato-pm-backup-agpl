#!/usr/bin/env node

/**
 * Create/link commitment invoices from ACUMATICA AP bills + set billed-to-date, so
 * commitments show their real Acumatica billing. This is the comprehensive step:
 * most commitments have NO invoice record — their billing lives in acumatica_ap_bills
 * whose description/vendor_ref reference the commitment by number (e.g. "PI-8189-0008",
 * "SC-8509-0002"). Acumatica is the accounting source of truth (per Megan).
 *
 * Per AP bill (scoped by its project_id) whose text contains a commitment number that
 * maps to an ACTIVE commitment on that project:
 *   - link-or-create the subcontractor_invoices row (idempotent on acumatica_ap_bill_id):
 *     if a row already exists for the bill, set its subcontract_id/purchase_order_id;
 *     else insert one (invoice_number=reference_nbr, status from bill status, dates, notes).
 *   - create subcontractor_invoice_line_items from acumatica_ap_bill_lines if missing
 *     (budget_code=dashed cost code, work_completed_period=amount; net_amount_this_period
 *     is a GENERATED column — never inserted).
 * Then per commitment: set SOV billed_to_date = Σ AP bill lines by cost code (proportional
 * fallback so the commitment total == Acumatica total). GUARDRAIL: if billed > 2x the
 * contract, the invoices are mis-linked — skip billed (still link invoices) and flag.
 *
 * Excludes project_code 24109 (Goodwill Bloomington) — a separate session is re-attributing
 * its mis-linked invoices. Credits/adjustments (document_type contains "credit"/"debit") and
 * bills with no commitment match are skipped.
 *
 * Usage:
 *   node scripts/jobplanner/import-commitment-invoices.mjs            # dry run
 *   node scripts/jobplanner/import-commitment-invoices.mjs --apply    # execute
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
const EXCLUDE_PROJECT_CODES = new Set(["24109"]); // Goodwill Bloomington — concurrent re-attribution
const PAGE_SIZE = 1000;
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-08-commitment-invoices-from-acumatica");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

const dash = (c) => { const s = String(c || "").trim(); return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : s; };
const codePart = (bc) => String(bc || "").split(".")[0].trim();
const round2 = (n) => Math.round(n * 100) / 100;
const mapStatus = (s) => { const t = String(s || "").toLowerCase(); if (t === "closed") return "paid"; if (t === "open") return "approved"; if (t.includes("hold")) return "pending"; return "pending"; };
const extractNum = (txt) => { const m = String(txt || "").match(/(\d{4})-(\d{4})/); return m ? `${m[1]}-${m[2]}` : null; };
const isCreditDocType = (t) => { const s = String(t || "").toLowerCase(); return s.includes("credit") || s.includes("debit"); };

// PostgREST/Supabase caps unpaginated selects at a default row limit — page through in full so
// growing Acumatica tables can never silently truncate this scan on a future re-run.
async function pagedSelect(buildQuery, pageSize = PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // active commitments by project -> map "{jp}-{seq}" -> {id, table, contract_number}
  const commitByProjKey = new Map(); // projectId -> Map(key -> commit)
  for (const [table, kind] of [["subcontracts", "subcontract"], ["purchase_orders", "purchase_order"]]) {
    const data = await pagedSelect(() => sb.from(table).select("id, project_id, contract_number").is("deleted_at", null));
    for (const c of data) {
      const key = extractNum(c.contract_number);
      if (!key) continue;
      if (!commitByProjKey.has(c.project_id)) commitByProjKey.set(c.project_id, new Map());
      commitByProjKey.get(c.project_id).set(key, { id: c.id, table, kind, contract_number: c.contract_number });
    }
  }

  // ---- PASS 1 (read-only): match bills to commitments, accumulate per commitment ----
  const bills = await pagedSelect(() => sb.from("acumatica_ap_bills").select("id, project_id, project_code, reference_nbr, document_type, date, status, description, vendor_ref"));
  const stats = { billsScanned: 0, matched: 0, unmatched: 0, creditsSkipped: 0, invoicesCreated: 0, invoicesLinked: 0, lineItemsCreated: 0 };
  const byCommit = new Map(); // commitId -> {commit, projectId, byCode:Map, total, bills:[]}
  const flagged = [];

  for (const b of bills) {
    if (!b.project_id || EXCLUDE_PROJECT_CODES.has(String(b.project_code))) continue;
    if (isCreditDocType(b.document_type)) { stats.creditsSkipped++; continue; }
    stats.billsScanned++;
    const projMap = commitByProjKey.get(b.project_id);
    const key = projMap ? extractNum(`${b.description || ""} ${b.vendor_ref || ""}`) : null;
    const commit = key ? projMap.get(key) : null;
    if (!commit) { stats.unmatched++; continue; }
    stats.matched++;
    const { data: blines } = await sb.from("acumatica_ap_bill_lines").select("amount, extended_cost, cost_code, transaction_description, description").eq("bill_id", b.id);
    if (!byCommit.has(commit.id)) byCommit.set(commit.id, { commit, projectId: b.project_id, byCode: new Map(), total: 0, bills: [] });
    const acc = byCommit.get(commit.id);
    acc.bills.push({ ...b, blines: blines ?? [] });
    for (const l of blines ?? []) { const amt = Number(l.amount ?? l.extended_cost ?? 0); acc.byCode.set(dash(l.cost_code), (acc.byCode.get(dash(l.cost_code)) || 0) + amt); acc.total += amt; }
  }

  // ---- classify clean vs mis-linked (needs SOV totals) ----
  const clean = [];
  for (const [commitId, acc] of byCommit) {
    const { kind, contract_number } = acc.commit;
    const sovTable = kind === "subcontract" ? "subcontract_sov_items" : "purchase_order_sov_items";
    const fk = kind === "subcontract" ? "subcontract_id" : "purchase_order_id";
    const { data: sovRows } = await sb.from(sovTable).select("id, budget_code, amount").eq(fk, commitId);
    if (!sovRows || !sovRows.length) { flagged.push({ contract_number, reason: "no SOV lines", total: round2(acc.total) }); continue; }
    const sovAmt = (r) => Math.max(Number(r.amount) || 0, 0);
    const totalSov = sovRows.reduce((a, r) => a + sovAmt(r), 0);
    if (acc.total <= 0) continue;
    // GUARDRAIL: mis-linked commitment — skip ENTIRELY (no invoices, no billed).
    if (totalSov > 0 && acc.total > 2 * totalSov) { flagged.push({ contract_number, reason: `MIS-LINKED (skipped): billed $${round2(acc.total)} is ${(acc.total / totalSov).toFixed(1)}x $${round2(totalSov)} contract`, total: round2(acc.total) }); continue; }
    clean.push({ commitId, acc, sovRows, sovTable, fk, totalSov, sovAmt });
  }

  // ---- PASS 2 (--apply): link/create invoices + line items, then set billed, for CLEAN only ----
  const perProject = new Map();
  let commitmentsBilled = 0, totalBilled = 0;
  for (const { commitId, acc, sovRows, sovTable, fk, totalSov, sovAmt } of clean) {
    const { kind, contract_number } = acc.commit;
    const linkCol = kind === "subcontract" ? "subcontract_id" : "purchase_order_id";

    for (const b of acc.bills) {
      const docType = b.document_type ?? "Bill";
      // idempotency: an invoice may already exist keyed on the bill id, or on the
      // (doc_type, ref_nbr) pair — ref_nbr alone is NOT globally unique across doc types
      // (mirrors the acumatica_doc_type|ref_nbr keying used in acumatica_sync.py). Two
      // explicit .eq() lookups instead of one interpolated .or() string, since a ref_nbr
      // containing "," or "()" would otherwise break/mismatch the PostgREST filter.
      const invoiceCols = "id, subcontract_id, purchase_order_id, acumatica_ap_bill_id, period_end";
      const { data: byId } = await sb.from("subcontractor_invoices").select(invoiceCols).eq("acumatica_ap_bill_id", b.id).limit(1);
      let existingInv = byId?.[0] ?? null;
      if (!existingInv) {
        const { data: byRef } = await sb.from("subcontractor_invoices").select(invoiceCols).eq("acumatica_ref_nbr", b.reference_nbr).eq("acumatica_doc_type", docType).limit(1);
        existingInv = byRef?.[0] ?? null;
      }
      let invoiceId = existingInv?.id ?? null;
      if (APPLY) {
        if (invoiceId) {
          const upd = {};
          if (!existingInv[linkCol]) upd[linkCol] = acc.commit.id;
          if (!existingInv.acumatica_ap_bill_id) upd.acumatica_ap_bill_id = b.id;
          if (!existingInv.period_end) upd.period_end = b.date;
          if (Object.keys(upd).length) { upd.project_id = b.project_id; const { error } = await sb.from("subcontractor_invoices").update(upd).eq("id", invoiceId); if (error) throw new Error(`link ${b.reference_nbr}: ${error.message}`); stats.invoicesLinked++; }
        } else {
          const { data: ins, error } = await sb.from("subcontractor_invoices").insert({ project_id: b.project_id, [linkCol]: acc.commit.id, invoice_number: b.reference_nbr, status: mapStatus(b.status), billing_date: b.date, period_end: b.date, notes: b.description ?? null, acumatica_ap_bill_id: b.id, acumatica_ref_nbr: b.reference_nbr, acumatica_doc_type: docType }).select("id").single();
          if (error) throw new Error(`create ${b.reference_nbr}: ${error.message}`);
          invoiceId = ins.id; stats.invoicesCreated++;
        }
        const { count: liCount } = await sb.from("subcontractor_invoice_line_items").select("id", { count: "exact", head: true }).eq("invoice_id", invoiceId);
        if ((liCount ?? 0) === 0 && b.blines.length) {
          // scheduled_value mirrors the manual-invoice seeding pattern (route.ts): the SOV
          // line's full contract amount, not the amount billed this period — otherwise the
          // invoice detail grid shows a partial bill as if it were the whole schedule value.
          const rows = b.blines.map((l, i) => {
            const code = dash(l.cost_code);
            const sovMatches = sovRows.filter((r) => codePart(r.budget_code) === code);
            const scheduled = sovMatches.length ? sovMatches.reduce((a, r) => a + sovAmt(r), 0) : Number(l.amount ?? l.extended_cost ?? 0);
            return { invoice_id: invoiceId, budget_code: code, description: l.transaction_description || l.description || null, work_completed_period: Number(l.amount ?? l.extended_cost ?? 0), scheduled_value: scheduled, sort_order: i + 1 };
          });
          const { error } = await sb.from("subcontractor_invoice_line_items").insert(rows);
          if (error) throw new Error(`lines ${b.reference_nbr}: ${error.message}`);
          stats.lineItemsCreated += rows.length;
        }
      } else { if (invoiceId) stats.invoicesLinked++; else stats.invoicesCreated++; }
    }

    const billed = new Map(sovRows.map((r) => [r.id, 0]));
    let unmatched = 0;
    for (const [code, amt] of acc.byCode) {
      const matches = sovRows.filter((r) => codePart(r.budget_code) === code);
      if (!matches.length) { unmatched += amt; continue; }
      const denom = matches.reduce((a, r) => a + sovAmt(r), 0);
      for (const m of matches) billed.set(m.id, billed.get(m.id) + (denom > 0 ? (sovAmt(m) / denom) * amt : amt / matches.length));
    }
    if (unmatched > 0) for (const r of sovRows) billed.set(r.id, billed.get(r.id) + (totalSov > 0 ? (sovAmt(r) / totalSov) * unmatched : unmatched / sovRows.length));
    const entries = sovRows.map((r) => ({ id: r.id, val: round2(billed.get(r.id)) }));
    const drift = round2(acc.total - entries.reduce((a, e) => a + e.val, 0));
    if (Math.abs(drift) >= 0.01) { const big = entries.reduce((a, b) => (b.val > a.val ? b : a)); big.val = round2(big.val + drift); }
    if (APPLY) for (const e of entries) { const { error } = await sb.from(sovTable).update({ billed_to_date: e.val }).eq("id", e.id); if (error) throw new Error(`billed ${contract_number}: ${error.message}`); }
    commitmentsBilled++; totalBilled += acc.total;
    const pp = perProject.get(acc.projectId) ?? { commitments: 0, billed: 0 }; pp.commitments++; pp.billed += acc.total; perProject.set(acc.projectId, pp);
  }

  const { data: projs } = await sb.from("projects").select("id, project_number, name");
  const nameById = new Map((projs ?? []).map((p) => [p.id, `${p.project_number ?? "—"} ${p.name}`]));
  const projectRows = [...perProject.entries()].map(([pid, v]) => ({ project: nameById.get(pid) || pid, commitments: v.commitments, billed: round2(v.billed) })).sort((a, b) => b.billed - a.billed);
  const summary = { mode: APPLY ? "APPLY" : "DRY RUN", ...stats, commitmentsBilled, totalBilled: round2(totalBilled), flaggedCount: flagged.length, projects: projectRows.length };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "invoices-plan.json"), JSON.stringify({ summary, projectRows, flagged }, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nTop projects by billed:");
  for (const r of projectRows.slice(0, 25)) console.log(`  ${String(r.project).padEnd(38)} commits=${String(r.commitments).padStart(3)} billed=$${r.billed.toLocaleString()}`);
  if (flagged.length) console.log(`\n${flagged.length} flagged:`, flagged.slice(0, 6).map((f) => `${f.contract_number}: ${f.reason}`).join(" | "));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
