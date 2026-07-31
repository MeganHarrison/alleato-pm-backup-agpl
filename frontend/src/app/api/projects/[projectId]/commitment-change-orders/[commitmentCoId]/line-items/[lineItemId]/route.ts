import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";

import { assertCommitmentChangeOrderLineItemsUnlocked } from "@/lib/change-orders/commitment-change-order-line-item-lock.server";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; commitmentCoId: string; lineItemId: string }>;
}

/**
 * PUT /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]
 *
 * Update an existing line item.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, commitmentCoId, lineItemId } = await params;
    const projectIdNum = Number(projectId);

    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const supabase = await createClient();
    await assertCommitmentChangeOrderLineItemsUnlocked(
      supabase,
      projectIdNum,
      commitmentCoId,
      "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]#PUT",
    );

    const { data, error } = await supabase
      .from("commitment_change_order_lines")
      .update({
        description: body.description ?? null,
        amount: body.amount ?? 0,
        cost_code_id: body.cost_code_id ?? null,
        cost_type_id: body.cost_type_id ?? null,
      })
      .eq("id", lineItemId)
      .eq("commitment_change_order_id", commitmentCoId)
      .select("id, description, amount, cost_code_id, cost_type_id, budget_line_id, created_at")
      .single();

    if (error) return apiErrorResponse(error);

    return NextResponse.json({ data });
    },
);

/**
 * DELETE /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]
 *
 * Delete a line item.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, commitmentCoId, lineItemId } = await params;
    const projectIdNum = Number(projectId);

    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    await assertCommitmentChangeOrderLineItemsUnlocked(
      supabase,
      projectIdNum,
      commitmentCoId,
      "projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]#DELETE",
    );

    const { error } = await supabase
      .from("commitment_change_order_lines")
      .delete()
      .eq("id", lineItemId)
      .eq("commitment_change_order_id", commitmentCoId);

    if (error) return apiErrorResponse(error);

    return NextResponse.json({ success: true });
    },
);
