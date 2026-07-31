import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingService } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * PATCH /api/projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]
 * Update the revision_number on a drawing revision
 */
export const PATCH = withApiGuardrails<{
      projectId: string;
      drawingId: string;
      revisionId: string;
    }>(
  "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]#PATCH",
  async ({ request, params }) => {
  const { drawingId, revisionId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]#PATCH", message: "Authentication required." });
  }

  try {
    const body = await request.json();
    const { revision_number } = body;

    if (!revision_number || typeof revision_number !== "string" || revision_number.trim() === "") {
      return NextResponse.json(
        { error: "revision_number is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const service = new DrawingService(createServiceClient());
    const result = await service.updateRevisionNumber(
      drawingId,
      revisionId,
      revision_number.trim(),
    );

    if (result.error) {
      const statusCode = result.error.type === "NOT_FOUND" ? 404 : 500;
      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to update revision",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);
