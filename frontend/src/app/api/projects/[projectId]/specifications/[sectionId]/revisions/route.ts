import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SpecificationRevisionService } from "@/services/SpecificationRevisionService";
import {
  addRevisionSchema,
  type AddRevisionFormData,
} from "@/lib/schemas/specification-schemas";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/specifications/[sectionId]/revisions
 * List all revisions for a specification
 */
export const GET = withApiGuardrails<{ projectId: string; sectionId: string }>(
  "projects/[projectId]/specifications/[sectionId]/revisions#GET",
  async ({ request, params }) => {
  const { projectId, sectionId } = await params;
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/[sectionId]/revisions#GET", message: "Authentication required." });
  }

  // Use service role client for data queries (bypasses RLS)
  const serviceClient = createServiceClient();
  const service = new SpecificationRevisionService(serviceClient);
  const result = await service.listRevisions(projectId, sectionId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * POST /api/projects/[projectId]/specifications/[sectionId]/revisions
 * Add a new revision to a specification
 */
export const POST = withApiGuardrails<{ projectId: string; sectionId: string }>(
  "projects/[projectId]/specifications/[sectionId]/revisions#POST",
  async ({ request, params }) => {
  const { projectId, sectionId } = await params;
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/[sectionId]/revisions#POST", message: "Authentication required." });
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();

    const revisionData: AddRevisionFormData = {
      file: formData.get("file") as File,
      notes: (formData.get("notes") as string) || undefined,
      notify_subscribers: formData.get("notify_subscribers") === "true",
    };

    // Validate with Zod
    const validated = addRevisionSchema.parse(revisionData);

    // Use service role client for write operations (bypasses RLS)
    const serviceClient = createServiceClient();
    const service = new SpecificationRevisionService(serviceClient);
    const result = await service.addRevision(
      projectId,
      sectionId,
      validated,
      user.id,
    );

    if (result.error) {
      const statusCode =
        result.error.type === "FILE_TOO_LARGE" ||
        result.error.type === "INVALID_FILE_TYPE"
          ? 400
          : result.error.type === "NOT_FOUND"
            ? 404
            : 500;

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
    return NextResponse.json({ error: "Failed to add revision" }, { status: 500 });
  }
  },
);
