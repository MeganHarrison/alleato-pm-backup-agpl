import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: {
    projectId: string;
    primeCoId: string;
    relatedItemId: string;
  };
}

export const DELETE = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/related-items/[relatedItemId]#DELETE",
  async ({ params }: RouteParams) => {
    const { projectId, primeCoId, relatedItemId } = params;
    const parsedProjectId = Number.parseInt(projectId, 10);
    const parsedPrimeCoId = Number.parseInt(primeCoId, 10);

    if (Number.isNaN(parsedProjectId) || Number.isNaN(parsedPrimeCoId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const guard = await requirePermission(parsedProjectId, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/related-items/[relatedItemId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { error } = await supabase
      .from("prime_contract_change_order_related_items")
      .delete()
      .eq("id", relatedItemId)
      .eq("project_id", parsedProjectId)
      .eq("prime_co_id", parsedPrimeCoId);

    if (error) {
      return apiErrorResponse(error);
    }

    return new NextResponse(null, { status: 204 });
  },
);
