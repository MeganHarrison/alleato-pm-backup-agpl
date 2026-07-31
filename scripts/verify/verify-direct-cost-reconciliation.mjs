#!/usr/bin/env node

/**
 * Guardrail (monitoring bucket): fail loudly if ANY non-deleted direct_cost's
 * header total_amount does not reconcile to sum(direct_cost_line_items.line_total)
 * beyond a per-line tolerance.
 *
 * WHY: direct_cost_line_items.line_total is a GENERATED column (quantity *
 * unit_cost), and both budget rollups (JTD / Direct Costs per cost code) sum
 * line_total. If the header is GROSS but the lines are stored NET of retainage,
 * budget JTD is silently understated. The live _sync_ap_bills path already
 * asserts this reconciliation before projecting (see backend acumatica_sync.py
 * _DIRECT_COST_RECON_TOLERANCE_PER_LINE) — but rows created by OTHER importers
 * (manual/seed imports, older paths) bypass that guard. This script is the
 * post-sync net that catches the whole class regardless of writer, so JTD drift
 * introduced by any future import is surfaced instead of silently understating
 * the budget. Wired into the scheduled Acumatica sync-health workflow.
 *
 * Two backfills exist for the historical net-line rows:
 *   scripts/acumatica/backfill-direct-cost-line-gross.mjs        (raw_payload source)
 *   scripts/acumatica/backfill-direct-cost-line-gross-noraw.mjs  (no raw_payload)
 *
 * Connection: prefers DATABASE_URL (pg, one aggregate query — used in CI/cron via
 * the existing secret); falls back to SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Exit 0 = all reconcile. Exit 1 = at least one mismatch (prints offenders).
 * Exit 2 = could not run (missing connection env).
 *
 * Usage:
 *   node scripts/verify/verify-direct-cost-reconciliation.mjs
 *   node scripts/verify/verify-direct-cost-reconciliation.mjs --project=43
 *   node scripts/verify/verify-direct-cost-reconciliation.mjs --json
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
// Resolve deps from the ROOT package.json (pg + dotenv are root devDeps). In CI
// only pg is needed (env comes from workflow secrets), so dotenv is optional.
const req = createRequire(path.join(repoRoot, "package.json"));
try {
  const dotenv = req("dotenv");
  for (const p of [".env", ".env.local", "frontend/.env.local"]) {
    dotenv.config({ path: path.join(repoRoot, p), quiet: true });
  }
} catch {
  // dotenv not installed (e.g. CI without local env files) — env is provided directly.
}

const argValue = (name, fb) => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : fb;
};
const PROJECT_ID = argValue("project", null);
const AS_JSON = process.argv.includes("--json");

// Per-line tolerance. direct_cost_line_items.line_total is round(quantity *
// round(unit_cost, 2), 2); when quantity > 1 a single 2-decimal unit_cost cannot
// reconstruct the header exactly, so the sum can drift by a few cents per line
// (observed max in prod: $0.10/line). This tolerance absorbs that rounding while
// staying FAR below any percentage-based retainage gap (retainage on any header
// over ~$10 exceeds this) — which is the material bug this guard exists to catch.
const TOLERANCE_PER_LINE = Number(process.env.DIRECT_COST_RECON_TOLERANCE_PER_LINE || "0.10");

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const cents = (n) => Math.round(Number(n) * 100);
const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

/** Scan via a direct Postgres connection (one aggregate query). */
async function scanViaPg() {
  const { Client } = req("pg");
  const url = new URL(DATABASE_URL);
  url.searchParams.delete("sslmode");
  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 8000,
    application_name: "alleato-direct-cost-reconciliation-verifier",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const params = [TOLERANCE_PER_LINE];
    const projectFilter = PROJECT_ID ? "and dc.project_id = $2" : "";
    if (PROJECT_ID) params.push(Number(PROJECT_ID));
    const summary = await client.query(
      `select count(distinct dc.id)::int as scanned
       from public.direct_costs dc
       join public.direct_cost_line_items li on li.direct_cost_id = dc.id
       where dc.is_deleted = false and dc.acumatica_document_key is not null ${projectFilter}`,
      PROJECT_ID ? [Number(PROJECT_ID)] : [],
    );
    const offenders = await client.query(
      `select dc.id as direct_cost_id, dc.project_id, dc.acumatica_document_key as document_key,
              count(li.id)::int as line_count,
              round(dc.total_amount::numeric, 2) as header_total,
              round(coalesce(sum(li.line_total), 0)::numeric, 2) as line_sum
       from public.direct_costs dc
       join public.direct_cost_line_items li on li.direct_cost_id = dc.id
       where dc.is_deleted = false and dc.acumatica_document_key is not null ${projectFilter}
       group by dc.id
       having abs(round(dc.total_amount::numeric, 2) - round(coalesce(sum(li.line_total), 0)::numeric, 2))
              > (count(li.id) * $1::numeric)
       order by abs(round(dc.total_amount::numeric, 2) - round(coalesce(sum(li.line_total), 0)::numeric, 2)) desc`,
      params,
    );
    return {
      scanned: summary.rows[0]?.scanned ?? 0,
      offenders: offenders.rows.map((r) => ({
        direct_cost_id: r.direct_cost_id,
        project_id: r.project_id,
        document_key: r.document_key,
        line_count: r.line_count,
        header_total: round2(r.header_total),
        line_sum: round2(r.line_sum),
        diff: round2(num(r.header_total) - num(r.line_sum)),
      })),
    };
  } finally {
    await client.end();
  }
}

