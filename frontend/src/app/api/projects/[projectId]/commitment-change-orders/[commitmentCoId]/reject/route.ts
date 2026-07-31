import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { getScopedCommitmentChangeOrder } from "@/lib/change-orders/commitment-change-orders";

interface RouteParams {
  params: Promise<{ projectId: string; commitmentCoId: string }>;
}

/**
 * POST /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/reject
 * Reject a commitment change order. Requires a rejection_reason in the body.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/reject#POST",
  async ({ request, params }) => {
    const { projectId, commitmentCoId } = await params;
    const projectIdNum = Number(projectId);
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where:
          "projects/[projectId]/commitment-change-orders/[commitmentCoId]/reject#POST",
        message: "Authentication required.",
      });
    }

    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const rejectionReason = body.rejection_reason;

    if (
      !rejectionReason ||
      typeof rejectionReason !== "string" ||
      rejectionReason.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "rejection_reason is required" },
        { status: 400 },
      );
    }

    const scoped = await getScopedCommitmentChangeOrder(
      supabase,
      projectIdNum,
      commitmentCoId,
    );

    if (!scoped) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (scoped.status === "rejected") {
      return NextResponse.json(
        { error: "Already rejected" },
        { status: 400 },
      );
    }

    // Reject
    const { data: updated, error: updateError } = await supabase
      .from("contract_change_orders")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
      })
      .eq("id", commitmentCoId)
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
