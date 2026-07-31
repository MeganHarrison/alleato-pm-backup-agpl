import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { getNormalizedSubmittalTypeCatalog } from "@/lib/submittals/submittal-type-catalog";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

/**
 * GET /api/projects/[projectId]/submittal-types
 * Compatibility endpoint for submittal type catalogs.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittal-types#GET",
  async () => {
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittal-types#GET",
        message: "Authentication required.",
      });
    }

    try {
      const data = await getNormalizedSubmittalTypeCatalog(supabase as unknown as Parameters<typeof getNormalizedSubmittalTypeCatalog>[0]);
      return NextResponse.json(data ?? []);
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
