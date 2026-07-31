import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import {
  createBudgetCodeMatcher,
  resolveBudgetDrilldownTargets,
} from "@/lib/budget/drilldown-matching";

type TypeFilter = "all" | "commitment" | "change_order";

const PENDING_SUBCONTRACT_STATUSES = ["out for signature", "pending"];
const PENDING_PO_STATUSES = ["draft", "sent", "acknowledged"];

type PendingRowsResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

/**
 * GET /api/projects/[projectId]/budget/pending-cost-changes
 * Returns pending commitments and pending commitment CO rows.
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/pending-cost-changes#GET",
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
    const requestedType = (searchParams.get("type") ?? "all") as TypeFilter;
    const typeFilter: TypeFilter =
      requestedType === "commitment" || requestedType === "change_order"
        ? requestedType
        : "all";

    const { costCodeIds: targetCostCodes } = await resolveBudgetDrilldownTargets(
      supabase,
      projectIdNum,
      budgetLineId,
      costCodeParam,
    );
    if (targetCostCodes.length === 0) {
      return NextResponse.json({ changes: [] });
    }

    // Stored budget codes come in mixed formats ("50-5500.S", "505500",
    // project_budget_codes UUIDs) — match by normalized lookup key, never
    // exact string equality.
    const matchesTarget = await createBudgetCodeMatcher(
      supabase,
      projectIdNum,
      targetCostCodes,
    );

    const queries: Array<Promise<PendingRowsResult>> = [];

    if (typeFilter === "all" || typeFilter === "commitment") {
      queries.push(
        (async () => {
          const { data, error } = await supabase
            .from("subcontract_sov_items")
            .select(
              `
              id,
              amount,
              description,
              budget_code,
              subcontract_id,
              subcontracts!inner(
                project_id,
                id,
                status,
                contract_number,
                created_at
              )
            `,
            )
            .eq("subcontracts.project_id", projectIdNum)
            .in("subcontracts.status", PENDING_SUBCONTRACT_STATUSES);

          return {
            data: (data as unknown[] | null) ?? null,
            error: error ? { message: error.message } : null,
          };
        })(),
      );

      queries.push(
        (async () => {
          const { data, error } = await supabase
            .from("purchase_order_sov_items")
            .select(
              `
              id,
              amount,
              description,
              budget_code,
              purchase_order_id,
              purchase_orders!inner(
                project_id,
                id,
                status,
                contract_number,
                created_at
              )
            `,
            )
            .eq("purchase_orders.project_id", projectIdNum)
            .in("purchase_orders.status", PENDING_PO_STATUSES);

          return {
            data: (data as unknown[] | null) ?? null,
            error: error ? { message: error.message } : null,
          };
        })(),
      );
    }

    const results = await Promise.all(queries);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return NextResponse.json(
        { error: "Failed to fetch pending cost changes", details: failed.error.message },
        { status: 500 },
      );
    }

    let index = 0;
    const changes: Array<{
      id: string;
      number: string;
      description: string;
      amount: number;
      status: string;
      type: "commitment" | "commitment_change_order";
      commitmentType?: "subcontract" | "purchase_order";
      requestedDate: string | null;
      detailHref: string | null;
    }> = [];

    if (typeFilter === "all" || typeFilter === "commitment") {
      const subcontractRows = ((results[index++].data ?? []) as Array<Record<string, unknown>>)
        .filter((row) => matchesTarget(row.budget_code as string | null));
      const poRows = ((results[index++].data ?? []) as Array<Record<string, unknown>>)
        .filter((row) => matchesTarget(row.budget_code as string | null));

      for (const row of subcontractRows) {
        const parent = Array.isArray(row.subcontracts)
          ? row.subcontracts[0]
          : row.subcontracts;
        const parentObj = parent as Record<string, unknown> | null;
        const parentId = typeof parentObj?.id === "string" ? parentObj.id : null;
        changes.push({
          id: String(row.id),
          number: String(parentObj?.contract_number ?? ""),
          description: String(row.description ?? ""),
          amount: Number(row.amount) || 0,
          status: String(parentObj?.status ?? "pending"),
          type: "commitment",
          commitmentType: "subcontract",
          requestedDate: (parentObj?.created_at as string | null) ?? null,
          detailHref: parentId ? `/${projectIdNum}/commitments/${parentId}` : null,
        });
      }

      for (const row of poRows) {
        const parent = Array.isArray(row.purchase_orders)
          ? row.purchase_orders[0]
          : row.purchase_orders;
        const parentObj = parent as Record<string, unknown> | null;
        const parentId = typeof parentObj?.id === "string" ? parentObj.id : null;
        changes.push({
          id: String(row.id),
          number: String(parentObj?.contract_number ?? ""),
          description: String(row.description ?? ""),
          amount: Number(row.amount) || 0,
          status: String(parentObj?.status ?? "pending"),
          type: "commitment",
          commitmentType: "purchase_order",
          requestedDate: (parentObj?.created_at as string | null) ?? null,
          detailHref: parentId ? `/${projectIdNum}/commitments/${parentId}` : null,
        });
      }
    }

    if (typeFilter === "all" || typeFilter === "change_order") {
      // Fetch pending CO parents scoped to this project's commitments first,
      // then only their lines — never an unscoped commitment_change_order_lines
      // scan. NOTE: there is no `commitments` table — commitments_unified is
      // the UNION view over subcontracts + purchase_orders.
      const { data: coParents, error: coParentError } = await supabase
        .from("contract_change_orders")
        .select("id, contract_id, change_order_number, status, requested_date, created_at, project_id")
        .or(`project_id.eq.${projectIdNum},project_id.is.null`)
        .like("status", "Pending%");

      if (coParentError) {
        return NextResponse.json(
          { error: "Failed to fetch pending cost changes", details: coParentError.message },
          { status: 500 },
        );
      }

      const nullProjectContractIds = Array.from(
        new Set(
          (coParents ?? [])
            .filter((row) => row.project_id == null)
            .map((row) => row.contract_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );

      const allowedCommitmentIds = new Set<string>();
      if (nullProjectContractIds.length > 0) {
        const { data: commitments, error: commitmentsError } = await supabase
          .from("commitments_unified")
          .select("id")
          .eq("project_id", projectIdNum)
          .in("id", nullProjectContractIds);

        if (commitmentsError) {
          return NextResponse.json(
            {
              error: "Failed to fetch pending cost changes",
              details: commitmentsError.message,
            },
            { status: 500 },
          );
        }

        for (const row of commitments ?? []) {
          if (row.id) allowedCommitmentIds.add(row.id);
        }
      }

      const parentById = new Map(
        (coParents ?? [])
          .filter(
            (row) =>
              Number(row.project_id) === projectIdNum ||
              (row.project_id == null && allowedCommitmentIds.has(row.contract_id)),
          )
          .map((row) => [row.id, row]),
      );

      if (parentById.size > 0) {
        const { data: coLineRows, error: coLineError } = await supabase
          .from("commitment_change_order_lines")
          .select("id, amount, description, cost_code_id, commitment_change_order_id")
          .in("commitment_change_order_id", Array.from(parentById.keys()));

        if (coLineError) {
          return NextResponse.json(
            { error: "Failed to fetch pending cost changes", details: coLineError.message },
            { status: 500 },
          );
        }

        for (const row of coLineRows ?? []) {
          if (!matchesTarget(row.cost_code_id)) continue;
          const parent = parentById.get(row.commitment_change_order_id);
          if (!parent) continue;

          changes.push({
            id: String(row.id),
            number: parent.change_order_number ?? "",
            description: String(row.description ?? ""),
            amount: Number(row.amount) || 0,
            status: parent.status ?? "pending",
            type: "commitment_change_order",
            requestedDate: parent.requested_date ?? parent.created_at ?? null,
            detailHref: `/${projectIdNum}/change-orders/commitment/${parent.id}`,
          });
        }
      }
    }

    return NextResponse.json({ changes });
  },
);
