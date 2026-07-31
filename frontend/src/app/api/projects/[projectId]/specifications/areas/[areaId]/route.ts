import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { SpecificationAreaService } from "@/services/SpecificationAreaService";
import {
  specificationAreaSchema,
  type SpecificationAreaFormData,
} from "@/lib/schemas/specification-schemas";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/specifications/areas/[areaId]
 * Get a single area with section count
 */
export const GET = withApiGuardrails<{ projectId: string; areaId: string }>(
  "projects/[projectId]/specifications/areas/[areaId]#GET",
  async ({ request, params }) => {
  const { projectId, areaId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/areas/[areaId]#GET", message: "Authentication required." });
  }

  const service = new SpecificationAreaService(supabase);
  const result = await service.getArea(projectId, areaId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * PATCH /api/projects/[projectId]/specifications/areas/[areaId]
 * Update an area
 */
export const PATCH = withApiGuardrails<{ projectId: string; areaId: string }>(
  "projects/[projectId]/specifications/areas/[areaId]#PATCH",
  async ({ request, params }) => {
  const { projectId, areaId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/areas/[areaId]#PATCH", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    // Validate with Zod
    const validated: SpecificationAreaFormData =
      specificationAreaSchema.parse(body);

    const service = new SpecificationAreaService(supabase);
    const result = await service.updateArea(projectId, areaId, validated);

    if (result.error) {
      const statusCode = result.error.type === "NOT_FOUND" ? 404 : 409;
      return apiErrorResponse(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to update area" }, { status: 500 });
  }
  },
);

/**
 * DELETE /api/projects/[projectId]/specifications/areas/[areaId]
 * Delete an area
 */
export const DELETE = withApiGuardrails<{ projectId: string; areaId: string }>(
  "projects/[projectId]/specifications/areas/[areaId]#DELETE",
  async ({ request, params }) => {
  const { projectId, areaId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/areas/[areaId]#DELETE", message: "Authentication required." });
  }

  const service = new SpecificationAreaService(supabase);
  const result = await service.deleteArea(projectId, areaId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json({ success: true }, { status: 200 });
  },
);
