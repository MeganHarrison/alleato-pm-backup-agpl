import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingService } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * PATCH /api/projects/[projectId]/drawings/[drawingId]/obsolete
 * Mark a drawing as obsolete (is_obsolete = true)
 */
export const PATCH = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/obsolete#PATCH",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/obsolete#PATCH", message: "Authentication required." });
  }

  const projectIdNum = Number(projectId);
  const service = new DrawingService(createServiceClient());
  const result = await service.markObsolete(projectId, drawingId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  // Record change history (best-effort — don't fail the request if this errors)
  void Promise.resolve(supabase.from("drawing_change_history").insert({
    drawing_id: drawingId,
    project_id: projectIdNum,
    changed_by: user.id,
    field_name: "is_obsolete",
    old_value: "false",
    new_value: "true",
    change_type: "obsolete",
  })).catch(() => {}); // fire-and-forget

  return NextResponse.json(result.data);
  },
);

/**
 * DELETE /api/projects/[projectId]/drawings/[drawingId]/obsolete
 * Restore a drawing from obsolete (is_obsolete = false)
 */
export const DELETE = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/obsolete#DELETE",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/obsolete#DELETE", message: "Authentication required." });
  }

  const projectIdNum = Number(projectId);
  const service = new DrawingService(createServiceClient());
  const result = await service.restoreObsolete(projectId, drawingId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  // Record change history (best-effort — don't fail the request if this errors)
  void Promise.resolve(supabase.from("drawing_change_history").insert({
    drawing_id: drawingId,
    project_id: projectIdNum,
    changed_by: user.id,
    field_name: "is_obsolete",
    old_value: "true",
    new_value: "false",
    change_type: "restore",
  })).catch(() => {}); // fire-and-forget

  return NextResponse.json(result.data);
  },
);
