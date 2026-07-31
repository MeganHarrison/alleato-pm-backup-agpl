import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_shared";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  classifyCommitmentSovCleanupRow,
  normalizeCommitmentSovBudgetCode,
  type CommitmentSovCleanupCandidate,
  type CommitmentSovCleanupCandidateInput,
  type CommitmentSovCleanupReason,
} from "@/lib/commitments/sov-cleanup-classification";

const WHERE = "api/admin/commitment-sov-cleanup#GET";

type SovTableName = "purchase_order_sov_items" | "subcontract_sov_items";

type ParentCommitment = {
  project_id: number;
  contract_number: string | null;
  title: string | null;
  status: string | null;
};

type PurchaseOrderSovRow = {
  id: string;
  purchase_order_id: string;
  line_number: number | null;
  budget_code: string | null;
  description: string | null;
  amount: number | null;
  purchase_orders: ParentCommitment | ParentCommitment[] | null;
};

type SubcontractSovRow = {
  id: string;
  subcontract_id: string;
  line_number: number | null;
  budget_code: string | null;
  description: string | null;
  amount: number | null;
  subcontracts: ParentCommitment | ParentCommitment[] | null;
};

type ProjectBudgetCodeRow = {
  id: string;
  project_id: number;
  cost_code_id: string;
  cost_type_id: string | null;
  is_active: boolean | null;
  cost_code_types: { code: string | null } | { code: string | null }[] | null;
};

export type CommitmentSovCleanupRow = {
  id: string;
  table: SovTableName;
  parentId: string;
  projectId: number;
  contractNumber: string | null;
  parentTitle: string | null;
  parentStatus: string | null;
  commitmentHref: string;
  lineNumber: number | null;
  budgetCode: string | null;
  normalizedBudgetCode: string;
  description: string | null;
  amount: number | null;
  reason: CommitmentSovCleanupReason;
  typedCandidates: CommitmentSovCleanupCandidate[];
  otherCandidates: CommitmentSovCleanupCandidate[];
  recommendedAction: string;
};

export type CommitmentSovCleanupResponse = {
  rows: CommitmentSovCleanupRow[];
  summary: {
    total: number;
    byTable: Record<SovTableName, number>;
    byReason: Partial<Record<CommitmentSovCleanupReason, number>>;
  };
};

function relationOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function buildCandidate(row: ProjectBudgetCodeRow): CommitmentSovCleanupCandidateInput {
  const costType = relationOne(row.cost_code_types);
  return {
    id: row.id,
    costCodeId: row.cost_code_id,
    costTypeCode: costType?.code ?? null,
    isActive: row.is_active === true,
    hasCostType: Boolean(row.cost_type_id),
  };
}

function summarizeRows(rows: CommitmentSovCleanupRow[]): CommitmentSovCleanupResponse["summary"] {
  const summary: CommitmentSovCleanupResponse["summary"] = {
    total: rows.length,
    byTable: {
      purchase_order_sov_items: 0,
      subcontract_sov_items: 0,
    },
    byReason: {},
  };

  for (const row of rows) {
    summary.byTable[row.table] += 1;
    summary.byReason[row.reason] = (summary.byReason[row.reason] ?? 0) + 1;
  }

  return summary;
}

export const GET = withApiGuardrails(WHERE, async () => {
  await requireAdmin(WHERE);


  const [poResult, subcontractResult] = await Promise.all([
    serviceDb.from("purchase_order_sov_items")
      .select(
        "id, purchase_order_id, line_number, budget_code, description, amount, purchase_orders!inner(project_id, contract_number, title, status)",
      )
      .is("project_budget_code_id", null)
      .order("purchase_order_id")
      .order("line_number"),
    serviceDb.from("subcontract_sov_items")
      .select(
        "id, subcontract_id, line_number, budget_code, description, amount, subcontracts!inner(project_id, contract_number, title, status)",
      )
      .is("project_budget_code_id", null)
      .order("subcontract_id")
      .order("line_number"),
  ]);

  if (poResult.error) throw poResult.error;
  if (subcontractResult.error) throw subcontractResult.error;

  const poRows = (poResult.data ?? []) as PurchaseOrderSovRow[];
  const subcontractRows = (subcontractResult.data ?? []) as SubcontractSovRow[];
  const projectIds = [
    ...new Set([
      ...poRows
        .map((row) => relationOne(row.purchase_orders)?.project_id)
        .filter((projectId): projectId is number => typeof projectId === "number"),
      ...subcontractRows
        .map((row) => relationOne(row.subcontracts)?.project_id)
        .filter((projectId): projectId is number => typeof projectId === "number"),
    ]),
  ];

  const { data: budgetCodeRows, error: budgetCodesError } =
    projectIds.length > 0
      ? await serviceDb.from("project_budget_codes")
          .select("id, project_id, cost_code_id, cost_type_id, is_active, cost_code_types(code)")
          .in("project_id", projectIds)
      : { data: [], error: null };

  if (budgetCodesError) throw budgetCodesError;

  const candidatesByProject = new Map<number, CommitmentSovCleanupCandidateInput[]>();
  for (const row of (budgetCodeRows ?? []) as ProjectBudgetCodeRow[]) {
    const candidates = candidatesByProject.get(row.project_id) ?? [];
    candidates.push(buildCandidate(row));
    candidatesByProject.set(row.project_id, candidates);
  }

  const rows: CommitmentSovCleanupRow[] = [];

  for (const row of poRows) {
    const parent = relationOne(row.purchase_orders);
    if (!parent) continue;
    const classification = classifyCommitmentSovCleanupRow({
      budgetCode: row.budget_code,
      amount: row.amount,
      candidates: candidatesByProject.get(parent.project_id) ?? [],
    });
    rows.push({
      id: row.id,
      table: "purchase_order_sov_items",
      parentId: row.purchase_order_id,
      projectId: parent.project_id,
      contractNumber: parent.contract_number,
      parentTitle: parent.title,
      parentStatus: parent.status,
      commitmentHref: `/${parent.project_id}/commitments/${row.purchase_order_id}`,
      lineNumber: row.line_number,
      budgetCode: row.budget_code,
      normalizedBudgetCode: normalizeCommitmentSovBudgetCode(row.budget_code),
      description: row.description,
      amount: row.amount,
      ...classification,
    });
  }

  for (const row of subcontractRows) {
    const parent = relationOne(row.subcontracts);
    if (!parent) continue;
    const classification = classifyCommitmentSovCleanupRow({
      budgetCode: row.budget_code,
      amount: row.amount,
      candidates: candidatesByProject.get(parent.project_id) ?? [],
    });
    rows.push({
      id: row.id,
      table: "subcontract_sov_items",
      parentId: row.subcontract_id,
      projectId: parent.project_id,
      contractNumber: parent.contract_number,
      parentTitle: parent.title,
      parentStatus: parent.status,
      commitmentHref: `/${parent.project_id}/commitments/${row.subcontract_id}`,
      lineNumber: row.line_number,
      budgetCode: row.budget_code,
      normalizedBudgetCode: normalizeCommitmentSovBudgetCode(row.budget_code),
      description: row.description,
      amount: row.amount,
      ...classification,
    });
  }

  rows.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason.localeCompare(b.reason);
    if (a.projectId !== b.projectId) return a.projectId - b.projectId;
    return (a.contractNumber ?? "").localeCompare(b.contractNumber ?? "");
  });

  return NextResponse.json({
    rows,
    summary: summarizeRows(rows),
  } satisfies CommitmentSovCleanupResponse);
});
