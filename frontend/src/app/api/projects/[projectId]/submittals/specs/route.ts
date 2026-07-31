import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { listSpecificationLookupOptions } from "@/lib/specifications/compatibility";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

/**
 * GET /api/projects/[projectId]/submittals/specs
 * Returns specification sections for the project ordered by section_number.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/specs#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/specs#GET",
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
