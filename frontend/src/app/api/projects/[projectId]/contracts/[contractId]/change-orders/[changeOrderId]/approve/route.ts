import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
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
 * POST /api/projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]/approve
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]/approve#POST",
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

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]/approve#POST",
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
      .select("id, status, total_amount")
      .eq("id", numericChangeOrderId)
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .single();

    if (changeOrderError || !changeOrder) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const currentStatus = (changeOrder.status ?? "").toLowerCase();
    if (currentStatus === "approved") {
      return NextResponse.json({ error: "Change order is already approved" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("prime_contract_change_orders")
      .update({
        status: "approved",
        approved_at: now,
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

    const { data: approvedOrders, error: approvedOrdersError } = await supabase
      .from("prime_contract_change_orders")
      .select("total_amount")
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .eq("status", "approved");

    if (approvedOrdersError) {
      return NextResponse.json(
        {
          error: "Change order approved but failed to recalculate contract value",
          details: approvedOrdersError.message,
        },
        { status: 400 },
      );
    }

    const approvedTotal = (approvedOrders ?? []).reduce(
      (sum, order) => sum + Number(order.total_amount ?? 0),
      0,
    );

    const { data: primeContract, error: primeContractError } = await supabase
      .from("prime_contracts")
      .select("id, original_contract_value")
      .eq("id", contractId)
      .single();

    if (primeContractError || !primeContract) {
      return NextResponse.json(
        {
          error: "Change order approved but contract financials could not be refreshed",
        },
        { status: 400 },
      );
    }

    const newRevisedValue =
      Number(primeContract.original_contract_value ?? 0) + approvedTotal;

    const { error: contractUpdateError } = await supabase
      .from("prime_contracts")
      .update({ revised_contract_value: newRevisedValue })
      .eq("id", contractId);

    if (contractUpdateError) {
      return NextResponse.json(
        {
          error: "Change order approved but failed to update contract value",
          details: contractUpdateError.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...updated,
      approved_by: user.id,
      approved_date: updated.approved_at,
      amount: Number(updated.total_amount ?? 0),
      contract_updated: true,
      new_contract_value: newRevisedValue,
    });
  },
);
