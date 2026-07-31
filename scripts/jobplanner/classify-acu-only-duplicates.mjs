#!/usr/bin/env node
/**
 * Classify remaining active Acumatica-numbered (SC-000xxx / bare-number) commitments that
 * were NOT re-keyed by the reconciler ("acu-only"), to find double-counting duplicates.
 *
 * For each acu-only row on a project, look for an ACTIVE JP-numbered row on the same project
 * with the same SOV total (±$0.50) AND same vendor. Buckets:
 *   DUP_SAFE   twin JP row exists, acu-only has 0 invoices + 0 payments -> safe to soft-delete
 *              (pure double-count; billing lives on the JP row or nowhere).
 *   DUP_BILLED twin JP row exists BUT acu-only carries invoices/payments -> FLAG (retiring
 *              would orphan billing; needs Megan / billing migration).
 *   ACU_ONLY   no JP twin -> genuine Acumatica-only work OR test data -> keep / review.
 *
 * READ-ONLY unless --apply, which soft-deletes ONLY DUP_SAFE rows (deleted_at = now()).
 *
 * Usage:
 *   node scripts/jobplanner/classify-acu-only-duplicates.mjs          # dry run (report)
 *   node scripts/jobplanner/classify-acu-only-duplicates.mjs --apply  # retire DUP_SAFE only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const req = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = req("dotenv");
const { createClient } = req("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
const APPLY = process.argv.includes("--apply");
const NOW = process.env.RECONCILE_NOW; // pass an ISO timestamp for deterministic apply
const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const APPS = [868,869,761,870,67,1067,25108,43,879,877,865,1009,178,1008,764,760,795,840,31,876];
const isJp = (n) => /-\d{4}-\d{4}$/.test(String(n || ""));
const isTest = (n) => /GAUNTLET|TEST|EDITED|SAMPLE|E2E|Updated|API-\d/i.test(String(n || ""));

const out = [];
for (const app of APPS) {
  for (const [tbl, sov, fk] of [["subcontracts","subcontract_sov_items","subcontract_id"],["purchase_orders","purchase_order_sov_items","purchase_order_id"]]) {
    const { data: cs } = await sb.from(tbl).select("id, contract_number, contract_company_id").eq("project_id", app).is("deleted_at", null);
    // build JP-row index (total+vendor)
    const withSums = [];
    for (const c of (cs || [])) {
      const { data: items } = await sb.from(sov).select("amount").eq(fk, c.id);
      withSums.push({ ...c, sovSum: Math.round((items||[]).reduce((a,x)=>a+(Number(x.amount)||0),0)*100)/100 });
    }
    const jpRows = withSums.filter((c) => isJp(c.contract_number));
    const acuRows = withSums.filter((c) => !isJp(c.contract_number));
    for (const a of acuRows) {
      const twin = jpRows.find((j) => Math.abs(j.sovSum - a.sovSum) < 0.5 && a.sovSum > 0 && j.contract_company_id && j.contract_company_id === a.contract_company_id);
      const { count: inv } = await sb.from("subcontractor_invoices").select("id",{count:"exact",head:true}).eq(fk, a.id);
      const { count: pay } = await sb.from("commitment_payments").select("id",{count:"exact",head:true}).eq(fk, a.id);
      let bucket;
      if (twin && (inv||0)===0 && (pay||0)===0) bucket = "DUP_SAFE";
      else if (twin) bucket = "DUP_BILLED";
      else bucket = isTest(a.contract_number) ? "TEST" : "ACU_ONLY";
      out.push({ app, table: tbl, id: a.id, number: a.contract_number, sovSum: a.sovSum, vendor: a.contract_company_id, inv: inv||0, pay: pay||0, twin: twin?.contract_number || null, bucket });
    }
  }
}
const by = (b) => out.filter((r) => r.bucket === b);
console.log("== ACU-ONLY CLASSIFICATION ==");
for (const b of ["DUP_SAFE","DUP_BILLED","ACU_ONLY","TEST"]) {
  const rows = by(b);
  console.log(`\n${b} (${rows.length})  sum=$${rows.reduce((a,r)=>a+r.sovSum,0).toLocaleString()}`);
  for (const r of rows) console.log(`  app=${String(r.app).padEnd(6)} ${String(r.number).padEnd(24)} $${String(r.sovSum).padStart(12)} inv=${r.inv} pay=${r.pay}${r.twin?`  twin=${r.twin}`:""}`);
}
fs.mkdirSync(path.join(repoRoot,"docs/ops/evidence/2026-07-10-commitment-verification"), { recursive: true });
fs.writeFileSync(path.join(repoRoot,"docs/ops/evidence/2026-07-10-commitment-verification/acu-only-classification.json"), JSON.stringify({ mode: APPLY?"APPLY":"DRY RUN", counts: Object.fromEntries(["DUP_SAFE","DUP_BILLED","ACU_ONLY","TEST"].map(b=>[b,by(b).length])), rows: out }, null, 2));

if (APPLY) {
  const ts = NOW || new Date().toISOString();
  let retired = 0;
  for (const r of by("DUP_SAFE")) {
    const { error } = await sb.from(r.table).update({ deleted_at: ts }).eq("id", r.id);
    if (error) throw new Error(`retire ${r.number}: ${error.message}`);
    retired++;
  }
  console.log(`\nRETIRED ${retired} DUP_SAFE rows (soft-delete, deleted_at=${ts}).`);
}
