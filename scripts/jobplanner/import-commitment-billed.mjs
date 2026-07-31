#!/usr/bin/env node

/**
 * ACUMATICA-CANONICAL commitment billed-to-date importer (dry-run by default).
 *
 * The commitment Financial Summary + SOV "Billed to Date" read from
 * `subcontract_sov_items.billed_to_date` / `purchase_order_sov_items.billed_to_date`
 * (summed by the `*_with_totals` views). Those were empty (and the JP SOV rebuild
 * reset them to 0), so every commitment showed $0 billed even where invoices exist.
 *
 * This sets each commitment's SOV billed_to_date from its ACUMATICA AP bills — the
 * accurate accounting source. Scope: commitments that already have an Acumatica-linked
 * invoice record (subcontractor_invoices.acumatica_ap_bill_id IS NOT NULL). JobPlanner-only
 * invoices (no Acumatica link) are skipped per the accounting-source-of-truth decision.
 * Does NOT create invoice records or invoice line items (separate follow-up tasks).
 *
 * Per commitment: billed_to_date = Σ(acumatica_ap_bill_lines.amount) across all its
 * Acumatica invoices, allocated to SOV lines by matching cost code (proportional to line
 * amount within a code); any billed on a cost code with no SOV line is spread across all
 * lines so the commitment TOTAL always equals the Acumatica total. Guardrail: aborts a
 * commitment if the placed total != the Acumatica total.
 *
 * Usage:
 *   node scripts/jobplanner/import-commitment-billed.mjs            # dry run (report only)
 *   node scripts/jobplanner/import-commitment-billed.mjs --apply    # execute
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
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-08-commitment-billed-from-acumatica");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

const dash = (c) => { const s = String(c || "").trim(); return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : s; };
const codePart = (budgetCode) => String(budgetCode || "").split(".")[0].trim(); // "50-7000.S" -> "50-7000"
const round2 = (n) => Math.round(n * 100) / 100;

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const tables = [
    { table: "subcontracts", sov: "subcontract_sov_items", fk: "subcontract_id" },
    { table: "purchase_orders", sov: "purchase_order_sov_items", fk: "purchase_order_id" },
  ];

  const perProject = new Map();
  let commitmentsTouched = 0, sovLinesUpdated = 0, totalPlaced = 0, flagged = [];

  for (const { table, sov, fk } of tables) {
    // commitments (via their table) that have >=1 Acumatica-linked invoice
    const { data: invs } = await sb.from("subcontractor_invoices").select(`${fk}, acumatica_ap_bill_id, project_id`).not(fk, "is", null).not("acumatica_ap_bill_id", "is", null);
    const byCommit = new Map();
    for (const inv of invs ?? []) {
      const id = inv[fk];
      if (!byCommit.has(id)) byCommit.set(id, { billIds: new Set(), project_id: inv.project_id });
      byCommit.get(id).billIds.add(inv.acumatica_ap_bill_id);
    }

    for (const [commitmentId, { billIds, project_id }] of byCommit) {
      // only active commitments
      const { data: head } = await sb.from(table).select("id, contract_number, deleted_at, project_id").eq("id", commitmentId).maybeSingle();
      if (!head || head.deleted_at) continue;

      // Σ acumatica ap_bill_lines by dashed cost code
      const billedByCode = new Map();
      let acuTotal = 0;
      for (const bid of billIds) {
        const { data: bl } = await sb.from("acumatica_ap_bill_lines").select("amount, extended_cost, cost_code").eq("bill_id", bid);
        for (const l of bl ?? []) {
          const amt = Number(l.amount ?? l.extended_cost ?? 0);
          const code = dash(l.cost_code);
          billedByCode.set(code, (billedByCode.get(code) || 0) + amt);
          acuTotal += amt;
        }
      }
      if (acuTotal === 0) continue;

      const { data: sovRows } = await sb.from(sov).select("id, budget_code, amount").eq(fk, commitmentId);
      if (!sovRows || sovRows.length === 0) { flagged.push({ commitmentId, contract_number: head.contract_number, reason: "no SOV lines", acuTotal }); continue; }

      // allocate billed to SOV lines
      const billed = new Map(sovRows.map((r) => [r.id, 0]));
      const sovAmt = (r) => Math.max(Number(r.amount) || 0, 0);
      const totalSovAmt = sovRows.reduce((a, r) => a + sovAmt(r), 0);

      // GUARDRAIL: billed far exceeding the contract amount means invoices are
      // mis-linked to this commitment (e.g. a catch-all shell that soaked up a whole
      // project's AP bills — SC-000316 on Goodwill Bloomington: $1.13M on a $6,500
      // contract). Never write that; flag for re-attribution instead.
      if (totalSovAmt > 0 && acuTotal > 2 * totalSovAmt) {
        flagged.push({ commitmentId, contract_number: head.contract_number, reason: `MIS-LINKED (SKIPPED): billed $${round2(acuTotal)} is ${(acuTotal / totalSovAmt).toFixed(1)}x the $${round2(totalSovAmt)} contract`, acuTotal });
        continue;
      }
      let unmatched = 0;
      for (const [code, amt] of billedByCode) {
        const matches = sovRows.filter((r) => codePart(r.budget_code) === code);
        if (matches.length === 0) { unmatched += amt; continue; }
        const denom = matches.reduce((a, r) => a + sovAmt(r), 0);
        for (const m of matches) {
          const share = denom > 0 ? (sovAmt(m) / denom) * amt : amt / matches.length;
          billed.set(m.id, billed.get(m.id) + share);
        }
      }
      if (unmatched > 0) {
        for (const r of sovRows) {
          const share = totalSovAmt > 0 ? (sovAmt(r) / totalSovAmt) * unmatched : unmatched / sovRows.length;
          billed.set(r.id, billed.get(r.id) + share);
        }
      }
      // round + reconcile rounding drift onto the largest line so the total is exact
      const entries = sovRows.map((r) => ({ id: r.id, val: round2(billed.get(r.id)) }));
      const placed = entries.reduce((a, e) => a + e.val, 0);
      const drift = round2(acuTotal - placed);
      if (Math.abs(drift) >= 0.01 && entries.length) {
        const biggest = entries.reduce((a, b) => (b.val > a.val ? b : a));
        biggest.val = round2(biggest.val + drift);
      }
      const finalTotal = entries.reduce((a, e) => a + e.val, 0);
      if (Math.abs(finalTotal - acuTotal) >= 0.01) { flagged.push({ commitmentId, contract_number: head.contract_number, reason: `placement mismatch placed=${finalTotal} acu=${acuTotal}`, acuTotal }); continue; }

      const pid = head.project_id;
      const pp = perProject.get(pid) ?? { commitments: 0, billed: 0 };
      pp.commitments++; pp.billed += acuTotal; perProject.set(pid, pp);
      commitmentsTouched++; totalPlaced += acuTotal; sovLinesUpdated += entries.length;
      if (unmatched > 0) flagged.push({ commitmentId, contract_number: head.contract_number, reason: `cost-code fallback: $${round2(unmatched)} spread proportionally`, acuTotal });

      if (APPLY) {
        for (const e of entries) {
          const { error } = await sb.from(sov).update({ billed_to_date: e.val }).eq("id", e.id);
          if (error) throw new Error(`billed update ${head.contract_number} line ${e.id}: ${error.message}`);
        }
      }
    }
  }

  // project name lookup
  const { data: projs } = await sb.from("projects").select("id, project_number, name");
  const nameById = new Map((projs ?? []).map((p) => [p.id, `${p.project_number ?? "—"} ${p.name}`]));
  const projectRows = [...perProject.entries()].map(([pid, v]) => ({ project: nameById.get(pid) || pid, commitments: v.commitments, billed: round2(v.billed) })).sort((a, b) => b.billed - a.billed);

  const summary = { mode: APPLY ? "APPLY" : "DRY RUN", commitmentsTouched, sovLinesUpdated, totalBilledPlaced: round2(totalPlaced), flaggedCount: flagged.length, projects: projectRows.length };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "billed-plan.json"), JSON.stringify({ summary, projectRows, flagged }, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nTop projects by billed:");
  for (const r of projectRows.slice(0, 30)) console.log(`  ${String(r.project).padEnd(38)} commits=${String(r.commitments).padStart(3)} billed=$${r.billed.toLocaleString()}`);
  if (flagged.length) console.log(`\n${flagged.length} flagged (see billed-plan.json). Sample:`, flagged.slice(0, 5).map((f) => `${f.contract_number}: ${f.reason}`).join(" | "));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
