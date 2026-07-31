import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; primeCoId: string; lineItemId: string }>;
}

/**
 * PUT /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items/[lineItemId]
 * Update a line item. Recalculates line_amount = quantity * unit_cost.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items/[lineItemId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, primeCoId, lineItemId } = await params;

    const guard = await requirePermission(Number(projectId), "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items/[lineItemId]#PUT", message: "Authentication required." });
    }

    // Verify the PCCO belongs to the requested project
    const { data: pcco, error: pccoError } = await supabase
      .from("prime_contract_change_orders")
      .select("id")
      .eq("id", Number(primeCoId))
      .eq("project_id", Number(projectId))
      .single();

    if (pccoError || !pcco) {
      return NextResponse.json(
        { error: "Change order not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { description, cost_code, quantity, uom, unit_cost } = body as {
      description?: string;
      cost_code?: string;
      quantity?: number;
      uom?: string;
      unit_cost?: number;
    };

    const qty = quantity ?? 0;
    const uc = unit_cost ?? 0;
    // NOTE: line_amount is a GENERATED ALWAYS AS column (quantity * unit_cost).
    // It must NOT be included in the UPDATE — the database recomputes it automatically.

    const { data: lineItem, error } = await supabase
      .from("pcco_line_items")
      .update({
        description: description ?? null,
        cost_code: cost_code ?? null,
        quantity: qty,
        uom: uom ?? null,
        unit_cost: uc,
      })
      .eq("id", Number(lineItemId))
      .eq("pcco_id", Number(primeCoId))
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: lineItem });
    },
);

/**
 * DELETE /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items/[lineItemId]
 * Delete a line item.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items/[lineItemId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, primeCoId, lineItemId } = await params;

    const guard = await requirePermission(Number(projectId), "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items/[lineItemId]#DELETE", message: "Authentication required." });
    }

    // Verify the PCCO belongs to the requested project
    const { data: pcco, error: pccoError } = await supabase
      .from("prime_contract_change_orders")
      .select("id")
      .eq("id", Number(primeCoId))
      .eq("project_id", Number(projectId))
      .single();

    if (pccoError || !pcco) {
      return NextResponse.json(
        { error: "Change order not found" },
        { status: 404 },
      );
    }

    const { error } = await supabase
      .from("pcco_line_items")
      .delete()
      .eq("id", Number(lineItemId))
      .eq("pcco_id", Number(primeCoId));

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
    },
);