/** Scan via supabase-js (fallback when DATABASE_URL is absent). */
async function scanViaSupabase() {
  const { createClient } = req("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const dcs = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = sb
      .from("direct_costs")
      .select("id, project_id, total_amount, acumatica_document_key")
      .not("acumatica_document_key", "is", null)
      .eq("is_deleted", false)
      .range(from, from + pageSize - 1);
    if (PROJECT_ID) q = q.eq("project_id", Number(PROJECT_ID));
    const { data, error } = await q;
    if (error) throw new Error(`direct_costs fetch failed: ${error.message}`);
    dcs.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  const sumById = new Map();
  const countById = new Map();
  const dcIds = dcs.map((d) => d.id);
  for (let i = 0; i < dcIds.length; i += 150) {
    const chunk = dcIds.slice(i, i + 150);
    const { data, error } = await sb.from("direct_cost_line_items").select("direct_cost_id, line_total").in("direct_cost_id", chunk);
    if (error) throw new Error(`direct_cost_line_items fetch failed: ${error.message}`);
    for (const l of data ?? []) {
      sumById.set(l.direct_cost_id, round2((sumById.get(l.direct_cost_id) ?? 0) + (num(l.line_total) ?? 0)));
      countById.set(l.direct_cost_id, (countById.get(l.direct_cost_id) ?? 0) + 1);
    }
  }
  const offenders = [];
  let scanned = 0;
  for (const dc of dcs) {
    const lineCount = countById.get(dc.id) ?? 0;
    if (lineCount === 0) continue;
    scanned += 1;
    const header = round2(dc.total_amount ?? 0);
    const lineSum = round2(sumById.get(dc.id) ?? 0);
    if (Math.abs(cents(header) - cents(lineSum)) > Math.round(lineCount * TOLERANCE_PER_LINE * 100)) {
      offenders.push({
        direct_cost_id: dc.id,
        project_id: dc.project_id,
        document_key: dc.acumatica_document_key,
        line_count: lineCount,
        header_total: header,
        line_sum: lineSum,
        diff: round2(header - lineSum),
      });
    }
  }
  offenders.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return { scanned, offenders };
}

async function main() {
  let result;
  let via;
  if (DATABASE_URL) {
    via = "DATABASE_URL";
    result = await scanViaPg();
  } else if (SUPABASE_URL && SERVICE_KEY) {
    via = "supabase-js";
    result = await scanViaSupabase();
  } else {
    console.error("Missing connection env: set DATABASE_URL, or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }

  const { scanned, offenders } = result;
  if (AS_JSON) {
    console.log(JSON.stringify({ via, project_filter: PROJECT_ID ?? "all", tolerance_per_line: TOLERANCE_PER_LINE, scanned, offenders: offenders.length, detail: offenders }, null, 2));
  } else {
    console.log(`Direct-cost reconciliation [${via}]: scanned ${scanned} Acumatica direct_costs with line items.`);
    if (offenders.length) {
      console.error(`\nFAIL: ${offenders.length} direct_costs do not reconcile (header != sum(line_total), tol ${money(TOLERANCE_PER_LINE)}/line):`);
      for (const o of offenders.slice(0, 50)) {
        console.error(`  - p${o.project_id} ${o.document_key} [${o.line_count} lines] header ${money(o.header_total)} vs lines ${money(o.line_sum)} (diff ${money(o.diff)})`);
      }
      if (offenders.length > 50) console.error(`  … and ${offenders.length - 50} more`);
      console.error(`\nFix: run scripts/acumatica/backfill-direct-cost-line-gross.mjs (raw_payload) and/or …-noraw.mjs.`);
    }
  }

  if (offenders.length) process.exit(1);
  console.log(`Direct-cost reconciliation: PASS — every header reconciles to its line items (within ${money(TOLERANCE_PER_LINE)}/line).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
