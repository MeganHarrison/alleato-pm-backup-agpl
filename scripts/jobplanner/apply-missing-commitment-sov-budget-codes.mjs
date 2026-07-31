#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const candidatePath =
  argValue("candidate-file") ||
  "docs/ops/evidence/2026-07-07-jobplanner-commitment-sov-fk-backfill/missing-budget-code-candidates.json";
const outputPath =
  argValue("output") ||
  "docs/ops/evidence/2026-07-07-commitment-sov-missing-budget-codes/candidate-validation.json";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase service env");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function loadCandidates() {
  const fullPath = path.resolve(repoRoot, candidatePath);
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const candidates = parsed.missingBudgetCodeCandidates;
  if (!Array.isArray(candidates)) {
    throw new Error(`Candidate file missing missingBudgetCodeCandidates array: ${candidatePath}`);
  }
  assertUniqueCandidateKeys(candidates);
  return { candidates, sourcePath: fullPath };
}

function candidateKey(candidate) {
  return `${candidate.projectId}|${candidate.costCodeId}|${candidate.costTypeId}`;
}

function assertUniqueCandidateKeys(candidates) {
  const seen = new Map();
  candidates.forEach((candidate, index) => {
    const key = candidateKey(candidate);
    if (seen.has(key)) {
      throw new Error(
        `Duplicate project_budget_code candidate ${key}; first index ${seen.get(key)}, duplicate index ${index}`,
      );
    }
    seen.set(key, index);
  });
}

async function requireOne(table, columns, buildQuery, context) {
  const { data, error } = await buildQuery(supabase.from(table).select(columns)).maybeSingle();
  if (error) throw new Error(`${table} lookup failed for ${context}: ${error.message}`);
  if (!data) throw new Error(`${table} lookup missing for ${context}`);
  return data;
}

async function maybeExistingBudgetCode(candidate) {
  const { data, error } = await supabase
    .from("project_budget_codes")
    .select("id, is_active, description")
    .eq("project_id", candidate.projectId)
    .eq("cost_code_id", candidate.costCodeId)
    .eq("cost_type_id", candidate.costTypeId)
    .is("sub_job_id", null);
  if (error) {
    throw new Error(
      `project_budget_codes duplicate check failed for ${candidate.projectId}/${candidate.costCodeId}/${candidate.costTypeCode}: ${error.message}`,
    );
  }
  return data ?? [];
}

async function validateSovRow(candidate, row) {
  const table = row.table;
  if (table === "purchase_order_sov_items") {
    const record = await requireOne(
      table,
      "id, purchase_order_id, budget_code, project_budget_code_id, purchase_orders!inner(id, project_id)",
      (query) => query.eq("id", row.id),
      row.id,
    );
    return validateSovRecord(candidate, row, record, record.purchase_orders?.project_id);
  }
  if (table === "subcontract_sov_items") {
    const record = await requireOne(
      table,
      "id, subcontract_id, budget_code, project_budget_code_id, subcontracts!inner(id, project_id)",
      (query) => query.eq("id", row.id),
      row.id,
    );
    return validateSovRecord(candidate, row, record, record.subcontracts?.project_id);
  }
  throw new Error(`Unsupported SOV table in candidate row ${row.id}: ${table}`);
}

function validateSovRecord(candidate, row, record, parentProjectId) {
  if (parentProjectId !== candidate.projectId) {
    throw new Error(
      `${row.table} ${row.id} parent project ${parentProjectId} does not match candidate project ${candidate.projectId}`,
    );
  }
  if (record.project_budget_code_id) {
    throw new Error(`${row.table} ${row.id} is already linked to ${record.project_budget_code_id}`);
  }
  const legacyBudgetCode = String(record.budget_code ?? "").trim();
  if (legacyBudgetCode !== row.normalizedBudgetCode) {
    throw new Error(
      `${row.table} ${row.id} budget_code ${legacyBudgetCode} does not match candidate ${row.normalizedBudgetCode}`,
    );
  }
  if (row.proofQuality !== "source_cost_type_and_amount") {
    throw new Error(`${row.table} ${row.id} proofQuality ${row.proofQuality} is not strong enough for budget-code creation`);
  }
  if (!Array.isArray(row.sourceLineIds) || row.sourceLineIds.length === 0) {
    throw new Error(`${row.table} ${row.id} has no sourceLineIds`);
  }
  return {
    table: row.table,
    id: row.id,
    parentProjectId,
    legacyBudgetCode,
    sourceLineIds: row.sourceLineIds,
  };
}

