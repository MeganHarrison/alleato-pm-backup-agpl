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

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  steps: z.array(stepSchema).optional(),
});

/**
 * PUT /api/projects/[projectId]/submittals/workflow-templates/[templateId]
 * Updates an existing workflow template.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/submittals/workflow-templates/[templateId]#PUT",
  async ({ request, params }) => {
    const { projectId, templateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/workflow-templates/[templateId]#PUT",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const parsed = updateTemplateSchema.parse(body);

    const { data, error } = await supabase
      .from("submittal_workflow_templates")
      .update({
        ...parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("project_id", parseInt(projectId, 10))
      .select()
      .single();

    if (error) return apiErrorResponse(error);
    if (!data) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  },
);

/**
 * DELETE /api/projects/[projectId]/submittals/workflow-templates/[templateId]
 * Deletes a workflow template.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/submittals/workflow-templates/[templateId]#DELETE",
  async ({ params }) => {
    const { projectId, templateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/workflow-templates/[templateId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { error } = await supabase
      .from("submittal_workflow_templates")
      .delete()
      .eq("id", templateId)
      .eq("project_id", parseInt(projectId, 10));

    if (error) return apiErrorResponse(error);

    return new NextResponse(null, { status: 204 });
  },
);
