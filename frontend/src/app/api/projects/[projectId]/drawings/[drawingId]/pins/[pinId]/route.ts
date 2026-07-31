import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

type Params = { params: Promise<{ projectId: string; drawingId: string; pinId: string }> };

/**
 * DELETE /api/projects/[projectId]/drawings/[drawingId]/pins/[pinId]
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/pins/[pinId]#DELETE",
  async ({ request, params }) => {
  const user = await getApiRouteUser();
  if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/pins/[pinId]#DELETE", message: "Authentication required." });

  const { projectId: projectIdParam, drawingId, pinId } = await params;
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: "projects/[projectId]/drawings/[drawingId]/pins/[pinId]#DELETE", message: "A valid project id is required." });
  }
  const access = await verifyProjectAccess(projectId, user);
  if (isAuthError(access)) return access;

  const { data: existing, error: existingError } = await access.serviceClient
    .from("drawing_markup_pins")
    .select("created_by")
    .eq("id", pinId)
    .eq("drawing_id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (existingError) return apiErrorResponse(existingError);
  if (!existing) {
    throw new GuardrailError({ code: "NOT_FOUND", where: "projects/[projectId]/drawings/[drawingId]/pins/[pinId]#DELETE", message: "Drawing link was not found." });
  }
  if (existing.created_by !== user.id) {
    throw new GuardrailError({ code: "AUTH_FORBIDDEN", where: "projects/[projectId]/drawings/[drawingId]/pins/[pinId]#DELETE", message: "Only the creator can remove this drawing link." });
  }

  const { error } = await access.serviceClient
    .from("drawing_markup_pins")
    .delete()
    .eq("id", pinId)
    .eq("drawing_id", drawingId)
    .eq("project_id", projectId);

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ success: true });
  },
);
