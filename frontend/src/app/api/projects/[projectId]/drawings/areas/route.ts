import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingAreaService } from "@/services/DrawingAreaService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/drawing-areas
 * List all drawing areas for a project with counts
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings/areas#GET",
  async ({ request, params }) => {
  const { projectId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/areas#GET", message: "Authentication required." });
  }

  const service = new DrawingAreaService(createServiceClient());
  const result = await service.list(projectId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * POST /api/projects/[projectId]/drawing-areas
 * Create a new drawing area
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings/areas#POST",
  async ({ request, params }) => {
  const { projectId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/areas#POST", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    const service = new DrawingAreaService(createServiceClient());
    const result = await service.create(projectId, body, user.id);

    if (result.error) {
      const statusCode =
        result.error.type === "INVALID_INPUT" ? 400 : 500;

      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to create drawing area",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);
