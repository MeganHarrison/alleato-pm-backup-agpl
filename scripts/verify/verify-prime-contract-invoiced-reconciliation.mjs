#!/usr/bin/env node

/**
 * Guardrail (monitoring bucket): fail loudly if ANY prime contract's
 * prime_contract_financial_summary.invoiced_amount does not equal the sum of
 * its two documented invoice sources.
 *
 * WHY: "Invoiced" for a prime contract comes from TWO tables — approved
 * prime_contract_payment_applications AND owner_invoices (AR invoices synced
 * from Acumatica). The detail-page Invoices tab already unions both and
 * de-duplicates owner invoices linked to a payment application. But the
 * financial-summary view originally summed ONLY payment applications, so
 * contracts billed exclusively through owner invoices (the common case —
 * e.g. project 876 / PC-8344-0001, ~$1.37M) reported $0 invoiced on the list
 * column and the detail sidebar. Fixed in migration
 * 20260711000000_prime_contract_invoiced_includes_owner_invoices.sql.
 *
 * Expected invoiced_amount =
 *     sum(prime_contract_payment_applications.amount WHERE status='approved')
 *   + sum(owner_invoices.gross_amount
 *         WHERE payment_application_id IS NULL   -- avoid double-count with PAs
 *           AND status <> 'draft')               -- drafts are not yet issued
 *
 * This script recomputes that independently of the view and asserts the view
 * matches — so any future edit to the view (or drift in the source semantics)
 * that reintroduces the $0-invoiced class is surfaced instead of silently
 * understating what has been billed.
 *
 * Connection: prefers DATABASE_URL (pg); falls back to SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Exit 0 = all reconcile. Exit 1 = at least one mismatch (prints offenders).
 * Exit 2 = could not run (missing connection env).
 *
 * Usage:
 *   node scripts/verify/verify-prime-contract-invoiced-reconciliation.mjs
 *   node scripts/verify/verify-prime-contract-invoiced-reconciliation.mjs --project=876
 *   node scripts/verify/verify-prime-contract-invoiced-reconciliation.mjs --json
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
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

// Amounts are stored decimals summed in Postgres — the comparison should be
// exact. A one-cent tolerance absorbs any float round-trip through JSON.
const TOLERANCE = 0.01;

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
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
    application_name: "alleato-prime-invoiced-reconciliation-verifier",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const projectFilter = PROJECT_ID ? "where pc.project_id = $1" : "";
    const params = PROJECT_ID ? [Number(PROJECT_ID)] : [];
    const res = await client.query(
      `select
         pc.id as contract_id,
         pc.project_id,
         pc.contract_number,
         round(s.invoiced_amount::numeric, 2) as view_invoiced,
         round((
           coalesce((select sum(pa.amount) from prime_contract_payment_applications pa
                      where pa.contract_id = pc.id and pa.status = 'approved'), 0)
           + coalesce((select sum(oi.gross_amount) from owner_invoices oi
                        where oi.prime_contract_id = pc.id
                          and oi.payment_application_id is null
                          and oi.status <> 'draft'), 0)
         )::numeric, 2) as expected_invoiced
       from prime_contracts pc
       join prime_contract_financial_summary s on s.contract_id = pc.id
       ${projectFilter}`,
      params,
    );
    const rows = res.rows.map((r) => ({
      contract_id: r.contract_id,
      project_id: r.project_id,
      contract_number: r.contract_number,
      view_invoiced: round2(num(r.view_invoiced)),
      expected_invoiced: round2(num(r.expected_invoiced)),
      diff: round2(num(r.view_invoiced) - num(r.expected_invoiced)),
    }));
    return {
      scanned: rows.length,
      offenders: rows.filter((r) => Math.abs(r.diff) > TOLERANCE),
    };
  } finally {
    await client.end();
  }
}

/** Scan via supabase-js (fallback when DATABASE_URL is absent). */
async function scanViaSupabase() {
  const { createClient } = req("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const fetchAll = async (build) => {
    const out = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await build().range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return out;
  };

  const contracts = await fetchAll(() => {
    let q = sb.from("prime_contracts").select("id, project_id, contract_number");
    if (PROJECT_ID) q = q.eq("project_id", Number(PROJECT_ID));
    return q;
  });
  const contractIds = new Set(contracts.map((c) => c.id));

  const summaries = await fetchAll(() => {
    let q = sb.from("prime_contract_financial_summary").select("contract_id, invoiced_amount");
    if (PROJECT_ID) q = q.eq("project_id", Number(PROJECT_ID));
    return q;
  });
  const viewByContract = new Map(summaries.map((s) => [s.contract_id, num(s.invoiced_amount)]));

  const pas = await fetchAll(() =>
    sb.from("prime_contract_payment_applications").select("contract_id, amount, status").eq("status", "approved"),
  );
  const paSum = new Map();
  for (const pa of pas) {
    if (!contractIds.has(pa.contract_id)) continue;
    paSum.set(pa.contract_id, num(paSum.get(pa.contract_id)) + num(pa.amount));
  }

  const ois = await fetchAll(() =>
    sb
      .from("owner_invoices")
      .select("prime_contract_id, gross_amount, status, payment_application_id")
      .is("payment_application_id", null)
      .neq("status", "draft"),
  );
  const oiSum = new Map();
  for (const oi of ois) {
    if (!contractIds.has(oi.prime_contract_id)) continue;
    oiSum.set(oi.prime_contract_id, num(oiSum.get(oi.prime_contract_id)) + num(oi.gross_amount));
  }

  const rows = contracts.map((c) => {
    const view_invoiced = round2(num(viewByContract.get(c.id)));
    const expected_invoiced = round2(num(paSum.get(c.id)) + num(oiSum.get(c.id)));
    return {
      contract_id: c.id,
      project_id: c.project_id,
      contract_number: c.contract_number,
      view_invoiced,
      expected_invoiced,
      diff: round2(view_invoiced - expected_invoiced),
    };
  });
  return { scanned: rows.length, offenders: rows.filter((r) => Math.abs(r.diff) > TOLERANCE) };
}

async function main() {
  let result;
  if (DATABASE_URL) {
    result = await scanViaPg();
  } else if (SUPABASE_URL && SERVICE_KEY) {
    result = await scanViaSupabase();
  } else {
    console.error("[prime-invoiced-recon] No DATABASE_URL or SUPABASE_URL+SERVICE key. Cannot run.");
    process.exit(2);
  }

  if (AS_JSON) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[prime-invoiced-recon] scanned ${result.scanned} prime contracts.`);
    if (result.offenders.length === 0) {
      console.log("[prime-invoiced-recon] ✅ all invoiced_amount values reconcile to (approved PAs + unlinked non-draft owner invoices).");
    } else {
      console.error(`[prime-invoiced-recon] ❌ ${result.offenders.length} contract(s) mismatch:`);
      for (const o of result.offenders) {
        console.error(
          `  - project ${o.project_id} ${o.contract_number} (${o.contract_id}): view=${money(o.view_invoiced)} expected=${money(o.expected_invoiced)} diff=${money(o.diff)}`,
        );
      }
    }
  }
  process.exit(result.offenders.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[prime-invoiced-recon] fatal:", err?.message || err);
  process.exit(2);
});
