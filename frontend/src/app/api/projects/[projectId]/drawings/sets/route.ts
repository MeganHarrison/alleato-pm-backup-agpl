import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DrawingSetService } from "@/services/DrawingSetService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/drawing-sets
 * List all drawing sets for a project
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings/sets#GET",
  async ({ request, params }) => {
  const { projectId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/sets#GET", message: "Authentication required." });
  }

  const serviceClient = createServiceClient();
  const service = new DrawingSetService(serviceClient);
  const result = await service.list(projectId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * POST /api/projects/[projectId]/drawing-sets
 * Create a new drawing set
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings/sets#POST",
  async ({ request, params }) => {
  const { projectId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/sets#POST", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.issued_at) {
      return NextResponse.json(
        { error: "Missing required fields: name, issued_at" },
        { status: 400 },
      );
    }

    const serviceClient = createServiceClient();
    const service = new DrawingSetService(serviceClient);
    const result = await service.create(projectId, body, user.id);

    if (result.error) {
      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to create drawing set",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);
