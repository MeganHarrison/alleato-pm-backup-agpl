import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingSetService } from "@/services/DrawingSetService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * PATCH /api/projects/[projectId]/drawing-sets/[setId]
 * Update a drawing set
 */
export const PATCH = withApiGuardrails<{ projectId: string; setId: string }>(
  "projects/[projectId]/drawings/sets/[setId]#PATCH",
  async ({ request, params }) => {
  const { setId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/sets/[setId]#PATCH", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    const service = new DrawingSetService(createServiceClient());
    const result = await service.update(setId, body);

    if (result.error) {
      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to update drawing set",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);

/**
 * POST /api/projects/[projectId]/drawing-sets/[setId]
 * Archive a drawing set (using POST with action parameter)
 */
export const POST = withApiGuardrails<{ projectId: string; setId: string }>(
  "projects/[projectId]/drawings/sets/[setId]#POST",
  async ({ request, params }) => {
  const { setId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/sets/[setId]#POST", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    // Check if action is archive
    if (body.action !== "archive") {
      return NextResponse.json(
        { error: "Invalid action. Only 'archive' action is supported." },
        { status: 400 },
      );
    }

    const service = new DrawingSetService(createServiceClient());
    const result = await service.archive(setId);

    if (result.error) {
      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to archive drawing set",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);
