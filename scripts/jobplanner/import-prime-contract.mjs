#!/usr/bin/env node

/**
 * Idempotent import of a Job Planner prime contract + its Schedule of Values (SOV)
 * into the PM app `prime_contracts` + `contract_line_items` tables, creating the
 * project's budget codes (`project_budget_codes`) and linking each SOV line to one.
 *
 * NOTE: the prime-contract detail UI (PrimeContractSovTab) reads its SOV from
 * `contract_line_items` (cols cost_code_id/line_number/quantity/unit_cost), and its
 * editable "Budget Code" column binds to `budget_code_id` -> `project_budget_codes.id`.
 * A line with only cost_code_id renders in read-only mode but shows "Select budget
 * code..." in edit mode, so we must populate budget_code_id too.
 *
 * Job Planner endpoints (verified live 2026-06-17):
 *   - contract (project-scoped list) GET /projects/{jpProjectId}/primecontracts   (V2, array)
 *   - SOV line items                 GET /primecontracts/{contractId}/lineitems    (V2, NOT project-scoped)
 *   - cost codes (code strings)      GET /projects/{jpProjectId}/costcodes         (V2)
 *   - cost types (L/E/M/S/X)         GET /projects/{jpProjectId}/costtypes         (V2)
 *
 * Mapping decisions:
 *   - Amounts are in CENTS in Job Planner -> divided by 100 into our DECIMAL columns.
 *   - JP cost codes are 6-digit ("013144"); our `cost_codes.id` is dashed ("01-3144").
 *     We dash via XXYYYY -> XX-YYYY and require the dashed code to exist in `cost_codes`.
 *   - JP cost types (L/E/M/S/X by `code`) map to `cost_code_types.id` by matching code.
 *   - A budget code is per (project_id, sub_job_key, cost_code_id, cost_type_id) — the
 *     unique key `uq_project_budget_code`. We upsert one per distinct SOV (code,type)
 *     pair (sub_job_key = zero-UUID, the app default), then link contract_line_items.
 *   - `contract_line_items.total_cost` is GENERATED ALWAYS AS (quantity * unit_cost),
 *     so we cannot write it. Each line is modeled as a lump sum: quantity=1,
 *     unit_cost=<dollar amount>, making the stored line amount exactly the JP amount.
 *   - `prime_contracts` has no source/external-key column, so idempotency keys on
 *     (project_id, contract_number). contract_number = JP `number` (e.g. "PC-9299-0001").
 *   - SOV has no per-line external key; on re-run we DELETE the contract's line items
 *     and re-insert from JP (JP is the source of truth for this project).
 *
 * GUARDRAIL: the script aborts before writing if the sum of SOV line amounts does not
 * equal the JP contract amount (the "make sure the SOV syncs properly" invariant).
 *
 * Secrets: reads JOBPLANNER_API_KEY + SUPABASE_SERVICE_ROLE_KEY from env. Never printed.
 *
 * Usage:
 *   node scripts/jobplanner/import-prime-contract.mjs --jp=8344 --app=876 --title="Exol Morrisville"
 *   node scripts/jobplanner/import-prime-contract.mjs --jp=8344 --app=876 --dry-run  # preview, no writes
 *
 * Flags (defaults preserve the original Playmakers import):
 *   --jp=<id>      Job Planner projectId      (default 9299)
 *   --app=<id>     PM app projects.id INTEGER (default 1067)
 *   --title=<str>  Project title for the contract label (default "26-123 Playmakers")
 *   --dry-run      Preview only, no DB writes
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

const DRY_RUN = process.argv.includes("--dry-run");

const argValue = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

// --- Job Planner -> PM app mapping for this import (override via CLI flags) ---
const JP_PROJECT_ID = Number(argValue("jp", 9299)); // Job Planner projectId
const APP_PROJECT_ID = Number(argValue("app", 1067)); // PM app projects.id (INTEGER)
const APP_PROJECT_TITLE = argValue("title", "26-123 Playmakers");

if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Invalid --jp / --app: both must be integers.");
  process.exit(1);
}
const ZERO_UUID = "00000000-0000-0000-0000-000000000000"; // project_budget_codes.sub_job_key default

const API_V2 = "https://api-v2.jobplanner.com";
// Cloudflare blocks default script user-agents (err 1010); send a browser UA.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

if (!JP_KEY) {
  console.error("Missing JOBPLANNER_API_KEY. Add it to frontend/.env.local.");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function jpGet(url) {
  const res = await fetch(url, {
    headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Job Planner ${res.status} on ${url.replace(API_V2, "")}`);
  }
  return res.json();
}

const isoOrNull = (v) => (v ? new Date(v).toISOString() : null);
const centsToDollars = (c) => Math.round(Number(c) || 0) / 100;

// JP 6-digit cost code "013144" -> our cost_codes.id "01-3144".
function dashCostCode(code) {
  const s = String(code ?? "").trim();
  if (!/^\d{6}$/.test(s)) return null;
  return `${s.slice(0, 2)}-${s.slice(2)}`;
}

// JP prime-contract statusId -> our prime_contract_status_v2 enum.
// Conservative map; unknown -> draft. (4 = approved & pushed to ERP on observed data.)
function mapContractStatus(statusId) {
  switch (statusId) {
    case 1:
      return "draft";
    case 2:
      return "out_for_signature";
    case 3:
      return "approved";
    case 4:
      return "approved";
    case 5:
      return "complete";
    default:
      return "draft";
  }
}

async function main() {
  console.log(
    `Importing Job Planner prime contract: JP project ${JP_PROJECT_ID} -> app project ${APP_PROJECT_ID}${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  // 1. Pull the prime contract(s), cost codes, and cost types from Job Planner.
  const contracts = await jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/primecontracts`);
  if (!Array.isArray(contracts) || contracts.length === 0) {
    console.log("No prime contract returned from Job Planner. Nothing to import.");
    return;
  }
  if (contracts.length > 1) {
    console.log(`NOTE: JP returned ${contracts.length} prime contracts; importing all.`);
  }

  const [costCodes, costTypes] = await Promise.all([
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costcodes`),
    jpGet(`${API_V2}/projects/${JP_PROJECT_ID}/costtypes`),
  ]);
  const jpCodeById = new Map(costCodes.map((c) => [c.id, c]));
  // JP costTypeId -> single-letter code (L/E/M/S/X).
  const jpTypeCodeById = new Map(costTypes.map((t) => [t.id, t.code]));

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // cost_codes (id is the dashed code) -> title; FK guard for both budget codes and SOV.
  const { data: ccRows, error: ccErr } = await supabase.from("cost_codes").select("id, title");
  if (ccErr) throw new Error(`Failed to read cost_codes: ${ccErr.message}`);
  const costCodeTitleById = new Map((ccRows ?? []).map((r) => [r.id, r.title]));

  // cost_code_types: single-letter code (L/E/M/S/X) -> uuid (cost_type_id).
  const { data: ctRows, error: ctErr } = await supabase
    .from("cost_code_types")
    .select("id, code");
  if (ctErr) throw new Error(`Failed to read cost_code_types: ${ctErr.message}`);
  const costTypeIdByCode = new Map((ctRows ?? []).map((r) => [r.code, r.id]));

  for (const pc of contracts) {
    const lineItems = await jpGet(`${API_V2}/primecontracts/${pc.id}/lineitems`);
    const lines = Array.isArray(lineItems) ? lineItems : [];

    // GUARDRAIL: SOV must reconcile to the contract amount before we touch the DB.
    const sovSumCents = lines.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    if (sovSumCents !== Number(pc.amount)) {
      throw new Error(
        `SOV integrity check FAILED for contract ${pc.number}: ` +
          `sum of ${lines.length} line items = $${centsToDollars(sovSumCents).toFixed(2)} ` +
          `but contract amount = $${centsToDollars(pc.amount).toFixed(2)}. Aborting (no writes).`,
      );
    }

    // Resolve each line's cost code + cost type up front.
    let unresolvedCodes = 0;
    let unresolvedTypes = 0;
    const resolvedLines = lines.map((x, idx) => {
      const jpCode = jpCodeById.get(x.costCodeId)?.code ?? null;
      const dashed = dashCostCode(jpCode);
      const costCodeId = dashed && costCodeTitleById.has(dashed) ? dashed : null;
      if (jpCode && !costCodeId) unresolvedCodes++;

      const typeCode = jpTypeCodeById.get(x.costTypeId) ?? null;
      const costTypeId = typeCode ? costTypeIdByCode.get(typeCode) ?? null : null;
      if (typeCode && !costTypeId) unresolvedTypes++;

      return {
        index: idx,
        costCodeId,
        costTypeId,
        description:
          x.description?.trim() ||
          costCodeTitleById.get(costCodeId) ||
          jpCodeById.get(x.costCodeId)?.name ||
          `Line ${idx + 1}`,
        unit_cost: centsToDollars(x.amount),
      };
    });

    // Distinct (cost_code, cost_type) pairs -> the budget codes this SOV needs.
    const budgetCodeSeed = new Map();
    for (const ln of resolvedLines) {
      if (!ln.costCodeId || !ln.costTypeId) continue;
      const key = `${ln.costCodeId}|${ln.costTypeId}`;
      if (!budgetCodeSeed.has(key)) {
        budgetCodeSeed.set(key, {
          project_id: APP_PROJECT_ID,
          // sub_job_key is GENERATED from sub_job_id (defaults to the zero-UUID); omit it.
          cost_code_id: ln.costCodeId,
          cost_type_id: ln.costTypeId,
          description: costCodeTitleById.get(ln.costCodeId) || ln.description,
          description_mode: "concatenated",
          is_active: true,
        });
      }
    }

    const label =
      `${pc.number} "${APP_PROJECT_TITLE} Prime Contract" $${centsToDollars(pc.amount).toFixed(2)} ` +
      `[${mapContractStatus(pc.statusId)}/${pc.externalObject?.status === 4 ? "synced" : "unsynced"}] ` +
      `sov=${resolvedLines.length} budgetCodes=${budgetCodeSeed.size} ` +
      `unresolvedCodes=${unresolvedCodes} unresolvedTypes=${unresolvedTypes}`;

    if (DRY_RUN) {
      console.log(`  WOULD UPSERT ${label}`);
      console.log(
        `    SOV sample: ` +
          resolvedLines
            .slice(0, 3)
            .map((r) => `${r.costCodeId ?? "(none)"}=$${r.unit_cost.toFixed(2)}`)
            .join(", "),
      );
      continue;
    }

    // 2. Upsert budget codes for the project (chart of accounts) and map back to ids.
    const budgetCodeRows = [...budgetCodeSeed.values()];
    if (budgetCodeRows.length > 0) {
      const { error: bcErr } = await supabase
        .from("project_budget_codes")
        .upsert(budgetCodeRows, {
          onConflict: "project_id,sub_job_key,cost_code_id,cost_type_id",
        });
      if (bcErr) throw new Error(`Budget code upsert failed for ${label}: ${bcErr.message}`);
    }
    const { data: bcAll, error: bcReadErr } = await supabase
      .from("project_budget_codes")
      .select("id, cost_code_id, cost_type_id")
      .eq("project_id", APP_PROJECT_ID)
      .eq("sub_job_key", ZERO_UUID);
    if (bcReadErr) throw new Error(`Budget code read failed for ${label}: ${bcReadErr.message}`);
    const budgetCodeIdByKey = new Map(
      (bcAll ?? []).map((r) => [`${r.cost_code_id}|${r.cost_type_id}`, r.id]),
    );

    // 3. Idempotent contract upsert keyed on (project_id, contract_number).
    const contractRow = {
      project_id: APP_PROJECT_ID,
      contract_number: String(pc.number),
      title: `${APP_PROJECT_TITLE} Prime Contract`,
      description: pc.description?.trim() || null,
      inclusions: pc.inclusions?.trim() || null,
      exclusions: pc.exclusions?.trim() || null,
      original_contract_value: centsToDollars(pc.amount),
      revised_contract_value: centsToDollars(pc.totalAmount),
      status: mapContractStatus(pc.statusId),
      erp_status: pc.externalObject?.status === 4 ? "synced" : "unsynced",
      executed: Boolean(pc.isExecuted),
      executed_at: isoOrNull(pc.executedOn),
      retention_percentage: Number(pc.defaultWorkRetainagePercent) || 0,
      start_date: isoOrNull(pc.startOn),
      end_date: isoOrNull(pc.estimatedCompleteOn),
      substantial_completion_date: isoOrNull(pc.substantialCompleteOn),
      actual_completion_date: isoOrNull(pc.actualCompleteOn),
      signed_contract_received_date: isoOrNull(pc.signedContractOn),
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: findErr } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("project_id", APP_PROJECT_ID)
      .eq("contract_number", contractRow.contract_number)
      .maybeSingle();
    if (findErr) throw new Error(`Lookup failed for ${label}: ${findErr.message}`);

    let contractId;
    if (existing?.id) {
      const { error } = await supabase
        .from("prime_contracts")
        .update(contractRow)
        .eq("id", existing.id);
      if (error) throw new Error(`Contract update failed for ${label}: ${error.message}`);
      contractId = existing.id;
      console.log(`  UPDATED contract ${label}`);
    } else {
      const { data: inserted, error } = await supabase
        .from("prime_contracts")
        .insert(contractRow)
        .select("id")
        .single();
      if (error) throw new Error(`Contract insert failed for ${label}: ${error.message}`);
      contractId = inserted.id;
      console.log(`  INSERTED contract ${label}`);
    }

    // 4. Replace SOV line items, each linked to its budget code.
    const { error: delErr } = await supabase
      .from("contract_line_items")
      .delete()
      .eq("contract_id", contractId);
    if (delErr) throw new Error(`SOV delete failed for ${label}: ${delErr.message}`);

    let linkedLines = 0;
    const sovRows = resolvedLines.map((ln) => {
      const budgetCodeId =
        ln.costCodeId && ln.costTypeId
          ? budgetCodeIdByKey.get(`${ln.costCodeId}|${ln.costTypeId}`) ?? null
          : null;
      if (budgetCodeId) linkedLines++;
      return {
        contract_id: contractId,
        line_number: ln.index + 1,
        cost_code_id: ln.costCodeId,
        budget_code_id: budgetCodeId,
        description: ln.description,
        quantity: 1,
        unit_cost: ln.unit_cost,
        unit_of_measure: null,
      };
    });

    const { error: insErr } = await supabase.from("contract_line_items").insert(sovRows);
    if (insErr) throw new Error(`SOV insert failed for ${label}: ${insErr.message}`);

    const insertedSum = sovRows.reduce((a, r) => a + r.quantity * r.unit_cost, 0);
    console.log(
      `  SOV synced: ${sovRows.length} lines, total $${insertedSum.toFixed(2)} ` +
        `(matches contract $${contractRow.original_contract_value.toFixed(2)}); ` +
        `${linkedLines}/${sovRows.length} linked to budget codes.`,
    );
  }

  console.log(`\nDone.${DRY_RUN ? " (dry run — no writes)" : ""}`);
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
