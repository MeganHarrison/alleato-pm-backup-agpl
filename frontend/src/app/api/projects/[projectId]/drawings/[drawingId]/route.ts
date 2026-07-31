import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingService } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/drawings/[drawingId]
 * Get a single drawing by ID with full details
 */
export const GET = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]#GET",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]#GET", message: "Authentication required." });
  }

  const service = new DrawingService(createServiceClient());
  const result = await service.getById(projectId, drawingId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * PATCH /api/projects/[projectId]/drawings/[drawingId]
 * Update drawing metadata (not file - use revisions for that)
 */
export const PATCH = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]#PATCH",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]#PATCH", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    const service = new DrawingService(createServiceClient());
    const result = await service.update(projectId, drawingId, body);

    if (result.error) {
      const statusCode =
        result.error.type === "NOT_FOUND"
          ? 404
          : result.error.type === "DUPLICATE_DRAWING_NUMBER"
            ? 409
            : 500;

      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to update drawing",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);

/**
 * DELETE /api/projects/[projectId]/drawings/[drawingId]
 * Delete a drawing and all associated data
 */
export const DELETE = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]#DELETE",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]#DELETE", message: "Authentication required." });
  }

  const service = new DrawingService(createServiceClient());
  const result = await service.delete(projectId, drawingId, user.id);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json({ success: true }, { status: 200 });
  },
);
