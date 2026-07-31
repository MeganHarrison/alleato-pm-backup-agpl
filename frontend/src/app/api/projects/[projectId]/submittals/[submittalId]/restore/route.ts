import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string }>;
}

/**
 * PATCH /api/projects/[projectId]/submittals/[submittalId]/restore
 * Restores a soft-deleted submittal (clears deleted_at).
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/restore#PATCH",
  async ({ request, params }) => {
  
    const { projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]/restore#PATCH", message: "Authentication required." });
    }

    const { data, error } = await supabase
      .from("submittals")
      .update({
        deleted_at: null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId)
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
    },
);
