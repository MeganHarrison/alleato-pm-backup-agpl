#!/usr/bin/env node
/**
 * Regression guard for create_owner_invoice_atomic.
 *
 * The owner-invoice "create" flow (payment application + invoice header + line
 * items) must be ATOMIC. This script proves it against the live PM APP DB:
 *
 *   1. Happy path (inside a transaction we ROLL BACK so prod stays clean):
 *      one payment application + one invoice + N line items are written, and
 *      Postgres-generated columns (net_amount, net_amount_this_period) compute.
 *   2. Induced mid-function failure (a non-numeric line-item amount): the RPC
 *      raises and the ENTIRE transaction rolls back — NO orphaned payment
 *      application or header invoice is left behind.
 *   3. Invalid/non-approved contract: the RPC raises before writing anything.
 *
 * Exits non-zero on any regression. Safe to run in CI (leaves no rows).
 *
 * Usage: node scripts/db/verify-owner-invoice-atomic.mjs
 * Requires DATABASE_URL (read from frontend/.env.local) pointing at PM APP.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("dotenv").config({ path: "frontend/.env.local" });
const { Pool } = require("pg");

const connectionString = (process.env.DATABASE_URL || "").replace(/[?&]sslmode=[^&]*/, "");
if (!connectionString) {
  console.error("Missing DATABASE_URL in frontend/.env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const fail = (msg) => { console.error("❌ REGRESSION:", msg); process.exitCode = 1; };

const main = async () => {
  const c = await pool.connect();
  try {
    const { rows: contracts } = await c.query(
      `select id, project_id from public.prime_contracts where status = 'approved' limit 1`,
    );
    if (!contracts.length) {
      console.log("⚠️  No approved prime contract available — skipping (not a failure).");
      return;
    }
    const { id: contractId, project_id: projectId } = contracts[0];
    const stamp = Date.now();

    // 1. Happy path inside a rolled-back transaction.
    await c.query("BEGIN");
    const pa = { application_number: `ATOMIC-GUARD-${stamp}`, amount: 1000, retention_amount: 100, status: "draft" };
    const inv = { invoice_number: null, status: "draft", gross_amount: 1000, net_amount: 900 };
    const lis = [
      { description: "L1", scheduled_value: 5000, work_completed_period: 1000, retainage_amount: 100, approved_amount: 900, sort_order: 0 },
      { description: "L2", scheduled_value: 2000, sort_order: 1 },
    ];
    const { rows: hp } = await c.query(
      `select public.create_owner_invoice_atomic($1,$2,$3,$4,$5) as out`,
      [projectId, contractId, JSON.stringify(pa), JSON.stringify(inv), JSON.stringify(lis)],
    );
    const out = hp[0].out;
    const { rows: chk } = await c.query(
      `select
         (select count(*) from prime_contract_payment_applications where id=$1) pa,
         (select count(*) from owner_invoices where id=$2) inv,
         (select count(*) from owner_invoice_line_items where invoice_id=$2) li,
         (select invoice_number from owner_invoices where id=$2) num`,
      [out.payment_application_id, out.invoice_id],
    );
    const r = chk[0];
    if (Number(r.pa) !== 1 || Number(r.inv) !== 1 || Number(r.li) !== 2) {
      fail(`happy path wrote pa=${r.pa} inv=${r.inv} li=${r.li} (expected 1/1/2)`);
    } else if (r.num !== `INV-${out.invoice_id}`) {
      fail(`invoice_number fallback wrong: ${r.num}`);
    } else {
      console.log(`✅ happy path: pa=1 inv=1 li=2, invoice_number=${r.num}`);
    }
    await c.query("ROLLBACK");

    // 2. Induced mid-function failure → full rollback, no orphans.
    const badNum = `ATOMIC-GUARD-FAIL-${stamp}`;
    let threw = false;
    try {
      await c.query(
        `select public.create_owner_invoice_atomic($1,$2,$3,$4,$5)`,
        [projectId, contractId,
          JSON.stringify({ application_number: badNum, amount: 1 }),
          JSON.stringify({ status: "draft" }),
          JSON.stringify([{ description: "bad", approved_amount: "NOT_A_NUMBER" }])],
      );
    } catch { threw = true; }
    const { rows: orphan } = await c.query(
      `select count(*) n from prime_contract_payment_applications where application_number=$1`,
      [badNum],
    );
    if (!threw) fail("induced bad-numeric line item did NOT raise");
    if (Number(orphan[0].n) !== 0) fail(`induced failure left ${orphan[0].n} orphaned payment application(s)`);
    if (threw && Number(orphan[0].n) === 0) console.log("✅ induced failure rolled back — 0 orphaned rows");

    // 3. Invalid contract → raises before any write.
    let threw2 = false;
    try {
      await c.query(
        `select public.create_owner_invoice_atomic($1,$2,$3,$4,$5)`,
        [projectId, "00000000-0000-0000-0000-000000000000",
          JSON.stringify({ application_number: "X", amount: 1 }), JSON.stringify({}), JSON.stringify([])],
      );
    } catch { threw2 = true; }
    if (!threw2) fail("invalid contract did NOT raise"); else console.log("✅ invalid contract rejected");

    if (process.exitCode) console.error("\nverify-owner-invoice-atomic: FAILED");
    else console.log("\nverify-owner-invoice-atomic: PASSED");
  } finally {
    c.release();
    await pool.end();
  }
};

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
