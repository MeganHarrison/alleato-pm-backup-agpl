import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { listSpecificationLookupOptions } from "@/lib/specifications/compatibility";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

/**
 * GET /api/projects/[projectId]/submittal-spec-sections
 * Compatibility endpoint for specification section lookups.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittal-spec-sections#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittal-spec-sections#GET",
        message: "Authentication required.",
      });
    }

    try {
      const data = await listSpecificationLookupOptions(
        supabase,
        parseInt(projectId, 10),
      );

      return NextResponse.json(data);
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
