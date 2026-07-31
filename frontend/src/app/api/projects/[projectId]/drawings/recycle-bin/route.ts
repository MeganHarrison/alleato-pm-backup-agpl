import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingService } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/drawings/recycle-bin
 * List all soft-deleted drawings for the recycle bin
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings/recycle-bin#GET",
  async ({ request, params }) => {
  const { projectId } = await params;

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/recycle-bin#GET", message: "Authentication required." });
  }

  const service = new DrawingService(createServiceClient());
  const result = await service.listDeleted(projectId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);
