import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string }>;
}

const addStepSchema = z.object({
  user_id: z.string().uuid(),
  step_type: z.string().min(1),
});

const reorderStepsSchema = z.object({
  step_ids: z.array(z.string().uuid()).min(1),
});

/**
 * GET /api/projects/[projectId]/submittals/[submittalId]/workflow-steps
 * Returns all workflow steps for a submittal, with their responses.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/workflow-steps#GET",
  async ({ params }) => {
    const { submittalId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/workflow-steps#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("submittal_workflow_steps")
      .select(`*, submittal_responses(*)`)
      .eq("submittal_id", submittalId)
      .order("step_order", { ascending: true });

    if (error) return apiErrorResponse(error);
    return NextResponse.json(data ?? []);
  },
);

/**
 * POST /api/projects/[projectId]/submittals/[submittalId]/workflow-steps
 * Adds a new workflow step and creates a Pending response row for the user.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/workflow-steps#POST",
  async ({ request, params }) => {
  
    const { projectId: _projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]/workflow-steps#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const { user_id, step_type } = addStepSchema.parse(body);

    // Determine next step_order
    const { data: existingSteps } = await supabase
      .from("submittal_workflow_steps")
      .select("step_order")
      .eq("submittal_id", submittalId)
      .order("step_order", { ascending: false })
      .limit(1);

    const maxOrder = existingSteps?.[0]?.step_order ?? 0;
    const nextOrder = maxOrder + 1;

    // Insert the step
    const { data: step, error: stepError } = await supabase
      .from("submittal_workflow_steps")
      .insert({
        submittal_id: submittalId,
        step_order: nextOrder,
        step_type,
      })
      .select()
      .single();

    if (stepError) {
      return apiErrorResponse(stepError);
    }

    // Insert a Pending response for the user
    const { error: responseError } = await supabase
      .from("submittal_responses")
      .insert({
        submittal_id: submittalId,
        workflow_step_id: step.id,
        responder_id: user_id,
        response_status: "Pending",
      });

    if (responseError) {
      return apiErrorResponse(responseError);
    }

    return NextResponse.json(step, { status: 201 });
    },
);

/**
 * PUT /api/projects/[projectId]/submittals/[submittalId]/workflow-steps
 * Reorders workflow steps based on an ordered step_ids array.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/workflow-steps#PUT",
  async ({ request, params }) => {
    const { submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/workflow-steps#PUT",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const { step_ids } = reorderStepsSchema.parse(body);

    const { data: existingSteps, error: readError } = await supabase
      .from("submittal_workflow_steps")
      .select("id")
      .eq("submittal_id", submittalId);

    if (readError) {
      return apiErrorResponse(readError);
    }

    const existingSet = new Set((existingSteps ?? []).map((s) => s.id));
    const requestedSet = new Set(step_ids);
    if (
      existingSet.size !== requestedSet.size ||
      [...existingSet].some((id) => !requestedSet.has(id))
    ) {
      return NextResponse.json(
        { error: "step_ids must include every workflow step exactly once" },
        { status: 400 },
      );
    }

    for (const [index, stepId] of step_ids.entries()) {
      const { error: updateError } = await supabase
        .from("submittal_workflow_steps")
        .update({ step_order: index + 1 })
        .eq("id", stepId)
        .eq("submittal_id", submittalId);

      if (updateError) {
        return apiErrorResponse(updateError);
      }
    }

    const { data: reordered, error: fetchError } = await supabase
      .from("submittal_workflow_steps")
      .select("id, step_order, step_type")
      .eq("submittal_id", submittalId)
      .order("step_order", { ascending: true });

    if (fetchError) {
      return apiErrorResponse(fetchError);
    }

    return NextResponse.json(reordered ?? []);
  },
);