async function validateCandidate(candidate) {
  await requireOne("projects", "id", (query) => query.eq("id", candidate.projectId), `project ${candidate.projectId}`);
  await requireOne("cost_codes", "id", (query) => query.eq("id", candidate.costCodeId), `cost code ${candidate.costCodeId}`);
  const costType = await requireOne(
    "cost_code_types",
    "id, code, description",
    (query) => query.eq("id", candidate.costTypeId),
    `cost type ${candidate.costTypeId}`,
  );
  if (costType.code !== candidate.costTypeCode) {
    throw new Error(
      `cost_type ${candidate.costTypeId} code ${costType.code} does not match candidate ${candidate.costTypeCode}`,
    );
  }

  const existing = await maybeExistingBudgetCode(candidate);
  if (existing.some((row) => row.is_active)) {
    throw new Error(
      `active project_budget_code already exists for ${candidate.projectId}/${candidate.costCodeId}/${candidate.costTypeCode}`,
    );
  }
  if (existing.length > 0) {
    throw new Error(
      `inactive project_budget_code already exists for ${candidate.projectId}/${candidate.costCodeId}/${candidate.costTypeCode}; review/reactivation required`,
    );
  }

  const rows = [];
  for (const row of candidate.rows) rows.push(await validateSovRow(candidate, row));

  return {
    projectId: candidate.projectId,
    costCodeId: candidate.costCodeId,
    costTypeId: candidate.costTypeId,
    costTypeCode: candidate.costTypeCode,
    description: candidate.description,
    descriptionMode: candidate.descriptionMode || "concatenated",
    rowCount: candidate.rowCount,
    rows,
  };
}

async function createBudgetCode(candidate) {
  const { data, error } = await supabase
    .from("project_budget_codes")
    .insert({
      project_id: candidate.projectId,
      cost_code_id: candidate.costCodeId,
      cost_type_id: candidate.costTypeId,
      description: candidate.description,
      description_mode: candidate.descriptionMode,
      is_active: true,
    })
    .select("id, project_id, cost_code_id, cost_type_id, description, is_active")
    .single();
  if (error || !data) {
    throw new Error(
      `project_budget_codes insert failed for ${candidate.projectId}/${candidate.costCodeId}/${candidate.costTypeCode}: ${error?.message ?? "no row returned"}`,
    );
  }
  return data;
}

async function main() {
  const { candidates, sourcePath } = loadCandidates();
  const validated = [];
  for (const candidate of candidates) validated.push(await validateCandidate(candidate));

  const created = [];
  if (APPLY) {
    for (const candidate of validated) created.push(await createBudgetCode(candidate));
  }

  const evidence = {
    mode: APPLY ? "apply" : "dry-run",
    sourcePath,
    candidateCount: candidates.length,
    candidateRowCount: candidates.reduce((sum, candidate) => sum + candidate.rowCount, 0),
    validatedCandidateCount: validated.length,
    validatedRowCount: validated.reduce((sum, candidate) => sum + candidate.rows.length, 0),
    createdBudgetCodeCount: created.length,
    createdBudgetCodes: created,
    candidates: validated,
    completedAt: new Date().toISOString(),
  };

  const fullOutputPath = path.resolve(repoRoot, outputPath);
  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });
  fs.writeFileSync(fullOutputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath: fullOutputPath, ...evidence }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
