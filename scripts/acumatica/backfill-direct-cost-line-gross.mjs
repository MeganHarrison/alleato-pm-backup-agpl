#!/usr/bin/env node

/**
 * Backfill: make Acumatica-sourced direct_cost_line_items GROSS (reconcile to header).
 *
 * BUG (2026-07-10): _sync_ap_bills stored the direct_costs header total_amount as
 * GROSS (sum of Acumatica ExtendedCost) but each direct_cost_line_items row stored
 * unit_cost = detail.UnitCost, which is NET of retainage. Because
 * direct_cost_line_items.line_total is a generated column (quantity * unit_cost),
 * the line totals came out net and did NOT reconcile to the gross header — and the
 * budget page (which sums line_total per budget code for JTD / Direct Costs) was
 * understated by the retainage on every retained line.
 *
 * FIX in code: the projection now grosses up unit_cost from ExtendedCost so the
 * generated line_total is gross. This script backfills the rows written before that
 * fix by re-deriving the gross unit_cost from each bill's stored raw_payload (the
 * same source the sync uses), matched to line items by line_order (the 1-based index
 * into raw_payload.Details). We only UPDATE unit_cost; the generated line_total
 * follows automatically.
 *
 * new_unit_cost = gross_line_total(detail) / stored_quantity
 *   so that  quantity * new_unit_cost == gross_line_total  (reconciles to the header).
 *
 * DRY RUN by default (writes a JSON report, no DB changes). Pass --apply to write.
 *
 * Usage:
 *   node scripts/acumatica/backfill-direct-cost-line-gross.mjs               # dry run, all projects
 *   node scripts/acumatica/backfill-direct-cost-line-gross.mjs --project=25125
 *   node scripts/acumatica/backfill-direct-cost-line-gross.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const req = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = req("dotenv");
const { createClient } = req("@supabase/supabase-js");
for (const p of [".env", ".env.local", "frontend/.env.local"]) {
  dotenv.config({ path: path.join(repoRoot, p), quiet: true });
}

const APPLY = process.argv.includes("--apply");
const argValue = (name, fb) => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : fb;
};
const PROJECT_ID = argValue("project", null);
const OUT = argValue(
  "out",
  path.join(
    repoRoot,
    `docs/ops/evidence/2026-07-10-direct-cost-line-gross-backfill/backfill${PROJECT_ID ? `-${PROJECT_ID}` : "-all"}.json`
  )
);

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase service env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const cents = (n) => Math.round(Number(n) * 100);
const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * JS port of backend _ap_bill_detail_amounts — GROSS extended line value.
 * Returns { quantity, grossLineTotal }.
 */
function grossLineTotalFromDetail(detail) {
  const quantity = num(detail?.Qty) ?? 1.0;
  let lineTotal = num(detail?.ExtendedCost);
  if (lineTotal === null) lineTotal = num(detail?.Amount);
  if (lineTotal === null) lineTotal = (num(detail?.UnitCost) ?? 0) * quantity;
  return { quantity, grossLineTotal: lineTotal ?? 0 };
}

