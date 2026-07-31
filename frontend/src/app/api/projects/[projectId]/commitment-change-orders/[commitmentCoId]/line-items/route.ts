import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { assertCommitmentChangeOrderLineItemsUnlocked } from "@/lib/change-orders/commitment-change-order-line-item-lock.server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; commitmentCoId: string }>;
}

/**
 * GET /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items
 *
 * Fetch all line items for a commitment change order, ordered by created_at ASC.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items#GET",
  async ({ request, params }) => {

    const { commitmentCoId } = await params;
    if (!UUID_RE.test(commitmentCoId)) {
      return NextResponse.json({ error: "Invalid change order id" }, { status: 400 });
    }

    // Unauthenticated requests must 401 before touching the DB — this route
    // reads budget_lines below, which hard-errors for the anon role.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items#GET", message: "Authentication required." });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("commitment_change_order_lines")
      .select("id, description, amount, cost_code_id, cost_type_id, budget_line_id, created_at")
      .eq("commitment_change_order_id", commitmentCoId)
      .order("created_at", { ascending: true });

    if (error) return apiErrorResponse(error);

    const rows = data ?? [];
    const budgetLineIds = [
      ...new Set(
        rows
          .map((row) => row.budget_line_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const budgetLineById = new Map<
      string,
      { cost_code_id: string; cost_type_id: string }
    >();

    if (budgetLineIds.length > 0) {
      const { data: budgetLines, error: budgetLinesError } = await supabase
        .from("budget_lines")
        .select("id, cost_code_id, cost_type_id")
        .in("id", budgetLineIds);

      if (budgetLinesError) return apiErrorResponse(budgetLinesError);

      for (const budgetLine of budgetLines ?? []) {
        budgetLineById.set(budgetLine.id, {
          cost_code_id: budgetLine.cost_code_id,
          cost_type_id: budgetLine.cost_type_id,
        });
      }
    }

    return NextResponse.json({
      data: rows.map((row) => {
        const budgetLine = row.budget_line_id
          ? budgetLineById.get(row.budget_line_id)
          : null;

        return {
          ...row,
          cost_code_id: row.cost_code_id ?? budgetLine?.cost_code_id ?? null,
          cost_type_id: row.cost_type_id ?? budgetLine?.cost_type_id ?? null,
        };
      }),
    });
    },
);

/**
 * POST /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items
 *
 * Create a new line item on a commitment change order.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items#POST",
  async ({ request, params }) => {
  
    const { projectId, commitmentCoId } = await params;
    const projectIdNum = Number(projectId);

    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const supabase = await createClient();
    await assertCommitmentChangeOrderLineItemsUnlocked(
      supabase,
      projectIdNum,
      commitmentCoId,
      "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items#POST",
    );

    const { data, error } = await supabase
      .from("commitment_change_order_lines")
      .insert({
        commitment_change_order_id: commitmentCoId,
        description: body.description ?? null,
        amount: body.amount ?? 0,
        cost_code_id: body.cost_code_id ?? null,
        cost_type_id: body.cost_type_id ?? null,
      })
      .select("id, description, amount, cost_code_id, cost_type_id, budget_line_id, created_at")
      .single();

    if (error) return apiErrorResponse(error);

    return NextResponse.json({ data }, { status: 201 });
    },
);
