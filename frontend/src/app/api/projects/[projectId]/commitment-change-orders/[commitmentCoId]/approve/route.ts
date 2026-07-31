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
 * POST /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/approve
 * Approve a commitment change order. Updates status and recalculates commitment revised value.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/approve#POST",
  async ({ request, params }) => {
    const { projectId, commitmentCoId } = await params;
    const projectIdNum = Number(projectId);
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where:
          "projects/[projectId]/commitment-change-orders/[commitmentCoId]/approve#POST",
        message: "Authentication required.",
      });
    }

    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const scoped = await getScopedCommitmentChangeOrder(
      supabase,
      projectIdNum,
      commitmentCoId,
    );

    if (!scoped) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (scoped.status === "approved") {
      return NextResponse.json(
        { error: "Already approved" },
        { status: 400 },
      );
    }

    // Approve
    const { data: updated, error: updateError } = await supabase
      .from("contract_change_orders")
      .update({
        status: "approved",
        approved_date: new Date().toISOString().split("T")[0],
        approved_by: user.id,
      })
      .eq("id", commitmentCoId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to approve", details: updateError.message },
        { status: 400 },
      );
    }

    return NextResponse.json(updated);
  },
);
