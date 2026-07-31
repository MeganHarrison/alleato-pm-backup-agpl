import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string; stepId: string }>;
}

/**
 * DELETE /api/projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]
 * Removes a workflow step and its associated responses.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]#DELETE",
  async ({ request, params }) => {
  
    const { submittalId, stepId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]#DELETE", message: "Authentication required." });
    }

    // Delete associated responses first
    await supabase
      .from("submittal_responses")
      .delete()
      .eq("workflow_step_id", stepId);

    // Delete the step
    const { error: deleteError } = await supabase
      .from("submittal_workflow_steps")
      .delete()
      .eq("id", stepId)
      .eq("submittal_id", submittalId);

    if (deleteError) {
      return apiErrorResponse(deleteError);
    }

    return NextResponse.json({ success: true });
    },
);
