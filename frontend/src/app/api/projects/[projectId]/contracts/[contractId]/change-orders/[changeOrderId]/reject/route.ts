import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { rejectChangeOrderSchema } from "../../validation";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string; changeOrderId: string }>;
}

// Resolves the legacy route id into the numeric PCCO id used by the revenue-side table.
function parsePrimeChangeOrderId(changeOrderId: string): number | null {
  const numericId = Number(changeOrderId);
  return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
}

/**
 * POST /api/projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]/reject
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]/reject#POST",
  async ({ request, params }) => {
    const { projectId, contractId, changeOrderId } = await params;
    const numericProjectId = Number(projectId);
    const numericChangeOrderId = parsePrimeChangeOrderId(changeOrderId);
    const guard = await requirePermission(numericProjectId, "contracts", "admin");
    if (guard.denied) return guard.response;

    if (!numericChangeOrderId) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const validatedData = rejectChangeOrderSchema.parse(body);

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]/reject#POST",
        message: "Authentication required.",
      });
    }

    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", numericProjectId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const { data: changeOrder, error: changeOrderError } = await supabase
      .from("prime_contract_change_orders")
      .select("id, status")
      .eq("id", numericChangeOrderId)
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .single();

    if (changeOrderError || !changeOrder) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const currentStatus = (changeOrder.status ?? "").toLowerCase();
    if (currentStatus === "rejected") {
      return NextResponse.json({ error: "Change order is already rejected" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("prime_contract_change_orders")
      .update({
        status: "rejected",
        rejection_reason: validatedData.rejection_reason,
        review_date: now,
      })
      .eq("id", numericChangeOrderId)
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .select("*")
      .single();

    if (updateError) {
      return apiErrorResponse(updateError);
    }

    return NextResponse.json({
      ...updated,
      approved_by: user.id,
      approved_date: updated.review_date,
      amount: Number(updated.total_amount ?? 0),
    });
  },
);
