#!/usr/bin/env node
/**
 * Backfill the cost-TYPE suffix on commitment SOV `budget_code` text (dry-run by default).
 *
 * The 2026-07-10 verification audit found ~89 matched commitments whose SOV `budget_code`
 * holds the right cost CODE (e.g. "26-1000") but dropped JobPlanner's cost-TYPE suffix
 * (".S"). The type is NOT lost — it lives in `project_budget_code_id` -> project_budget_codes
 * .cost_type_id -> cost_code_types.code. This aligns the DISPLAY text `budget_code` to the
 * native "CODE.TYPE" format so the read-only SOV view + exports show the full typed code.
 *
 * TEXT-ONLY: touches `budget_code` only. Never touches amount / billed_to_date / FKs.
 * Only rewrites a row when: budget_code has NO ".TYPE" suffix, project_budget_code_id is set,
 * and that budget code resolves to a real cost_type — and the resulting text differs.
 * Idempotent (skips rows already in CODE.TYPE form or with no resolvable type).
 *
 * Usage:
 *   node scripts/jobplanner/backfill-sov-budget-code-cost-type.mjs          # dry run
 *   node scripts/jobplanner/backfill-sov-budget-code-cost-type.mjs --apply  # execute
 */
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
const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// resolve project_budget_code_id -> "CODE.TYPE"
const { data: pbc } = await sb.from("project_budget_codes").select("id, cost_code_id, cost_type_id");
const { data: ctypes } = await sb.from("cost_code_types").select("id, code");
const typeCodeById = new Map((ctypes || []).map((t) => [t.id, t.code]));
const nativeByPbcId = new Map();
for (const r of pbc || []) {
  const type = r.cost_type_id ? typeCodeById.get(r.cost_type_id) : null;
  if (r.cost_code_id) nativeByPbcId.set(r.id, type ? `${r.cost_code_id}.${type}` : r.cost_code_id);
}

let scanned = 0, toFix = 0, applied = 0, skippedNoType = 0;
const samples = [];
for (const [sov, fk, ctbl] of [["subcontract_sov_items","subcontract_id","subcontracts"],["purchase_order_sov_items","purchase_order_id","purchase_orders"]]) {
  // pull rows in pages
  let from = 0; const page = 1000;
  while (true) {
    const { data: rows, error } = await sb.from(sov).select(`id, budget_code, project_budget_code_id, ${fk}`).not("project_budget_code_id", "is", null).range(from, from + page - 1);
    if (error) throw error;
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      scanned++;
      const bc = String(r.budget_code || "").trim();
      const native = nativeByPbcId.get(r.project_budget_code_id);
      if (!native) continue;
      if (!native.includes(".")) { skippedNoType++; continue; } // pbc has no cost type -> nothing to add
      // already has a suffix? (contains a dot) -> skip
      if (bc.includes(".")) continue;
      // base must match so we only add the suffix, never rewrite a different code
      const base = native.split(".")[0];
      if (bc && bc !== base) continue;
      // target text
      if (bc === native) continue;
      toFix++;
      if (samples.length < 20) samples.push({ id: r.id, from: bc || "(empty)", to: native });
      if (APPLY) { const { error: e } = await sb.from(sov).update({ budget_code: native }).eq("id", r.id); if (e) throw new Error(`update ${r.id}: ${e.message}`); applied++; }
    }
    from += page;
    if (rows.length < page) break;
  }
}
console.log(JSON.stringify({ mode: APPLY ? "APPLY" : "DRY RUN", scanned, needSuffix: toFix, applied, skippedPbcHasNoType: skippedNoType, samples }, null, 2));
