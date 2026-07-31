#!/usr/bin/env node

/**
 * Backfill (companion to backfill-direct-cost-line-gross.mjs): gross up the
 * direct_cost_line_items for Acumatica direct_costs whose header does NOT
 * reconcile to sum(line_total) AND for which there is NO acumatica_ap_bills
 * raw_payload to re-derive per-line gross values from.
 *
 * WHY THIS EXISTS
 * ---------------
 * The primary gross backfill (…-line-gross.mjs) re-derives each line's gross
 * value from the bill's stored raw_payload.Details — the authoritative source
 * the live _sync_ap_bills path uses. But 27 multi-line direct_costs on project
 * 43 were created by a one-time MANUAL/SEED import (user "Muhammad",
 * webiside@gmail.com, 2026-03) and later stamped with acumatica_document_key.
 * Those bills were never captured in acumatica_ap_bills, so there is no
 * raw_payload to gross up from — the primary script correctly refused to guess
 * and flagged them as residual_no_raw_payload_mismatches[].
 *
 * These line items are NET of retainage while the header total_amount is GROSS,
 * exactly the class of bug fixed for _sync_ap_bills in PR #878. Because
 * direct_cost_line_items.line_total is a GENERATED column (quantity * unit_cost),
 * the net lines flow NET Job-to-Date into the budget page, understating JTD /
 * Direct Costs per cost code by the retainage on every retained line.
 *
 * AUTHORITATIVE SOURCE WHEN raw_payload IS ABSENT
 * -----------------------------------------------
 * The header total_amount is the authoritative GROSS value (confirmed: it is the
 * pre-retainage bill/pay-app total). Two gross-up methods, chosen per document:
 *
 *  A. PROPORTIONAL (uniform retainage). When lineSum > 0, retainage is uniform
 *     per line (verified live 2026-07-10: every clean row grosses up to exact,
 *     round pre-retainage values that sum to the header with a 0-cent residual —
 *     e.g. Bill|002525 lines /0.9 = 53725/31000/2000/2000/39225/21415 = 149365).
 *     new_unit_cost = round2(unit_cost * header / lineSum); any sub-cent rounding
 *     residual is applied to the largest line so sum(line_total) == header EXACTLY.
 *
 *  B. SINGLE-COST-CODE RESIDUAL (anomalies). A few documents have non-retainage
 *     line data that proportional scaling cannot fix: lineSum <= 0 (e.g. a
 *     -$3,000 deduct pay-app line among $0 placeholder lines) or lineSum == 0
 *     (a debit adjustment whose per-line values were imported as $0). Proportional
 *     scaling is impossible/meaningless there. BUT every line in those documents
 *     shares ONE budget_code_id, so budget JTD per cost code is identical for any
 *     line distribution — we can make the header reconcile WITHOUT any cost-code
 *     misattribution by assigning the residual to the first line:
 *       line[0].new_unit_cost = (header - sum(other line_totals)) / quantity[0].
 *     If (and only if) a document's lines span MORE THAN ONE budget code, method B
 *     is unsafe (it would misattribute cost) — such a row is left untouched and
 *     flagged for manual review rather than guessed.
 *
 * We only ever UPDATE unit_cost; the generated line_total follows automatically.
 * We NEVER touch the header (it is the authoritative gross), and we NEVER touch a
 * document that already reconciles or that has a usable raw_payload (that is the
 * other script's job).
 *
 * DRY RUN by default (writes a JSON report, no DB changes). Pass --apply to write.
 *
 * Usage:
 *   node scripts/acumatica/backfill-direct-cost-line-gross-noraw.mjs             # dry run, all projects
 *   node scripts/acumatica/backfill-direct-cost-line-gross-noraw.mjs --project=43
 *   node scripts/acumatica/backfill-direct-cost-line-gross-noraw.mjs --apply
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
    `docs/ops/evidence/2026-07-10-direct-cost-line-gross-backfill/backfill-noraw${PROJECT_ID ? `-${PROJECT_ID}` : "-all"}.json`
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

/**
 * Compute per-line unit_cost updates for one non-reconciling direct_cost that has
 * no raw_payload. Returns { method, updates:[{id, quantity, before/after ...}] } or
 * { method:'flag', reason } when it cannot be fixed safely.
 */
