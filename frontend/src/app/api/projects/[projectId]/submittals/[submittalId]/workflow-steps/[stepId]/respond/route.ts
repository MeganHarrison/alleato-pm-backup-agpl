import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { z } from "zod";

import {
  recordSubmittalWorkflowResponse,
  submittalWorkflowResponseStatusSchema,
} from "@/lib/submittals/workflow-response-service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string; stepId: string }>;
}

const respondSchema = z.object({
  response_status: submittalWorkflowResponseStatusSchema,
  comments: z.string().nullable().optional(),
});

/**
 * POST /api/projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond
 * Records a response for the current assigned user on a workflow step.
 * Also advances ball_in_court to the next step's first pending user.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond#POST",
  async ({ request, params }) => {
    const { projectId, submittalId, stepId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond#POST",
        message: "Authentication required.",
      });
    }

    const body = await parseJsonBody(
      request,
      respondSchema,
      "projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond#POST",
    );
    const projectIdNumber = Number.parseInt(projectId, 10);
    const serviceClient = createServiceClient();
    const response = await recordSubmittalWorkflowResponse({
      supabase: serviceClient,
      notificationSupabase: serviceClient,
      projectId: projectIdNumber,
      submittalId,
      stepId,
      userId: user.id,
      responseStatus: body.response_status,
      comments: body.comments ?? null,
      where:
        "projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond#POST",
    });

    return Response.json(response);
  },
);
