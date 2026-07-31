import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import {
  createBudgetCodeMatcher,
  resolveBudgetDrilldownTargets,
} from "@/lib/budget/drilldown-matching";

/**
 * GET /api/projects/[projectId]/budget/commitments
 * Returns the committed subcontract / PO SOV rows and approved commitment
 * change orders behind one budget line's (or division group's) Committed
 * Costs value.
 *
 * Matching mirrors computeBudgetGrandTotals: SOV budget_code values are
 * stored in mixed formats ("50-5500.S", "505500", project_budget_codes
 * UUIDs), so rows are matched by normalized lookup key — never by exact
 * string equality.
 */

const COMPLETE_STATUS_ALIASES = new Set(["complete", "completed"]);

function statusMatches(filter: Set<string>, status: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  if (filter.has(normalized)) return true;
  // "complete" and "completed" are used interchangeably across subcontracts
  // and purchase orders — treat them as the same status.
  if (COMPLETE_STATUS_ALIASES.has(normalized)) {
    return Array.from(filter).some((s) => COMPLETE_STATUS_ALIASES.has(s));
  }
  return false;
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/commitments#GET",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const budgetLineId = searchParams.get("budgetLineId");
    const costCodeParam = searchParams.get("costCode");
    const statusParam = searchParams.get("status") ?? "approved,complete";
    const statusFilter = new Set(
      statusParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    const { costCodeIds: targetCostCodes } = await resolveBudgetDrilldownTargets(
      supabase,
      projectIdNum,
      budgetLineId,
      costCodeParam,
    );
    if (targetCostCodes.length === 0) {
      return NextResponse.json({ commitments: [] });
    }

    const matchesTarget = await createBudgetCodeMatcher(
      supabase,
      projectIdNum,
      targetCostCodes,
    );

    const [subcontractsRes, purchaseOrdersRes] = await Promise.all([
      supabase
        .from("subcontract_sov_items")
        .select(
          `
          id,
          amount,
          description,
          budget_code,
          subcontract_id,
          subcontracts!inner(
            id,
            project_id,
            status,
            contract_number,
            created_at
          )
        `,
        )
        .eq("subcontracts.project_id", projectIdNum),
      supabase
        .from("purchase_order_sov_items")
        .select(
          `
          id,
          amount,
          description,
          budget_code,
          purchase_order_id,
          purchase_orders!inner(
            id,
            project_id,
            status,
            contract_number,
            created_at
          )
        `,
        )
        .eq("purchase_orders.project_id", projectIdNum),
    ]);

    if (subcontractsRes.error || purchaseOrdersRes.error) {
      return NextResponse.json(
        {
          error: "Failed to fetch commitments",
          details: subcontractsRes.error?.message ?? purchaseOrdersRes.error?.message,
        },
        { status: 500 },
      );
    }

    const commitments = [
      ...(subcontractsRes.data ?? [])
        .filter((row) => {
          const parent = Array.isArray(row.subcontracts)
            ? row.subcontracts[0]
            : row.subcontracts;
          return (
            matchesTarget(row.budget_code) &&
            statusMatches(statusFilter, parent?.status ?? null)
          );
        })
        .map((row) => {
          const parent = Array.isArray(row.subcontracts)
            ? row.subcontracts[0]
            : row.subcontracts;

          return {
            id: row.id,
            commitmentNumber: parent?.contract_number || "",
            vendor: null as string | null,
            description: row.description || "",
            amount: Number(row.amount) || 0,
            status: parent?.status || "",
            type: "subcontract" as const,
            executedDate: parent?.created_at || null,
            changeOrders: 0,
            detailHref: parent?.id ? `/${projectIdNum}/commitments/${parent.id}` : null,
          };
        }),
      ...(purchaseOrdersRes.data ?? [])
        .filter((row) => {
          const parent = Array.isArray(row.purchase_orders)
            ? row.purchase_orders[0]
            : row.purchase_orders;
          return (
            matchesTarget(row.budget_code) &&
            statusMatches(statusFilter, parent?.status ?? null)
          );
        })
        .map((row) => {
          const parent = Array.isArray(row.purchase_orders)
            ? row.purchase_orders[0]
            : row.purchase_orders;

          return {
            id: row.id,
            commitmentNumber: parent?.contract_number || "",
            vendor: null as string | null,
            description: row.description || "",
            amount: Number(row.amount) || 0,
            status: parent?.status || "",
            type: "purchase_order" as const,
            executedDate: parent?.created_at || null,
            changeOrders: 0,
            detailHref: parent?.id ? `/${projectIdNum}/commitments/${parent.id}` : null,
          };
        }),
    ] as Array<{
      id: string;
      commitmentNumber: string;
      vendor: string | null;
      description: string;
      amount: number;
      status: string;
      type: "subcontract" | "purchase_order" | "change_order";
      executedDate: string | null;
      changeOrders: number;
      detailHref: string | null;
    }>;

    // Approved commitment change orders also count towards Committed Costs
    // (see computeBudgetGrandTotals) — include them so the drilldown total
    // reconciles with the column value. Fetch project-scoped parents first so
    // the line query never scans other projects' rows (contract_change_orders
    // has a nullable project_id; null rows are resolved via commitments_unified).
    const { data: parents } = await supabase
      .from("contract_change_orders")
      .select("id, change_order_number, title, status, approved_date, contract_id, project_id")
      .or(`project_id.eq.${projectIdNum},project_id.is.null`)
      .in("status", ["approved", "Approved", "executed", "Executed"]);

    const nullProjectContractIds = Array.from(
      new Set(
        (parents ?? [])
          .filter((parent) => parent.project_id == null)
          .map((parent) => parent.contract_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const projectCommitmentIds = new Set<string>();
    if (nullProjectContractIds.length > 0) {
      const { data: projectCommitments } = await supabase
        .from("commitments_unified")
        .select("id")
        .eq("project_id", projectIdNum)
        .in("id", nullProjectContractIds);
      for (const row of projectCommitments ?? []) {
        if (row.id) projectCommitmentIds.add(row.id);
      }
    }

    const approvedParents = new Map(
      (parents ?? [])
        .filter(
          (parent) =>
            Number(parent.project_id) === projectIdNum ||
            (parent.project_id == null &&
              parent.contract_id != null &&
              projectCommitmentIds.has(parent.contract_id)),
        )
        .map((parent) => [parent.id, parent]),
    );

    if (approvedParents.size > 0) {
      const { data: ccoLines } = await supabase
        .from("commitment_change_order_lines")
        .select("id, cost_code_id, amount, description, commitment_change_order_id")
        .in("commitment_change_order_id", Array.from(approvedParents.keys()));

      for (const line of ccoLines ?? []) {
        if (!matchesTarget(line.cost_code_id)) continue;
        const parent = line.commitment_change_order_id
          ? approvedParents.get(line.commitment_change_order_id)
          : undefined;
        if (!parent) continue;
        commitments.push({
          id: line.id,
          commitmentNumber: parent.change_order_number || "",
          vendor: null,
          description: line.description || parent.title || "Commitment change order",
          amount: Number(line.amount) || 0,
          status: parent.status || "",
          type: "change_order",
          executedDate: parent.approved_date || null,
          changeOrders: 0,
          detailHref: `/${projectIdNum}/change-orders/commitment/${parent.id}`,
        });
      }
    }

    return NextResponse.json({ commitments });
  },
);
