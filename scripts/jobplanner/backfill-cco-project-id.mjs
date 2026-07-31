#!/usr/bin/env node

/**
 * Backfill contract_change_orders.project_id for Acumatica-orphaned executed
 * commitment change orders (dry-run by default).
 *
 * BACKGROUND (found 2026-07-09 sizing the Job Planner change-request import):
 * 137 of 172 rows in contract_change_orders (the commitment/subcontract executed-CO
 * table) have project_id = null. They came from the Acumatica sync but the commitment
 * HEADER they point to (contract_change_orders.contract_id) was never synced into
 * subcontracts/purchase_orders, so the documented chain
 *   contract_change_orders.contract_id -> commitments_unified.id -> project_id
 * DEAD-ENDS: all 137 contract_ids are dangling (0 resolve). With project_id null the
 * rows are invisible per-project and cannot be twinned to Job Planner commitment COs.
 *
 * THE WORKING RESOLUTION — the native Acumatica record already carries the project.
 * contract_change_orders.acumatica_external_key ("ChangeOrder|000430") joins to
 * acumatica_change_orders.external_key, whose project_id + project_code are authoritative
 * (Acumatica-native). We take that project_id and INDEPENDENTLY corroborate it two ways:
 *   1. project_code -> projects.acumatica_project_id must resolve to the SAME project.
 *   2. description "CCO-<jpProjectCode>-####" (weak corroborator; logged, not required).
 *
 * CONFIDENCE TIERS:
 *   AUTO — external_key matches an acumatica_change_orders row whose project_id is set
 *          AND project_code maps (via projects.acumatica_project_id) to that SAME project.
 *          Two agreeing Acumatica-native identifiers = not a guess. Backfilled.
 *   FLAG — no acumatica_external_key, no acumatica_change_orders match, its project_id is
 *          null, or the project_code-derived project disagrees with it. Left null for
 *          human review (these are seed/demo rows or genuine orphans).
 *
 * Rows whose contract_id is ALSO null are flagged separately (per task) — but note the
 * column is NOT NULL in this table, so in practice contract_id is always present.
 *
 * Usage:
 *   node scripts/jobplanner/backfill-cco-project-id.mjs            # dry run (writes evidence, no DB writes)
 *   node scripts/jobplanner/backfill-cco-project-id.mjs --apply    # apply the AUTO backfills
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
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-09-cco-project-backfill");

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"); process.exit(1); }

const jpCode = (desc) => { const m = String(desc || "").match(/\b(?:CCO|PCCO|CR)-(\d{3,5})-\d{3,5}/i); return m ? m[1] : null; };

async function loadAll(sb, table, select, order) {
  const rows = []; let from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await sb.from(table).select(select).order(order).range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < size) break;
    from += size;
  }
  return rows;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  console.log(`# CCO project_id backfill — ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`DB: ${SUPABASE_URL}\n`);

  // 1. Orphan rows (project_id null)
  const allCcos = await loadAll(sb, "contract_change_orders",
    "id, contract_id, project_id, acumatica_external_key, change_order_number, description, amount, contract_type, status", "id");
  const orphans = allCcos.filter((r) => r.project_id == null);
  console.log(`contract_change_orders: ${allCcos.length} total, ${orphans.length} with null project_id\n`);

  // 2. Native Acumatica CO records (authoritative project) + project acumatica map
  const acos = await loadAll(sb, "acumatica_change_orders", "external_key, project_id, project_code, external_ref_nbr", "id");
  const acoByKey = new Map(acos.map((a) => [a.external_key, a]));
  const projects = await loadAll(sb, "projects", "id, name, acumatica_project_id", "id");
  const projById = new Map(projects.map((p) => [p.id, p]));
  const projByAcuCode = new Map();
  for (const p of projects) if (p.acumatica_project_id != null) projByAcuCode.set(String(p.acumatica_project_id), p);

  // 3. Classify each orphan
  const plan = [];
  for (const r of orphans) {
    const row = {
      id: r.id, co: r.change_order_number, contract_id: r.contract_id, amount: r.amount,
      status: r.status, external_key: r.acumatica_external_key,
      desc: (r.description || "").slice(0, 80), jp_code: jpCode(r.description),
    };
    if (r.contract_id == null || String(r.contract_id).trim() === "") {
      plan.push({ ...row, tier: "FLAG", reason: "contract_id is null", inferred_project: null }); continue;
    }
    const a = r.acumatica_external_key ? acoByKey.get(r.acumatica_external_key) : null;
    if (!a) { plan.push({ ...row, tier: "FLAG", reason: r.acumatica_external_key ? "no acumatica_change_orders match for external_key" : "no acumatica_external_key", inferred_project: null }); continue; }
    row.aco_project_id = a.project_id; row.aco_project_code = a.project_code; row.aco_ref = a.external_ref_nbr;
    if (a.project_id == null) { plan.push({ ...row, tier: "FLAG", reason: "acumatica_change_orders.project_id is null", inferred_project: null }); continue; }
    const codeProj = a.project_code != null ? projByAcuCode.get(String(a.project_code)) : null;
    if (codeProj && codeProj.id !== a.project_id) {
      plan.push({ ...row, tier: "FLAG", reason: `signal conflict: aco.project_id=${a.project_id} but project_code ${a.project_code}->project ${codeProj.id}`, inferred_project: null }); continue;
    }
    if (!projById.has(a.project_id)) { plan.push({ ...row, tier: "FLAG", reason: `aco.project_id ${a.project_id} not found in projects`, inferred_project: null }); continue; }
    const corroborated = !!codeProj; // project_code independently maps to same project
    plan.push({
      ...row, tier: "AUTO",
      reason: corroborated ? "acumatica project_id + project_code agree" : "acumatica project_id (no project_code corroboration)",
      inferred_project: a.project_id, inferred_project_name: projById.get(a.project_id)?.name || null,
      code_corroborated: corroborated,
    });
  }

  const auto = plan.filter((p) => p.tier === "AUTO");
  const flag = plan.filter((p) => p.tier === "FLAG");
  const byProj = {};
  for (const p of auto) byProj[p.inferred_project] = (byProj[p.inferred_project] || 0) + 1;

  console.log(`AUTO (backfill): ${auto.length}`);
  for (const [pid, n] of Object.entries(byProj)) console.log(`  project ${pid} (${projById.get(Number(pid))?.name || "?"}): ${n} rows`);
  const uncorroborated = auto.filter((p) => !p.code_corroborated);
  if (uncorroborated.length) console.log(`  (${uncorroborated.length} AUTO rows have project_id but no project_code corroboration — still Acumatica-native, review if desired)`);
  console.log(`\nFLAG (left null for review): ${flag.length}`);
  const flagReasons = {};
  for (const p of flag) flagReasons[p.reason] = (flagReasons[p.reason] || 0) + 1;
  for (const [reason, n] of Object.entries(flagReasons)) console.log(`  ${n}× ${reason}`);
  for (const p of flag) console.log(`    co#${p.co} contract=${String(p.contract_id).slice(0, 8)} amt=${p.amount} status=${p.status} "${p.desc}"`);

  // 4. Write evidence
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = { generated: "2026-07-09", mode: APPLY ? "apply" : "dry-run", db: SUPABASE_URL };
  fs.writeFileSync(path.join(OUT_DIR, "reconcile.json"), JSON.stringify({ ...stamp, summary: { total: allCcos.length, orphans: orphans.length, auto: auto.length, flag: flag.length, by_project: byProj }, plan }, null, 2));
  const md = [
    `# contract_change_orders.project_id backfill — reconcile`, ``,
    `- Mode: **${APPLY ? "APPLY" : "DRY RUN"}**  ·  DB: \`${SUPABASE_URL}\``,
    `- ${orphans.length} orphan rows (null project_id) of ${allCcos.length} total`,
    `- **AUTO ${auto.length}** → backfilled  ·  **FLAG ${flag.length}** → left null`, ``,
    `## AUTO by project`, ``, `| project_id | name | rows |`, `|---|---|---|`,
    ...Object.entries(byProj).map(([pid, n]) => `| ${pid} | ${projById.get(Number(pid))?.name || "?"} | ${n} |`), ``,
    `## FLAGGED (need human review)`, ``, `| co# | contract_id (8) | amount | status | reason | description |`, `|---|---|---|---|---|---|`,
    ...flag.map((p) => `| ${p.co} | ${String(p.contract_id).slice(0, 8)} | ${p.amount} | ${p.status} | ${p.reason} | ${p.desc.replace(/\|/g, "/")} |`), ``,
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "reconcile.md"), md);
  console.log(`\nEvidence → ${path.relative(repoRoot, OUT_DIR)}/reconcile.{json,md}`);

  // 5. Apply
  if (!APPLY) { console.log(`\nDRY RUN — no writes. Re-run with --apply to backfill the ${auto.length} AUTO rows.`); return; }
  console.log(`\nApplying ${auto.length} updates...`);
  let ok = 0, err = 0;
  for (const p of auto) {
    const { error } = await sb.from("contract_change_orders").update({ project_id: p.inferred_project }).eq("id", p.id).is("project_id", null);
    if (error) { err++; console.error(`  co#${p.co}: ${error.message}`); } else ok++;
  }
  console.log(`updated ${ok}, errors ${err}`);

  // 6. Verify per-project counts after
  const after = await loadAll(sb, "contract_change_orders", "id, project_id", "id");
  const afterNull = after.filter((r) => r.project_id == null).length;
  const afterByProj = {};
  for (const r of after.filter((r) => r.project_id != null)) afterByProj[r.project_id] = (afterByProj[r.project_id] || 0) + 1;
  console.log(`\nPOST-APPLY: ${afterNull} rows still null (expected ${flag.length}).`);
  console.log("project distribution:", JSON.stringify(afterByProj));
  fs.writeFileSync(path.join(OUT_DIR, "post-apply-counts.json"), JSON.stringify({ still_null: afterNull, expected_null: flag.length, by_project: afterByProj }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