async function fetchAllDirectCosts(sb) {
  const rows = [];
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
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchInChunks(sb, table, selectCols, matchCol, values) {
  const out = [];
  for (let i = 0; i < values.length; i += 150) {
    const chunk = values.slice(i, i + 150);
    const { data, error } = await sb.from(table).select(selectCols).in(matchCol, chunk);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const directCosts = await fetchAllDirectCosts(sb);
  const dcIds = directCosts.map((d) => d.id);
  const docKeys = [...new Set(directCosts.map((d) => d.acumatica_document_key).filter(Boolean))];

  const lineItems = await fetchInChunks(
    sb,
    "direct_cost_line_items",
    "id, direct_cost_id, quantity, unit_cost, line_total, line_order",
    "direct_cost_id",
    dcIds
  );
  const bills = await fetchInChunks(sb, "acumatica_ap_bills", "external_key, raw_payload", "external_key", docKeys);

  const billByKey = new Map(bills.map((b) => [b.external_key, b]));
  const linesByDc = new Map();
  for (const li of lineItems) {
    if (!linesByDc.has(li.direct_cost_id)) linesByDc.set(li.direct_cost_id, []);
    linesByDc.get(li.direct_cost_id).push(li);
  }

  const updates = []; // { id, before, after, quantity }
  const report = {
    generated_at: new Date().toISOString(),
    project_filter: PROJECT_ID ?? "all",
    apply: APPLY,
    scanned_direct_costs: directCosts.length,
    scanned_line_items: lineItems.length,
    mismatched_headers_before: 0,
    mismatched_with_raw_payload: 0,
    mismatched_no_raw_payload_single_line: 0,
    mismatched_no_raw_payload_multi_line: 0,
    planned_updates: 0,
    skipped_no_raw_payload: 0,
    skipped_no_detail_match: 0,
    samples: [],
    residual_no_raw_payload_mismatches: [],
  };

  for (const dc of directCosts) {
    const lines = linesByDc.get(dc.id) ?? [];
    if (lines.length === 0) continue;

    const bill = billByKey.get(dc.acumatica_document_key);
    const details = Array.isArray(bill?.raw_payload?.Details) ? bill.raw_payload.Details : null;

    const headerBefore = round2(dc.total_amount ?? 0);
    const lineSumBefore = round2(lines.reduce((s, l) => s + (num(l.line_total) ?? 0), 0));
    const headerMismatched = Math.abs(cents(headerBefore) - cents(lineSumBefore)) > lines.length; // >1c/line
    if (headerMismatched) report.mismatched_headers_before += 1;

    if (!details) {
      report.skipped_no_raw_payload += 1;
      if (headerMismatched) {
        if (lines.length === 1) {
          // Safe fallback: a single line must equal its (authoritative, gross)
          // header. Setting unit_cost = header/qty removes the contradiction
          // without altering the header. Only applied to single-line rows.
          report.mismatched_no_raw_payload_single_line += 1;
          const li = lines[0];
          const storedQty = num(li.quantity) ?? 1.0;
          const newUnitCost = round2(storedQty ? headerBefore / storedQty : 0);
          const curUnitCost = round2(num(li.unit_cost) ?? 0);
          if (cents(newUnitCost) !== cents(curUnitCost)) {
            updates.push({
              id: li.id,
              direct_cost_id: dc.id,
              project_id: dc.project_id,
              document_key: dc.acumatica_document_key,
              quantity: storedQty,
              source: "header-fallback-single-line",
              before_unit_cost: curUnitCost,
              after_unit_cost: newUnitCost,
              before_line_total: round2(num(li.line_total) ?? 0),
              after_line_total: round2(storedQty * newUnitCost),
            });
          }
        } else {
          // Multi-line without a raw_payload source cannot be split reliably —
          // flag for review rather than guessing per-line gross values.
          report.mismatched_no_raw_payload_multi_line += 1;
          report.residual_no_raw_payload_mismatches.push({
            direct_cost_id: dc.id,
            project_id: dc.project_id,
            document_key: dc.acumatica_document_key,
            line_count: lines.length,
            header_total: headerBefore,
            line_sum: lineSumBefore,
          });
        }
      }
      continue;
    }
    if (headerMismatched) report.mismatched_with_raw_payload += 1;

    for (const li of lines) {
      const detail = details[(li.line_order ?? 0) - 1];
      if (!detail) {
        report.skipped_no_detail_match += 1;
        continue;
      }
      const { grossLineTotal } = grossLineTotalFromDetail(detail);
      const storedQty = num(li.quantity) ?? 1.0;
      const newUnitCost = round2(storedQty ? grossLineTotal / storedQty : 0);
      const curUnitCost = round2(num(li.unit_cost) ?? 0);
      if (cents(newUnitCost) !== cents(curUnitCost)) {
        updates.push({
          id: li.id,
          direct_cost_id: dc.id,
          project_id: dc.project_id,
          document_key: dc.acumatica_document_key,
          quantity: storedQty,
          before_unit_cost: curUnitCost,
          after_unit_cost: newUnitCost,
          before_line_total: round2(num(li.line_total) ?? 0),
          after_line_total: round2(storedQty * newUnitCost),
        });
      }
    }
  }

  report.planned_updates = updates.length;
  report.samples = updates.slice(0, 25);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log(
    `Scanned ${directCosts.length} Acumatica direct_costs / ${lineItems.length} line items.\n` +
      `  Headers not reconciling (before): ${report.mismatched_headers_before}\n` +
      `  Planned unit_cost updates: ${updates.length}\n` +
      `  Skipped (no raw_payload): ${report.skipped_no_raw_payload}, (no detail match): ${report.skipped_no_detail_match}`
  );
  if (report.samples[0]) {
    const s = report.samples[0];
    console.log(
      `  e.g. ${s.document_key} line: unit_cost ${money(s.before_unit_cost)} -> ${money(s.after_unit_cost)} ` +
        `(line_total ${money(s.before_line_total)} -> ${money(s.after_line_total)})`
    );
  }
  console.log(`Report: ${OUT}`);

  if (!APPLY) {
    console.log("\nDRY RUN — no DB changes. Re-run with --apply to write.");
    return;
  }

  console.log(`\n--apply: updating ${updates.length} line items...`);
  let ok = 0;
  let failed = 0;
  for (const u of updates) {
    const { error } = await sb
      .from("direct_cost_line_items")
      .update({ unit_cost: u.after_unit_cost })
      .eq("id", u.id);
    if (error) {
      failed += 1;
      console.error(`  FAILED ${u.id}: ${error.message}`);
    } else {
      ok += 1;
    }
  }
  console.log(`Updated ${ok}, failed ${failed}.`);

  // Verify: re-read affected direct_costs and confirm header == sum(line_total).
  const affectedDcIds = [...new Set(updates.map((u) => u.direct_cost_id))];
  const dcHeaders = await fetchInChunks(sb, "direct_costs", "id, total_amount", "id", affectedDcIds);
  const headerById = new Map(dcHeaders.map((d) => [d.id, round2(d.total_amount ?? 0)]));
  const verifyLines = await fetchInChunks(
    sb,
    "direct_cost_line_items",
    "direct_cost_id, line_total",
    "direct_cost_id",
    affectedDcIds
  );
  const sumById = new Map();
  for (const l of verifyLines) {
    sumById.set(l.direct_cost_id, round2((sumById.get(l.direct_cost_id) ?? 0) + (num(l.line_total) ?? 0)));
  }
  let stillOff = 0;
  for (const id of affectedDcIds) {
    const perLineTol = (linesByDc.get(id)?.length ?? 1) * 1; // 1 cent per line
    if (Math.abs(cents(headerById.get(id) ?? 0) - cents(sumById.get(id) ?? 0)) > perLineTol) stillOff += 1;
  }
  console.log(`Post-backfill verification: ${affectedDcIds.length - stillOff}/${affectedDcIds.length} headers now reconcile (within 1c/line).`);
  report.applied = { updated: ok, failed, verified_reconciling: affectedDcIds.length - stillOff, still_off: stillOff };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
