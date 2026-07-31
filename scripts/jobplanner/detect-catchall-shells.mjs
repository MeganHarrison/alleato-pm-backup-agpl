#!/usr/bin/env node

/**
 * Detect "catch-all shell" commitments across ALL projects — a guardrail against the class of
 * bug where an Acumatica AP sync dumps a whole project's bills onto one tiny commitment
 * (e.g. SC-000316 Goodwill Bloomington: $1.13M of invoices on a $6,500 / 1-SOV-line shell).
 *
 * A commitment is a SUSPECTED SHELL when the sum of its Acumatica-linked invoices' bill amounts
 * far exceeds its SOV contract total. The primary signal is billed/contract ratio; an outsized
 * invoice-count against a single lump SOV line is reported as a weaker, informational signal
 * (many legitimate commitments have one lump SOV line and many PayApps).
 *
 * Remediate a confirmed shell with:
 *   node scripts/jobplanner/reattribute-shell-invoices.mjs --shell=<id> --project=<num>
 *
 * Usage:
 *   node scripts/jobplanner/detect-catchall-shells.mjs                 # ratio >= 2x (default)
 *   node scripts/jobplanner/detect-catchall-shells.mjs --ratio=1.5     # more sensitive
 */

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

const arg = (n) => { const p = process.argv.find((a) => a.startsWith(`--${n}=`)); return p ? p.split("=")[1] : null; };
const RATIO = Number(arg("ratio") || 2);
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function pageAll(table, cols) {
  const out = []; let from = 0; const size = 1000;
  for (;;) { const { data, error } = await sb.from(table).select(cols).range(from, from + size - 1); if (error) throw error; out.push(...(data || [])); if (!data || data.length < size) break; from += size; }
  return out;
}

async function main() {
  const bills = await pageAll("acumatica_ap_bills", "id, amount");
  const billAmt = new Map(bills.map((b) => [b.id, Number(b.amount || 0)]));
  const { data: projs } = await sb.from("projects").select("id, project_number, name");
  const pname = new Map((projs || []).map((p) => [p.id, `${p.project_number || "—"} ${p.name}`]));

  const tables = [
    { table: "subcontracts", sov: "subcontract_sov_items", fk: "subcontract_id" },
    { table: "purchase_orders", sov: "purchase_order_sov_items", fk: "purchase_order_id" },
  ];
  const shells = [];
  for (const { table, sov, fk } of tables) {
    const active = (await pageAll(table, "id, contract_number, project_id, deleted_at, title, contract_company_id")).filter((c) => !c.deleted_at);
    const sovRows = await pageAll(sov, `${fk}, amount`);
    const sovAgg = new Map();
    for (const r of sovRows) { if (!sovAgg.has(r[fk])) sovAgg.set(r[fk], { total: 0, lines: 0 }); const a = sovAgg.get(r[fk]); a.total += Number(r.amount || 0); a.lines++; }
    const invRows = await pageAll("subcontractor_invoices", `${fk}, acumatica_ap_bill_id`);
    const invAgg = new Map();
    for (const r of invRows) { const id = r[fk]; if (!id) continue; if (!invAgg.has(id)) invAgg.set(id, { count: 0, billed: 0 }); const a = invAgg.get(id); a.count++; if (r.acumatica_ap_bill_id) a.billed += billAmt.get(r.acumatica_ap_bill_id) || 0; }

    for (const c of active) {
      const inv = invAgg.get(c.id); if (!inv || inv.count === 0) continue;
      const s = sovAgg.get(c.id) || { total: 0, lines: 0 };
      if (s.total > 0 && inv.billed > RATIO * s.total) {
        shells.push({ project: pname.get(c.project_id) || c.project_id, kind: table, contract_number: c.contract_number, id: c.id, title: (c.title || "").slice(0, 30), sovTotal: Math.round(s.total * 100) / 100, sovLines: s.lines, invCount: inv.count, billed: Math.round(inv.billed * 100) / 100, ratio: (inv.billed / s.total).toFixed(1) + "x", noVendor: !c.contract_company_id });
      }
    }
  }
  shells.sort((a, b) => b.billed - a.billed);
  console.log(`\n=== CATCH-ALL SHELLS: Acumatica billed > ${RATIO}x contract — ${shells.length} found ===\n`);
  if (!shells.length) { console.log("  (none — clean)"); return; }
  console.log("project                              commit        contract$      invs   billed$        ratio  flags");
  for (const s of shells) {
    console.log(`  ${String(s.project).slice(0, 34).padEnd(34)} ${s.contract_number.padEnd(12)} $${String(s.sovTotal.toLocaleString()).padStart(11)}   ${String(s.invCount).padStart(4)}  $${String(s.billed.toLocaleString()).padStart(12)}  ${String(s.ratio).padStart(6)}  ${s.noVendor ? "NO-VENDOR " : ""}${s.sovLines <= 1 ? "1-SOV-LINE" : ""}`);
  }
  console.log(`\nRemediate each with:\n  node scripts/jobplanner/reattribute-shell-invoices.mjs --shell=<id> --project=<project_number>`);
  console.log("\nIds:");
  for (const s of shells) console.log(`  ${s.contract_number.padEnd(12)} ${s.id}  (${String(s.project).split(" ")[0]})`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
