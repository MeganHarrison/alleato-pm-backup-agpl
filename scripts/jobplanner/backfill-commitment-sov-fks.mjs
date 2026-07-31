#!/usr/bin/env node

/**
 * Backfill commitment SOV project_budget_code_id from live JobPlanner source data.
 *
 * Default is dry-run. Use --apply to mutate resolvable SOV rows.
 *
 * Use --report-missing-budget-codes to emit a review ledger for rows whose
 * JobPlanner source proves a cost-code/cost-type pair but the local project is
 * missing that project_budget_codes row. This script deliberately does not
 * create project_budget_codes; canonical budget master data needs stronger
 * owner approval than a heuristic parent match.
 *
 * The script only updates rows when all of these are true:
 * - local project maps to one JobPlanner project
 * - local commitment maps uniquely to one JobPlanner commitment
 * - JobPlanner line items resolve the row's legacy budget code to one cost type
 * - local project_budget_codes has the exact project/cost-code/cost-type row
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

const APPLY = process.argv.includes("--apply");
const CREATE_MISSING_BUDGET_CODES = process.argv.includes("--create-missing-budget-codes");
const REPORT_MISSING_BUDGET_CODES = process.argv.includes("--report-missing-budget-codes");
const TARGET_PARENT = argValue("parent");
const API_V1 = "https://api.jobplanner.com";
const API_V2 = "https://api-v2.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

if (!JP_KEY) throw new Error("Missing JOBPLANNER_API_KEY");
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase service env");
if (CREATE_MISSING_BUDGET_CODES) {
  throw new Error(
    "--create-missing-budget-codes is disabled. Use --report-missing-budget-codes to produce a review ledger; do not create canonical project_budget_codes from heuristic matches.",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function argValue(name) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function jpGet(base, pathname) {
  const res = await fetch(`${base}${pathname}`, {
    headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`JobPlanner ${res.status} ${pathname}`);
  }
  return res.json();
}

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function dashCostCode(value) {
  const raw = String(value ?? "").trim();
  if (/^\d{2}-\d{4}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (/^\d{6}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return null;
}

function docDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? String(Number(digits)) : "";
}

function centsToDollars(value) {
  return Math.round(Number(value) || 0) / 100;
}

function closeMoney(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.02;
}

async function selectAll(table, columns, build) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    query = build ? build(query) : query;
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function chunk(values, size = 100) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

async function fetchCommitments(ids) {
  const rows = [];
  for (const part of chunk(ids)) {
    const { data, error } = await supabase.from("commitments_unified").select("*").in("id", part);
    if (error) throw new Error(`commitments_unified: ${error.message}`);
    rows.push(...(data ?? []));
  }
  return rows;
}

async function fetchProjects(ids) {
  const rows = [];
  for (const part of chunk(ids)) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, project_number, name_code")
      .in("id", part);
    if (error) throw new Error(`projects: ${error.message}`);
    rows.push(...(data ?? []));
  }
  return rows;
}

async function fetchCompanies(ids) {
  const clean = ids.filter(Boolean);
  if (clean.length === 0) return [];
  const rows = [];
  for (const part of chunk(clean)) {
    const { data, error } = await supabase.from("companies").select("id, name").in("id", part);
    if (error) throw new Error(`companies: ${error.message}`);
    rows.push(...(data ?? []));
  }
  return rows;
}

function mapProject(localProject, jpProjects) {
  const number = String(localProject.project_number ?? "").trim();
  const name = norm(localProject.name);
  const nameCode = norm(localProject.name_code);
  const candidates = jpProjects
    .map((project) => {
      const jpName = norm(project.projectName);
      let score = 0;
      if (number && jpName.includes(norm(number))) score += 70;
      if (name && (jpName.includes(name) || name.includes(jpName))) score += 30;
      if (nameCode && jpName === nameCode) score += 20;
      return { project, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (candidates.length === 0) return null;
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
  return candidates[0].project;
}

function scoreCommitment(local, localCompany, localRows, jpCommitment) {
  const localType = local.commitment_type === "purchase_order" ? 1 : 2;
  if (jpCommitment.commitmentType !== localType) return 0;
  let score = 0;
  const localDoc = docDigits(local.contract_number);
  const jpNumbers = [
    jpCommitment.number,
    jpCommitment.externalObject?.data?.externalNumber,
    jpCommitment.externalObject?.data?.commitmentNbr,
  ].map(docDigits);
  if (localDoc && jpNumbers.includes(localDoc)) score += 90;

  const company = norm(localCompany?.name);
  const jpCompany = norm(jpCommitment.contractedContact?.companyName);
  if (company && jpCompany && company === jpCompany) score += 35;

  const localText = norm(`${local.title ?? ""} ${local.description ?? ""}`);
  const jpText = norm(`${jpCommitment.title ?? ""} ${jpCommitment.description ?? ""}`);
  if (localText && jpText) {
    if (jpText.includes(localText.slice(0, 80)) || localText.includes(jpText.slice(0, 80))) {
      score += 30;
    } else {
      const words = localText.split(" ").filter((word) => word.length > 4).slice(0, 20);
      const hits = words.filter((word) => jpText.includes(word)).length;
      if (hits >= 8) score += 15;
    }
  }

  const localTotal = localRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const jpAmounts = [
    centsToDollars(jpCommitment.amount),
    centsToDollars(jpCommitment.totalAmount),
    centsToDollars((jpCommitment.amount || 0) + (jpCommitment.approvedChanges || 0)),
    centsToDollars(jpCommitment.progressAmount),
  ];
  if (jpAmounts.some((amount) => closeMoney(localTotal, amount))) score += 20;

  return score;
}

function chooseJobPlannerCommitment(local, localCompany, localRows, jpCommitments) {
  const scored = jpCommitments
    .map((commitment) => ({
      commitment,
      score: scoreCommitment(local, localCompany, localRows, commitment),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { commitment: null, reason: "no_parent_match", scored };
  const top = scored[0];
  const second = scored[1];
  if (top.score < 50) return { commitment: null, reason: "weak_parent_match", scored };
  if (second && top.score - second.score < 15) {
    return { commitment: null, reason: "ambiguous_parent_match", scored };
  }
  return { commitment: top.commitment, reason: "matched", scored };
}

function resolveLine(row, jpLines, jpCodeById, jpTypeById, localTypeByCode, budgetCodeByKey) {
  const localCostCode = dashCostCode(row.budget_code);
  if (!localCostCode) return { reason: "invalid_legacy_budget_code" };

  const sourceLines = jpLines
    .map((line) => {
      const jpCode = jpCodeById.get(line.costCodeId);
      const jpType = jpTypeById.get(line.costTypeId);
      return {
        line,
        costCodeId: dashCostCode(jpCode?.code),
        costTypeCode: jpType?.code ?? null,
        amount: centsToDollars(line.amount),
      };
    })
    .filter((line) => line.costCodeId === localCostCode);

  if (sourceLines.length === 0) return { reason: "source_commitment_missing_cost_code" };

  const amountMatches = sourceLines.filter((line) => closeMoney(row.amount, line.amount));
  const nonZeroSourceLines = sourceLines.filter((line) => line.amount !== 0);
  const candidateLines = amountMatches.length > 0 ? amountMatches : nonZeroSourceLines;
  const typeCodes = new Set(candidateLines.map((line) => line.costTypeCode).filter(Boolean));

  if (typeCodes.size !== 1) {
    const sourceTypeCodes = new Set(sourceLines.map((line) => line.costTypeCode).filter(Boolean));
    if (candidateLines.length === 0 && sourceTypeCodes.size === 1) {
      const costTypeCode = [...sourceTypeCodes][0];
      const localType = localTypeByCode.get(costTypeCode);
      if (!localType) return { reason: "missing_local_cost_type", costTypeCode };
      const budgetCode = budgetCodeByKey.get(`${row.project_id}|${localCostCode}|${localType.id}`);
      if (!budgetCode) {
        return {
          reason: "missing_project_budget_code",
          costCodeId: localCostCode,
          costTypeId: localType.id,
          costTypeCode,
          costTypeDescription: localType.description,
          normalizedBudgetCode: localCostCode,
          sourceLineIds: sourceLines.map((line) => line.line.id),
          proofQuality: "source_cost_type_only_amount_unmatched",
        };
      }
      return {
        reason: "resolved",
        projectBudgetCodeId: budgetCode.id,
        normalizedBudgetCode: localCostCode,
        costTypeCode,
        sourceLineIds: sourceLines.map((line) => line.line.id),
        proofQuality: "source_cost_type_only_amount_unmatched",
      };
    }
    return {
      reason: amountMatches.length > 0 ? "ambiguous_amount_matched_cost_types" : "ambiguous_source_cost_types",
      sourceLineCount: sourceLines.length,
      typeCodes: [...typeCodes],
    };
  }

  const costTypeCode = [...typeCodes][0];
  const localType = localTypeByCode.get(costTypeCode);
  if (!localType) return { reason: "missing_local_cost_type", costTypeCode };

  const budgetCode = budgetCodeByKey.get(`${row.project_id}|${localCostCode}|${localType.id}`);
  if (!budgetCode) {
    return {
      reason: "missing_project_budget_code",
      costCodeId: localCostCode,
      costTypeId: localType.id,
      costTypeCode,
      costTypeDescription: localType.description,
      normalizedBudgetCode: localCostCode,
      sourceLineIds: candidateLines.map((line) => line.line.id),
    };
  }

  return {
    reason: "resolved",
    projectBudgetCodeId: budgetCode.id,
    normalizedBudgetCode: localCostCode,
    costTypeCode,
    sourceLineIds: candidateLines.map((line) => line.line.id),
  };
}

async function main() {
  const [poMissing, subMissing] = await Promise.all([
    selectAll(
      "purchase_order_sov_items",
      "id, purchase_order_id, budget_code, amount",
      (query) => query.is("project_budget_code_id", null).not("budget_code", "is", null),
    ),
    selectAll(
      "subcontract_sov_items",
      "id, subcontract_id, budget_code, amount",
      (query) => query.is("project_budget_code_id", null).not("budget_code", "is", null),
    ),
  ]);

  const unresolvedRows = [
    ...poMissing.map((row) => ({
      ...row,
      table: "purchase_order_sov_items",
      parent_id: row.purchase_order_id,
      parent_column: "purchase_order_id",
    })),
    ...subMissing.map((row) => ({
      ...row,
      table: "subcontract_sov_items",
      parent_id: row.subcontract_id,
      parent_column: "subcontract_id",
    })),
  ].filter((row) => !TARGET_PARENT || row.parent_id === TARGET_PARENT);

  const parentIds = [...new Set(unresolvedRows.map((row) => row.parent_id))];
  const parents = await fetchCommitments(parentIds);
  const parentById = new Map(parents.map((row) => [row.id, row]));

  const projectIds = [...new Set(parents.map((row) => row.project_id).filter(Boolean))];
  const projects = await fetchProjects(projectIds);
  const projectById = new Map(projects.map((row) => [row.id, row]));

  const companies = await fetchCompanies([...new Set(parents.map((row) => row.contract_company_id))]);
  const companyById = new Map(companies.map((row) => [row.id, row]));

  const [localTypes, localBudgetCodes, localCostCodes, jpProjects] = await Promise.all([
    selectAll("cost_code_types", "id, code, description"),
    selectAll("project_budget_codes", "id, project_id, cost_code_id, cost_type_id, description, is_active", (query) =>
      query.in("project_id", projectIds).eq("is_active", true),
    ),
    selectAll("cost_codes", "id, title"),
    jpGet(API_V1, "/projects"),
  ]);

  const localTypeByCode = new Map(localTypes.map((row) => [row.code, row]));
  const localCostCodeById = new Map(localCostCodes.map((row) => [row.id, row]));
  const budgetCodeByKey = new Map(
    localBudgetCodes.map((row) => [`${row.project_id}|${row.cost_code_id}|${row.cost_type_id}`, row]),
  );

  const jpProjectByLocalProject = new Map();
  for (const project of projects) {
    jpProjectByLocalProject.set(project.id, mapProject(project, jpProjects));
  }

  const jpCache = new Map();
  async function loadJpProject(jpProjectId) {
    if (jpCache.has(jpProjectId)) return jpCache.get(jpProjectId);
    const [commitments, costCodes, costTypes] = await Promise.all([
      jpGet(API_V2, `/projects/${jpProjectId}/commitments`),
      jpGet(API_V2, `/projects/${jpProjectId}/costcodes`),
      jpGet(API_V2, `/projects/${jpProjectId}/costtypes`),
    ]);
    const value = {
      commitments,
      costCodeById: new Map(costCodes.map((row) => [row.id, row])),
      costTypeById: new Map(costTypes.map((row) => [row.id, row])),
      lineItemsByCommitmentId: new Map(),
    };
    jpCache.set(jpProjectId, value);
    return value;
  }

  async function loadJpLines(jpProjectData, commitmentId) {
    if (jpProjectData.lineItemsByCommitmentId.has(commitmentId)) {
      return jpProjectData.lineItemsByCommitmentId.get(commitmentId);
    }
    const lines = await jpGet(API_V2, `/commitments/${commitmentId}/lineitems`);
    jpProjectData.lineItemsByCommitmentId.set(commitmentId, lines);
    return lines;
  }

  const rowsByParent = Map.groupBy(unresolvedRows, (row) => row.parent_id);
  const updates = [];
  const missingBudgetCodeRows = [];
  const reasons = new Map();
  const parentMatches = [];

  for (const [parentId, rows] of rowsByParent.entries()) {
    const parent = parentById.get(parentId);
    if (!parent) {
      addReason("missing_local_parent", rows.length);
      continue;
    }
    const project = projectById.get(parent.project_id);
    const jpProject = jpProjectByLocalProject.get(parent.project_id);
    if (!project || !jpProject) {
      addReason("missing_jobplanner_project_match", rows.length);
      continue;
    }

    const jpProjectData = await loadJpProject(jpProject.projectId);
    const parentMatch = chooseJobPlannerCommitment(
      parent,
      companyById.get(parent.contract_company_id),
      rows,
      jpProjectData.commitments,
    );
    parentMatches.push({
      parentId,
      contractNumber: parent.contract_number,
      localProjectId: parent.project_id,
      jpProjectId: jpProject.projectId,
      reason: parentMatch.reason,
      top: parentMatch.scored.slice(0, 3).map((entry) => ({
        score: entry.score,
        id: entry.commitment.id,
        number: entry.commitment.number,
        title: entry.commitment.title,
        company: entry.commitment.contractedContact?.companyName ?? null,
      })),
    });
    if (!parentMatch.commitment) {
      addReason(parentMatch.reason, rows.length);
      continue;
    }

    const jpLines = await loadJpLines(jpProjectData, parentMatch.commitment.id);
    for (const row of rows) {
      const resolved = resolveLine(
        { ...row, project_id: parent.project_id },
        jpLines,
        jpProjectData.costCodeById,
        jpProjectData.costTypeById,
        localTypeByCode,
        budgetCodeByKey,
      );
      if (resolved.reason !== "resolved") {
        if (resolved.reason === "missing_project_budget_code") {
          missingBudgetCodeRows.push({
            table: row.table,
            id: row.id,
            parentId,
            projectId: parent.project_id,
            budgetCode: row.budget_code,
            normalizedBudgetCode: resolved.normalizedBudgetCode,
            costCodeId: resolved.costCodeId,
            costTypeId: resolved.costTypeId,
            costTypeCode: resolved.costTypeCode,
            costTypeDescription: resolved.costTypeDescription,
            sourceLineIds: resolved.sourceLineIds,
            proofQuality: resolved.proofQuality ?? "source_cost_type_and_amount",
          });
        }
        addReason(resolved.reason, 1);
        continue;
      }
      updates.push({
        table: row.table,
        id: row.id,
        parentId,
        budgetCode: row.budget_code,
        normalizedBudgetCode: resolved.normalizedBudgetCode,
        projectBudgetCodeId: resolved.projectBudgetCodeId,
        costTypeCode: resolved.costTypeCode,
        sourceLineIds: resolved.sourceLineIds,
        proofQuality: resolved.proofQuality ?? "source_cost_type_and_amount",
      });
    }
  }

  const missingBudgetCodeCandidatesByKey = new Map();
  for (const pending of missingBudgetCodeRows) {
    const key = `${pending.projectId}|${pending.costCodeId}|${pending.costTypeId}`;
    const costCode = localCostCodeById.get(pending.costCodeId);
    const descriptionBase = costCode?.title?.trim() || pending.costCodeId;
    const typeLabel = pending.costTypeDescription || pending.costTypeCode;
    if (!missingBudgetCodeCandidatesByKey.has(key)) {
      missingBudgetCodeCandidatesByKey.set(key, {
        projectId: pending.projectId,
        costCodeId: pending.costCodeId,
        costTypeId: pending.costTypeId,
        costTypeCode: pending.costTypeCode,
        description: typeLabel ? `${descriptionBase} - ${typeLabel}` : descriptionBase,
        descriptionMode: "concatenated",
        rowCount: 0,
        rows: [],
      });
    }
    const candidate = missingBudgetCodeCandidatesByKey.get(key);
    candidate.rowCount += 1;
    candidate.rows.push({
      table: pending.table,
      id: pending.id,
      parentId: pending.parentId,
      legacyBudgetCode: pending.budgetCode,
      normalizedBudgetCode: pending.normalizedBudgetCode,
      sourceLineIds: pending.sourceLineIds,
      proofQuality: pending.proofQuality,
    });
  }
  const missingBudgetCodeCandidates = [...missingBudgetCodeCandidatesByKey.values()].map((candidate) => ({
    ...candidate,
    rows: REPORT_MISSING_BUDGET_CODES ? candidate.rows : candidate.rows.slice(0, 5),
  }));

  const disabledCreateModeNote = {
    reason: "disabled_by_design",
    details:
      "Missing project_budget_codes are reported only. Creating canonical budget master data from heuristic JobPlanner parent matches is intentionally blocked.",
  };

  /*
   * Historical note:
   * A permissive create mode was rejected during review because it could create
   * canonical project_budget_codes from source-system heuristics. Keep this
   * utility link-only; use the emitted ledger for explicit budget-code setup.
   */
  const missingBudgetCodesToCreate = missingBudgetCodeCandidates.map((candidate) => ({
    project_id: candidate.projectId,
    cost_code_id: candidate.costCodeId,
    cost_type_id: candidate.costTypeId,
    description: candidate.description,
    description_mode: "concatenated",
    is_active: true,
  }));

  if (APPLY) {
    for (const update of updates) {
      const { data, error } = await supabase
        .from(update.table)
        .update({
          project_budget_code_id: update.projectBudgetCodeId,
          budget_code: update.normalizedBudgetCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id)
        .is("project_budget_code_id", null)
        .select("id");
      if (error) throw new Error(`${update.table} ${update.id}: ${error.message}`);
      if ((data ?? []).length !== 1) {
        throw new Error(`${update.table} ${update.id}: expected 1 updated row, got ${(data ?? []).length}`);
      }
    }
  }

  const byTable = updates.reduce((acc, row) => {
    acc[row.table] = (acc[row.table] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        createMissingBudgetCodes: false,
        reportMissingBudgetCodes: REPORT_MISSING_BUDGET_CODES,
        disabledCreateModeNote,
        targetParent: TARGET_PARENT,
        unresolvedRows: unresolvedRows.length,
        parentCount: parentIds.length,
        missingBudgetCodeCandidateCount: missingBudgetCodeCandidates.length,
        missingBudgetCodeRowCount: missingBudgetCodeRows.length,
        missingBudgetCodesToCreate,
        createdBudgetCodes: 0,
        resolvedUpdates: updates.length,
        resolvedByTable: byTable,
        reasonCounts: Object.fromEntries([...reasons.entries()].sort()),
        missingBudgetCodeCandidates,
        updateSample: updates.slice(0, 25),
        parentMatchSample: parentMatches.slice(0, 25),
      },
      null,
      2,
    ),
  );

  function addReason(reason, count) {
    reasons.set(reason, (reasons.get(reason) ?? 0) + count);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
