import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const stepSchema = z.object({
  step_type: z.string().min(1),
  required: z.boolean().default(true),
  user_id: z.string().uuid().nullable().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().nullable().optional(),
  steps: z.array(stepSchema).default([]),
});

/**
 * GET /api/projects/[projectId]/submittals/workflow-templates
 * Returns all workflow templates for the project.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/workflow-templates#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/workflow-templates#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("submittal_workflow_templates")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .order("name", { ascending: true });

    if (error) return apiErrorResponse(error);

    return NextResponse.json(data ?? []);
  },
);

/**
 * POST /api/projects/[projectId]/submittals/workflow-templates
 * Creates a new workflow template.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/workflow-templates#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/workflow-templates#POST",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const parsed = createTemplateSchema.parse(body);

    const { data, error } = await supabase
      .from("submittal_workflow_templates")
      .insert({
        project_id: parseInt(projectId, 10),
        name: parsed.name,
        description: parsed.description ?? null,
        steps: parsed.steps,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return apiErrorResponse(error);

    return NextResponse.json(data, { status: 201 });
  },
);
