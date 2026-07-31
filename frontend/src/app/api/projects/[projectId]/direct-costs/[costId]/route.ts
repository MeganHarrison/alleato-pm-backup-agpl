import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DirectCostService } from "@/lib/services/direct-cost-service";

export const GET = withApiGuardrails<{ projectId: string; costId: string }>(
  "projects/[projectId]/direct-costs/[costId]#GET",
  async ({ params }) => {
    const { projectId, costId } = await params;

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/direct-costs/[costId]#GET",
        message: "Authentication required.",
      });
    }

    const service = new DirectCostService(supabase);
    const directCost = await service.getById(projectId, costId);

    if (!directCost) {
      return NextResponse.json({ error: "Direct cost not found" }, { status: 404 });
    }

    return NextResponse.json(directCost);
  },
);

export const PUT = withApiGuardrails<{ projectId: string; costId: string }>(
  "projects/[projectId]/direct-costs/[costId]#PUT",
  async ({ request, params }) => {
    void request;
    void params;

    throw new GuardrailError({
      code: "READ_ONLY_RESOURCE",
      where: "projects/[projectId]/direct-costs/[costId]#PUT",
      message: "Direct costs are read-only in Alleato. Sync from Acumatica to update records.",
      status: 405,
      severity: "medium",
    });
  },
);

export const DELETE = withApiGuardrails<{ projectId: string; costId: string }>(
  "projects/[projectId]/direct-costs/[costId]#DELETE",
  async ({ request, params }) => {
    void request;
    void params;

    throw new GuardrailError({
      code: "READ_ONLY_RESOURCE",
      where: "projects/[projectId]/direct-costs/[costId]#DELETE",
      message: "Direct costs are read-only in Alleato. Records cannot be deleted.",
      status: 405,
      severity: "medium",
    });
  },
);
