import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SpecificationRevisionService } from "@/services/SpecificationRevisionService";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/specifications/[sectionId]/revisions/[revisionId]/download
 * Get signed download URL for a revision file
 */
export const GET = withApiGuardrails<{ projectId: string; sectionId: string; revisionId: string }>(
  "projects/[projectId]/specifications/[sectionId]/revisions/[revisionId]/download#GET",
  async ({ request, params }) => {
  const { revisionId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/specifications/[sectionId]/revisions/[revisionId]/download#GET", message: "Authentication required." });
  }

  const service = new SpecificationRevisionService(createServiceClient());
  const result = await service.getDownloadUrl(revisionId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  // Return signed URL
  return NextResponse.json({ url: result.data });
  },
);
