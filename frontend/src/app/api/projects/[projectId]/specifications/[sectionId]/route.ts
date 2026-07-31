import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SpecificationService } from "@/services/SpecificationService";
import {
  editSpecificationSchema,
  type EditSpecificationFormData,
} from "@/lib/schemas/specification-schemas";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/specifications/[sectionId]
 * Get a single specification with full details
 */
export const GET = withApiGuardrails<{ projectId: string; sectionId: string }>(
  "projects/[projectId]/specifications/[sectionId]#GET",
  async ({ request, params }) => {
  const { projectId, sectionId } = await params;
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/[sectionId]#GET", message: "Authentication required." });
  }

  // Use service role client for data queries (bypasses RLS)
  const serviceClient = createServiceClient();
  const service = new SpecificationService(serviceClient);
  const result = await service.getById(projectId, sectionId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * PATCH /api/projects/[projectId]/specifications/[sectionId]
 * Update specification metadata (not file)
 */
export const PATCH = withApiGuardrails<{ projectId: string; sectionId: string }>(
  "projects/[projectId]/specifications/[sectionId]#PATCH",
  async ({ request, params }) => {
  const { projectId, sectionId } = await params;
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/[sectionId]#PATCH", message: "Authentication required." });
  }

  try {
    const body = await request.json();

    // Validate with Zod
    const validated: EditSpecificationFormData =
      editSpecificationSchema.parse(body);

    // Use service role client for write operations (bypasses RLS)
    const serviceClient = createServiceClient();
    const service = new SpecificationService(serviceClient);
    const result = await service.update(projectId, sectionId, validated, user.id);

    if (result.error) {
      const statusCode =
        result.error.type === "NOT_FOUND"
          ? 404
          : result.error.type === "DUPLICATE_SECTION_NUMBER"
            ? 409
            : 500;

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
    return NextResponse.json(
      { error: "Failed to update specification" },
      { status: 500 },
    );
  }
  },
);

/**
 * DELETE /api/projects/[projectId]/specifications/[sectionId]
 * Delete a specification and all associated data
 */
export const DELETE = withApiGuardrails<{ projectId: string; sectionId: string }>(
  "projects/[projectId]/specifications/[sectionId]#DELETE",
  async ({ request, params }) => {
  const { projectId, sectionId } = await params;
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/[sectionId]#DELETE", message: "Authentication required." });
  }

  // Use service role client for write operations (bypasses RLS)
  const serviceClient = createServiceClient();
  const service = new SpecificationService(serviceClient);
  const result = await service.delete(projectId, sectionId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json({ success: true }, { status: 200 });
  },
);
