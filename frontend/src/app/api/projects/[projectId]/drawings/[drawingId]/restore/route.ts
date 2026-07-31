import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingService } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * PATCH /api/projects/[projectId]/drawings/[drawingId]/restore
 * Restore a soft-deleted drawing from the recycle bin
 */
export const PATCH = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/restore#PATCH",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/restore#PATCH", message: "Authentication required." });
  }

  const service = new DrawingService(createServiceClient());
  const result = await service.restore(projectId, drawingId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json({ success: true });
  },
);

/**
 * DELETE /api/projects/[projectId]/drawings/[drawingId]/restore
 * Permanently delete a drawing (from recycle bin only)
 */
export const DELETE = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/restore#DELETE",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/restore#DELETE", message: "Authentication required." });
  }

  const service = new DrawingService(createServiceClient());
  const result = await service.permanentDelete(projectId, drawingId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json({ success: true });
  },
);
