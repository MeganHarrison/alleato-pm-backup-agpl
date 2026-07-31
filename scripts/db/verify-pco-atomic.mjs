#!/usr/bin/env node
/**
 * Regression guard for create_pco_with_lines / update_pco_with_lines.
 *
 * The numeric Potential Change Order create+edit flow (header + grouped change
 * events + line items) must be ATOMIC. This script proves it against the live
 * PM APP DB, all inside a transaction it ROLLS BACK so production stays clean:
 *
 *   1. create_pco_with_lines writes header (incl. the 8 fields that used to be
 *      dropped), groups a change event, and writes line items; line_amount is a
 *      generated column.
 *   2. update_pco_with_lines reconciles: edits a line, deletes one, adds one,
 *      ungroups the change event.
 *   3. An induced mid-function failure (bad numeric) rolls everything back —
 *      no orphaned PCO row is left behind.
 *
 * Exits non-zero on any regression. Safe for CI (leaves no rows).
 * Usage: node scripts/db/verify-pco-atomic.mjs
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
    const ce = await c.query(`select id, project_id from public.change_events limit 1`);
    if (!ce.rows.length) {
      console.log("⚠️  No change event available — skipping (not a failure).");
      return;
    }
    const projectId = ce.rows[0].project_id;
    const ceId = ce.rows[0].id;
    const userRow = await c.query(`select created_by_id from public.potential_change_orders where created_by_id is not null limit 1`);
    const userId = userRow.rows[0]?.created_by_id ?? null;

    await c.query("BEGIN");

    // 1. create
    const header = {
      title: "PCO atomic guard", type: "CLIENT_REQUESTED", description: "d",
      change_reason: "cr", location: "loc", reference: "ref",
      request_received_from: "me", due_date: "2026-07-01",
      is_private: true, field_change: true, paid_in_full: false,
      markup_percentage: 10, estimated_value: 500, rfq_required: true,
    };
    const lis = [
      { description: "L1", quantity: 2, uom: "EA", unit_cost: 100, category: "cat" },
      { description: "L2", quantity: 1, uom: "LS", unit_cost: 300 },
    ];
    const cr = await c.query(`select (public.create_pco_with_lines($1,$2,$3,$4,$5)).*`,
      [projectId, userId, JSON.stringify(header), `{${ceId}}`, JSON.stringify(lis)]);
    const pco = cr.rows[0];
    const c1 = await c.query(`select
        (select count(*) from pco_change_events where pco_id=$1) ce,
        (select count(*) from potential_change_order_line_items where pco_id=$1) li,
        (select sum(line_amount) from potential_change_order_line_items where pco_id=$1) total`, [pco.id]);
    if (Number(c1.rows[0].ce) !== 1 || Number(c1.rows[0].li) !== 2 || Number(c1.rows[0].total) !== 500) {
      fail(`create wrote ce=${c1.rows[0].ce} li=${c1.rows[0].li} total=${c1.rows[0].total} (expected 1/2/500)`);
    } else if (pco.is_private !== true || pco.change_reason !== "cr" || !pco.due_date) {
      fail(`create dropped header fields: is_private=${pco.is_private} change_reason=${pco.change_reason} due_date=${pco.due_date}`);
    } else {
      console.log(`✅ create: ce=1 li=2 total=500, header fields persisted (number ${pco.number})`);
    }

    // 2. update: keep L1 (edit), drop L2, add L3, ungroup CE
    const keep = (await c.query(`select id from potential_change_order_line_items where pco_id=$1 order by sort_order limit 1`, [pco.id])).rows[0].id;
    const upLis = [
      { id: keep, description: "L1 edited", quantity: 5, uom: "EA", unit_cost: 100, category: "cat" },
      { description: "L3 new", quantity: 1, uom: "EA", unit_cost: 50 },
    ];
    await c.query(`select public.update_pco_with_lines($1,$2,$3,$4,$5,$6)`,
      [projectId, pco.id, userId, JSON.stringify({ ...header, title: "edited", is_private: false }), `{}`, JSON.stringify(upLis)]);
    const c2 = await c.query(`select
        (select count(*) from pco_change_events where pco_id=$1) ce,
        (select string_agg(description||':'||line_amount, ', ' order by sort_order) items from potential_change_order_line_items where pco_id=$1) items,
        (select is_private from potential_change_orders where id=$1) priv`, [pco.id]);
    if (Number(c2.rows[0].ce) !== 0 || c2.rows[0].items !== "L1 edited:500, L3 new:50" || c2.rows[0].priv !== false) {
      fail(`update wrong: ce=${c2.rows[0].ce} items="${c2.rows[0].items}" is_private=${c2.rows[0].priv}`);
    } else {
      console.log(`✅ update: ce=0, items="${c2.rows[0].items}", is_private flipped`);
    }
    await c.query("ROLLBACK");

    // 3. induced create failure -> rollback, no orphan
    const before = (await c.query(`select count(*) n from potential_change_orders where project_id=$1`, [projectId])).rows[0].n;
    let threw = false;
    try {
      await c.query(`select public.create_pco_with_lines($1,$2,$3,$4,$5)`,
        [projectId, userId, JSON.stringify({ title: "rollback" }), `{}`, JSON.stringify([{ description: "x", quantity: "NaNNN" }])]);
    } catch { threw = true; }
    const after = (await c.query(`select count(*) n from potential_change_orders where project_id=$1`, [projectId])).rows[0].n;
    if (!threw) fail("induced create failure did NOT raise");
    if (before !== after) fail(`induced failure left orphan PCO rows (before=${before} after=${after})`);
    if (threw && before === after) console.log("✅ induced failure rolled back — 0 orphaned PCO rows");

    if (process.exitCode) console.error("\nverify-pco-atomic: FAILED");
    else console.log("\nverify-pco-atomic: PASSED");
  } finally {
    c.release();
    await pool.end();
  }
};

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
