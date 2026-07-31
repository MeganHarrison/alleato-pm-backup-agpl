import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { isPdfPageMarkupData } from "../annotation-contract";

const WHERE_PATCH = "projects/[projectId]/drawings/[drawingId]/annotations/[annotationId]#PATCH";
const WHERE_DELETE = "projects/[projectId]/drawings/[drawingId]/annotations/[annotationId]#DELETE";

/**
 * PATCH /api/projects/[projectId]/drawings/[drawingId]/annotations/[annotationId]
 * Update canonical page-percent geometry or toggle `is_published`.
 * Ownership is verified before the service-role write.
 */
export const PATCH = withApiGuardrails(WHERE_PATCH, async ({ request, params }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE_PATCH, message: "Authentication required." });
  }

  const { projectId, drawingId, annotationId } = await params;
  const body = await request.json();
  const projectIdNumber = Number(projectId);
  if (!Number.isInteger(projectIdNumber) || projectIdNumber <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: WHERE_PATCH, message: "A valid project id is required." });
  }
  const includesData = Object.prototype.hasOwnProperty.call(body ?? {}, "data");
  if (includesData && !isPdfPageMarkupData(body.data)) {
    throw new GuardrailError({
      code: "VALIDATION",
      where: WHERE_PATCH,
      message: "data must use the canonical PDF page-percent coordinate contract.",
    });
  }
  if (!includesData && typeof body?.is_published !== "boolean") {
    throw new GuardrailError({
      code: "VALIDATION",
      where: WHERE_PATCH,
      message: "Provide canonical annotation data or an is_published value.",
    });
  }
  const access = await verifyProjectAccess(projectIdNumber, user);
  if (isAuthError(access)) return access;

  const { data: existing, error: existingError } = await access.serviceClient
    .from("drawing_annotations")
    .select("created_by")
    .eq("id", annotationId)
    .eq("drawing_id", drawingId)
    .eq("project_id", projectIdNumber)
    .maybeSingle();
  if (existingError) return apiErrorResponse(existingError);
  if (!existing) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE_PATCH, message: "Markup was not found." });
  }
  if (existing.created_by !== user.id) {
    throw new GuardrailError({ code: "AUTH_FORBIDDEN", where: WHERE_PATCH, message: "Only the creator can change this markup." });
  }

  const { data, error } = await access.serviceClient
    .from("drawing_annotations")
    .update({
      updated_at: new Date().toISOString(),
      ...(typeof body?.is_published === "boolean" ? { is_published: body.is_published } : {}),
      ...(includesData ? { data: body.data } : {}),
    })
    .eq("id", annotationId)
    // Scope to the URL's drawing for defense-in-depth (RLS still enforces ownership).
    .eq("drawing_id", drawingId)
    .eq("project_id", projectIdNumber)
    .select()
    .single();

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ annotation: data });
});

/**
 * DELETE /api/projects/[projectId]/drawings/[drawingId]/annotations/[annotationId]
 * Remove a drawn annotation. RLS restricts deletion to the annotation's author.
 */
export const DELETE = withApiGuardrails(WHERE_DELETE, async ({ params }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE_DELETE, message: "Authentication required." });
  }

  const { projectId, drawingId, annotationId } = await params;
  const projectIdNumber = Number(projectId);
  if (!Number.isInteger(projectIdNumber) || projectIdNumber <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: WHERE_DELETE, message: "A valid project id is required." });
  }
  const access = await verifyProjectAccess(projectIdNumber, user);
  if (isAuthError(access)) return access;
  const { data: existing, error: existingError } = await access.serviceClient
    .from("drawing_annotations")
    .select("created_by")
    .eq("id", annotationId)
    .eq("drawing_id", drawingId)
    .eq("project_id", projectIdNumber)
    .maybeSingle();
  if (existingError) return apiErrorResponse(existingError);
  if (!existing) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE_DELETE, message: "Markup was not found." });
  }
  if (existing.created_by !== user.id) {
    throw new GuardrailError({ code: "AUTH_FORBIDDEN", where: WHERE_DELETE, message: "Only the creator can remove this markup." });
  }

  const { error } = await access.serviceClient
    .from("drawing_annotations")
    .delete()
    .eq("id", annotationId)
    // Scope the service-role write to the complete URL ownership boundary.
    .eq("drawing_id", drawingId)
    .eq("project_id", projectIdNumber);

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ success: true });
});
