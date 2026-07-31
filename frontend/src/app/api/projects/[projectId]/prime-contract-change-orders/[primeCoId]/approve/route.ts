import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; primeCoId: string }>;
}

/**
 * POST /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/approve
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/approve#POST",
  async ({ request, params }) => {
  
    const { projectId, primeCoId } = await params;
    const numericId = Number(primeCoId);

    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 404 });
    }

    const guard = await requirePermission(Number(projectId), "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/approve#POST", message: "Authentication required." });
    }

    // Fetch the PCCO
    const { data: co } = await supabase
      .from("prime_contract_change_orders")
      .select("id, status, total_amount, contract_id")
      .eq("id", numericId)
      .eq("project_id", Number(projectId))
      .single();

    if (!co) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // --- API-009: Status transition guard ---
    const currentStatus = (co.status ?? "").toLowerCase();
    const approvableStatuses = ["proposed", "pending", "submitted", "under_review", "revised"];

    if (currentStatus === "approved") {
      return NextResponse.json(
        { error: "This change order is already approved." },
        { status: 409 },
      );
    }

    if (currentStatus === "voided") {
      return NextResponse.json(
        { error: "Cannot approve a voided change order." },
        { status: 409 },
      );
    }

    if (!approvableStatuses.includes(currentStatus)) {
      return NextResponse.json(
        {
          error: `Cannot approve a change order with status "${currentStatus}". Approvable statuses: ${approvableStatuses.join(", ")}.`,
        },
        { status: 409 },
      );
    }

    // Approve
    const { data: updated, error: updateError } = await supabase
      .from("prime_contract_change_orders")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        review_date: new Date().toISOString(),
      })
      .eq("id", numericId)
      .eq("project_id", Number(projectId))
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to approve", details: updateError.message },
        { status: 400 },
      );
    }

    // Recalculate contract revised amount if PCCO is linked to a contract
    if (updated.contract_id) {
      const { data: contract } = await supabase
        .from("prime_contracts")
        .select("id, original_contract_value")
        .eq("id", updated.contract_id)
        .single();

      if (contract) {
        const { data: approvedPCCOs } = await supabase
          .from("prime_contract_change_orders")
          .select("total_amount")
          .eq("contract_id", updated.contract_id)
          .eq("status", "approved");

        const approvedTotal = (approvedPCCOs || []).reduce(
          (sum, row) => sum + (row.total_amount ?? 0),
          0,
        );

        const newRevisedAmount =
          (contract.original_contract_value ?? 0) + approvedTotal;

        await supabase
          .from("prime_contracts")
          .update({ revised_contract_value: newRevisedAmount })
          .eq("id", updated.contract_id);
      }
    }

    return NextResponse.json(updated);
    },
);
