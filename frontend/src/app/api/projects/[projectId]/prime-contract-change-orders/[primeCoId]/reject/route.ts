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
 * POST /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/reject
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/reject#POST",
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
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/reject#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const rejectionReason = body.rejection_reason;

    if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length === 0) {
      return NextResponse.json(
        { error: "rejection_reason is required" },
        { status: 400 },
      );
    }

    // Fetch the PCCO
    const { data: co } = await supabase
      .from("prime_contract_change_orders")
      .select("id, status")
      .eq("id", numericId)
      .eq("project_id", Number(projectId))
      .single();

    if (!co) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // --- API-009: Status transition guard ---
    const currentStatus = (co.status ?? "").toLowerCase();
    const rejectableStatuses = ["proposed", "pending", "submitted", "under_review", "revised"];

    if (currentStatus === "rejected") {
      return NextResponse.json(
        { error: "This change order is already rejected." },
        { status: 409 },
      );
    }

    if (currentStatus === "approved") {
      return NextResponse.json(
        { error: "Cannot reject an already approved change order." },
        { status: 409 },
      );
    }

    if (currentStatus === "voided") {
      return NextResponse.json(
        { error: "Cannot reject a voided change order." },
        { status: 409 },
      );
    }

    if (!rejectableStatuses.includes(currentStatus)) {
      return NextResponse.json(
        {
          error: `Cannot reject a change order with status "${currentStatus}". Rejectable statuses: ${rejectableStatuses.join(", ")}.`,
        },
        { status: 409 },
      );
    }

    // Reject
    const { data: updated, error: updateError } = await supabase
      .from("prime_contract_change_orders")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
        review_date: new Date().toISOString(),
      })
      .eq("id", numericId)
      .eq("project_id", Number(projectId))
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to reject", details: updateError.message },
        { status: 400 },
      );
    }

    return NextResponse.json(updated);
    },
);
