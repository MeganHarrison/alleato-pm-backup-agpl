import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import {
  ANNOTATION_TYPES,
  isAnnotationType,
  isPdfPageMarkupData,
} from "./annotation-contract";

const WHERE_GET = "projects/[projectId]/drawings/[drawingId]/annotations#GET";
const WHERE_POST = "projects/[projectId]/drawings/[drawingId]/annotations#POST";

/**
 * GET /api/projects/[projectId]/drawings/[drawingId]/annotations
 * List drawn markup for a drawing. RLS returns published markup plus the
 * caller's own personal (unpublished) markup.
 */
export const GET = withApiGuardrails(WHERE_GET, async ({ params }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE_GET, message: "Authentication required." });
  }

  const { projectId: projectIdParam, drawingId } = await params;
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: WHERE_GET, message: "A valid project id is required." });
  }
  const access = await verifyProjectAccess(projectId, user);
  if (isAuthError(access)) return access;

  const { data, error } = await access.serviceClient
    .from("drawing_annotations")
    .select("*")
    .eq("drawing_id", drawingId)
    .eq("project_id", projectId)
    .or(`is_published.eq.true,created_by.eq.${user.id}`)
    .order("created_at", { ascending: true });

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ annotations: data ?? [] });
});

/**
 * POST /api/projects/[projectId]/drawings/[drawingId]/annotations
 * Persist one drawn shape.
 * Body: { annotation_type, page?, data, is_published? }
 */
export const POST = withApiGuardrails(WHERE_POST, async ({ request, params }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE_POST, message: "Authentication required." });
  }

  const { projectId, drawingId } = await params;
  const body = await request.json();

  if (!isAnnotationType(body?.annotation_type)) {
    throw new GuardrailError({
      code: "VALIDATION",
      where: WHERE_POST,
      message: `annotation_type must be one of: ${ANNOTATION_TYPES.join(", ")}.`,
    });
  }
  if (!isPdfPageMarkupData(body?.data)) {
    throw new GuardrailError({
      code: "VALIDATION",
      where: WHERE_POST,
      message: "data must use the canonical PDF page-percent coordinate contract.",
    });
  }

  const projectIdNumber = Number(projectId);
  if (!Number.isInteger(projectIdNumber) || projectIdNumber <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: WHERE_POST, message: "A valid project id is required." });
  }
  const access = await verifyProjectAccess(projectIdNumber, user);
  if (isAuthError(access)) return access;

  const { data, error } = await access.serviceClient
    .from("drawing_annotations")
    .insert({
      drawing_id: drawingId,
      project_id: projectIdNumber,
      page: Number.isFinite(body.page) ? Number(body.page) : 1,
      annotation_type: body.annotation_type,
      data: body.data,
      is_published: body.is_published === true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ annotation: data }, { status: 201 });
});