function planDirectCost(header, lines) {
  const sorted = [...lines].sort((a, b) => (a.line_order ?? 0) - (b.line_order ?? 0));
  const lineSum = round2(sorted.reduce((s, l) => s + (num(l.line_total) ?? 0), 0));

  if (lineSum > 0) {
    // Method A — proportional gross-up (uniform retainage).
    const factor = header / lineSum;
    const draft = sorted.map((l) => {
      const q = num(l.quantity) ?? 1;
      const uc = round2((num(l.unit_cost) ?? 0) * factor);
      return { li: l, q, uc, lt: round2(q * uc) };
    });
    // Apply the sub-cent rounding residual to the largest-magnitude line so the
    // stored line totals sum to the authoritative header EXACTLY.
    let sum = round2(draft.reduce((s, d) => s + d.lt, 0));
    const residual = round2(header - sum);
    if (residual !== 0) {
      let idx = 0;
      for (let i = 1; i < draft.length; i++) if (Math.abs(draft[i].lt) > Math.abs(draft[idx].lt)) idx = i;
      const q = draft[idx].q || 1;
      draft[idx].uc = round2(draft[idx].uc + residual / q);
      draft[idx].lt = round2(q * draft[idx].uc);
    }
    return { method: "proportional", factor: round2(factor), draft };
  }

  // Method B — single-cost-code residual (anomaly: lineSum <= 0).
  const budgetCodes = new Set(sorted.map((l) => l.budget_code_id));
  if (budgetCodes.size !== 1) {
    return {
      method: "flag",
      reason: `lineSum=${lineSum} (<=0) and lines span ${budgetCodes.size} budget codes — cannot gross up without misattributing cost. Needs manual review against Acumatica.`,
    };
  }
  // All one budget code → distribution is immaterial to budget JTD. Put the
  // residual on line 1, keep the other (documented) lines verbatim.
  const draft = sorted.map((l) => ({ li: l, q: num(l.quantity) ?? 1, uc: num(l.unit_cost) ?? 0, lt: round2((num(l.quantity) ?? 1) * (num(l.unit_cost) ?? 0)) }));
  const othersSum = round2(draft.slice(1).reduce((s, d) => s + d.lt, 0));
  const q0 = draft[0].q || 1;
  draft[0].uc = round2((header - othersSum) / q0);
  draft[0].lt = round2(q0 * draft[0].uc);
  return { method: "single-code-residual", factor: null, draft };
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const directCosts = await fetchAllDirectCosts(sb);
  const dcIds = directCosts.map((d) => d.id);
  const docKeys = [...new Set(directCosts.map((d) => d.acumatica_document_key).filter(Boolean))];

  const lineItems = await fetchInChunks(
    sb,
    "direct_cost_line_items",
    "id, direct_cost_id, budget_code_id, quantity, unit_cost, line_total, line_order",
    "direct_cost_id",
    dcIds
  );
  const bills = await fetchInChunks(sb, "acumatica_ap_bills", "external_key, raw_payload", "external_key", docKeys);
  const billHasDetails = new Set(
    bills.filter((b) => Array.isArray(b?.raw_payload?.Details) && b.raw_payload.Details.length).map((b) => b.external_key)
  );

  const linesByDc = new Map();
  for (const li of lineItems) {
    if (!linesByDc.has(li.direct_cost_id)) linesByDc.set(li.direct_cost_id, []);
    linesByDc.get(li.direct_cost_id).push(li);
  }

  const updates = []; // flat list of { id, direct_cost_id, ... }
  const report = {
    generated_at: new Date().toISOString(),
    project_filter: PROJECT_ID ?? "all",
    apply: APPLY,
    scanned_direct_costs: directCosts.length,
    scanned_line_items: lineItems.length,
    targeted_no_raw_payload_multiline: 0,
    fixed_proportional: 0,
    fixed_single_code_residual: 0,
    flagged_for_review: 0,
    planned_line_updates: 0,
    documents: [],
    flagged: [],
  };

  for (const dc of directCosts) {
    const lines = linesByDc.get(dc.id) ?? [];
    if (lines.length <= 1) continue; // single-line handled by the header-fallback in the primary script
    if (billHasDetails.has(dc.acumatica_document_key)) continue; // primary (raw_payload) script owns these

    const header = round2(dc.total_amount ?? 0);
    const lineSum = round2(lines.reduce((s, l) => s + (num(l.line_total) ?? 0), 0));
    const reconTolCents = lines.length; // 1 cent per line
    if (Math.abs(cents(header) - cents(lineSum)) <= reconTolCents) continue; // already reconciles

    report.targeted_no_raw_payload_multiline += 1;
    const plan = planDirectCost(header, lines);

    if (plan.method === "flag") {
      report.flagged_for_review += 1;
      report.flagged.push({
        direct_cost_id: dc.id,
        project_id: dc.project_id,
        document_key: dc.acumatica_document_key,
        line_count: lines.length,
        header_total: header,
        line_sum: lineSum,
        reason: plan.reason,
      });
      continue;
    }

    if (plan.method === "proportional") report.fixed_proportional += 1;
    else report.fixed_single_code_residual += 1;

    const docUpdates = [];
    for (const d of plan.draft) {
      const curUc = round2(num(d.li.unit_cost) ?? 0);
      if (cents(d.uc) === cents(curUc)) continue; // no change for this line
      const u = {
        id: d.li.id,
        direct_cost_id: dc.id,
        project_id: dc.project_id,
        document_key: dc.acumatica_document_key,
        method: plan.method,
        line_order: d.li.line_order,
        quantity: d.q,
        before_unit_cost: curUc,
        after_unit_cost: d.uc,
        before_line_total: round2(num(d.li.line_total) ?? 0),
        after_line_total: d.lt,
      };
      docUpdates.push(u);
      updates.push(u);
    }
    report.documents.push({
      direct_cost_id: dc.id,
      project_id: dc.project_id,
      document_key: dc.acumatica_document_key,
      method: plan.method,
      factor: plan.factor,
      line_count: lines.length,
      header_total: header,
      line_sum_before: lineSum,
      line_updates: docUpdates.length,
    });
  }

  report.planned_line_updates = updates.length;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log(
    `Scanned ${directCosts.length} Acumatica direct_costs / ${lineItems.length} line items.\n` +
      `  Non-reconciling multi-line without raw_payload: ${report.targeted_no_raw_payload_multiline}\n` +
      `  -> proportional gross-up: ${report.fixed_proportional} docs\n` +
      `  -> single-cost-code residual: ${report.fixed_single_code_residual} docs\n` +
      `  -> flagged for manual review: ${report.flagged_for_review} docs\n` +
      `  Planned unit_cost updates: ${updates.length} lines`
  );
  if (report.documents[0]) {
    const s = report.documents[0];
    console.log(`  e.g. ${s.document_key} [${s.method}] header ${money(s.header_total)} vs lines ${money(s.line_sum_before)} → ${s.line_updates} lines regrossed`);
  }
  for (const f of report.flagged) console.log(`  FLAG ${f.document_key}: ${f.reason}`);
  console.log(`Report: ${OUT}`);

  if (!APPLY) {
    console.log("\nDRY RUN — no DB changes. Re-run with --apply to write.");
    return;
  }

  console.log(`\n--apply: updating ${updates.length} line items...`);
  let ok = 0;
  let failed = 0;
  for (const u of updates) {
    const { error } = await sb.from("direct_cost_line_items").update({ unit_cost: u.after_unit_cost }).eq("id", u.id);
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
  const verifyLines = await fetchInChunks(sb, "direct_cost_line_items", "direct_cost_id, line_total", "direct_cost_id", affectedDcIds);
  const sumById = new Map();
  for (const l of verifyLines) {
    sumById.set(l.direct_cost_id, round2((sumById.get(l.direct_cost_id) ?? 0) + (num(l.line_total) ?? 0)));
  }
  let stillOff = 0;
  const stillOffDetail = [];
  for (const id of affectedDcIds) {
    const perLineTol = linesByDc.get(id)?.length ?? 1; // 1 cent per line
    if (Math.abs(cents(headerById.get(id) ?? 0) - cents(sumById.get(id) ?? 0)) > perLineTol) {
      stillOff += 1;
      stillOffDetail.push({ id, header: headerById.get(id), line_sum: sumById.get(id) });
    }
  }
  console.log(`Post-backfill verification: ${affectedDcIds.length - stillOff}/${affectedDcIds.length} headers now reconcile (within 1c/line).`);
  report.applied = { updated: ok, failed, verified_reconciling: affectedDcIds.length - stillOff, still_off: stillOff, still_off_detail: stillOffDetail };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
