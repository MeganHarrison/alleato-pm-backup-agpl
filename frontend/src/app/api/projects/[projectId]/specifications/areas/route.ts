import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SpecificationAreaService } from "@/services/SpecificationAreaService";
import {
  specificationAreaSchema,
  type SpecificationAreaFormData,
} from "@/lib/schemas/specification-schemas";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/specifications/areas
 * List all areas for a project
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/specifications/areas#GET",
  async ({ request, params }) => {
  const { projectId } = await params;
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/areas#GET", message: "Authentication required." });
  }

  // Use service role client for data queries (bypasses RLS)
  const serviceClient = createServiceClient();
  const service = new SpecificationAreaService(serviceClient);
  const result = await service.listAreas(projectId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * POST /api/projects/[projectId]/specifications/areas
 * Create a new area
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/specifications/areas#POST",
  async ({ request, params }) => {
  const { projectId } = await params;
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/areas#POST", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    // Validate with Zod
    const validated: SpecificationAreaFormData =
      specificationAreaSchema.parse(body);

    // Use service role client for write operations (bypasses RLS)
    const serviceClient = createServiceClient();
    const service = new SpecificationAreaService(serviceClient);
    const result = await service.createArea(projectId, validated);

    if (result.error) {
      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to create area" }, { status: 500 });
  }
  },
);
