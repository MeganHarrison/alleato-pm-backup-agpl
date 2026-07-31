import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingService } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * PATCH /api/projects/[projectId]/drawings/[drawingId]/publish
 * Publish a drawing (is_published = true)
 */
export const PATCH = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/publish#PATCH",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/publish#PATCH", message: "Authentication required." });
  }

  const projectIdNum = Number(projectId);
  const service = new DrawingService(createServiceClient());
  const result = await service.publish(projectId, drawingId, user.id);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  // Record change history (best-effort — don't fail the request if this errors)
  void Promise.resolve(supabase.from("drawing_change_history").insert({
    drawing_id: drawingId,
    project_id: projectIdNum,
    changed_by: user.id,
    field_name: "is_published",
    old_value: "false",
    new_value: "true",
    change_type: "publish",
  })).catch(() => {}); // fire-and-forget

  return NextResponse.json(result.data);
  },
);

/**
 * DELETE /api/projects/[projectId]/drawings/[drawingId]/publish
 * Unpublish a drawing (is_published = false)
 */
export const DELETE = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/publish#DELETE",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/publish#DELETE", message: "Authentication required." });
  }

  const projectIdNum = Number(projectId);
  const service = new DrawingService(createServiceClient());
  const result = await service.unpublish(projectId, drawingId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  // Record change history (best-effort — don't fail the request if this errors)
  void Promise.resolve(supabase.from("drawing_change_history").insert({
    drawing_id: drawingId,
    project_id: projectIdNum,
    changed_by: user.id,
    field_name: "is_published",
    old_value: "true",
    new_value: "false",
    change_type: "unpublish",
  })).catch(() => {}); // fire-and-forget

  return NextResponse.json(result.data);
  },
);
