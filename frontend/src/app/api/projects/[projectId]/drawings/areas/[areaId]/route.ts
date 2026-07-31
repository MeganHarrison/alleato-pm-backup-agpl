import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingAreaService } from "@/services/DrawingAreaService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * PATCH /api/projects/[projectId]/drawing-areas/[areaId]
 * Update a drawing area
 */
export const PATCH = withApiGuardrails<{ projectId: string; areaId: string }>(
  "projects/[projectId]/drawings/areas/[areaId]#PATCH",
  async ({ request, params }) => {
  const { areaId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/areas/[areaId]#PATCH", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    const service = new DrawingAreaService(createServiceClient());
    const result = await service.update(areaId, body);

    if (result.error) {
      const statusCode =
        result.error.type === "NOT_FOUND"
          ? 404
          : result.error.type === "INVALID_INPUT"
            ? 400
            : 500;

      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to update drawing area",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);

/**
 * DELETE /api/projects/[projectId]/drawing-areas/[areaId]
 * Delete a drawing area
 */
export const DELETE = withApiGuardrails<{ projectId: string; areaId: string }>(
  "projects/[projectId]/drawings/areas/[areaId]#DELETE",
  async ({ request, params }) => {
  const { areaId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/areas/[areaId]#DELETE", message: "Authentication required." });
  }

  const service = new DrawingAreaService(createServiceClient());
  const result = await service.delete(areaId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data, { status: 200 });
  },
);
