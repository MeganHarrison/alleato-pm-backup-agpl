import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import { serviceDb } from "@/lib/supabase/service-db";

type RouteParams = {
  personId: string;
};

const ProjectAccessBody = z.object({
  project_id: z.coerce.number().int().positive(),
  template_id: z.string().uuid().optional(),
});

const ProjectAccessPostBody = z
  .object({
    project_id: z.coerce.number().int().positive().optional(),
    project_ids: z.array(z.coerce.number().int().positive()).optional(),
    template_id: z.string().uuid(),
  })
  .superRefine((body, context) => {
    if (body.project_id || (body.project_ids && body.project_ids.length > 0)) return;

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one project is required.",
      path: ["project_ids"],
    });
  });

function getProjectIds(body: z.infer<typeof ProjectAccessPostBody>) {
  const projectIds = [...(body.project_ids ?? [])];
  if (body.project_id) projectIds.push(body.project_id);
  return Array.from(new Set(projectIds));
}

async function requireAdmin(where: string) {
  return requireUserManagementAccess(where);
}

async function assertPersonExists(personId: string, where: string) {
    const { data: person, error } = await serviceDb.from("people")
    .select("id")
    .eq("id", personId)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: "Failed to load employee.",
      details: error,
    });
  }

  if (!person) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where,
      message: "Employee not found.",
      status: 404,
    });
  }
}

async function assertProjectTemplate(templateId: string, where: string) {
    const { data: template, error } = await serviceDb.from("permission_templates")
    .select("id, name, scope")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: "Failed to load permission template.",
      details: error,
    });
  }

  if (!template) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Selected permission template no longer exists.",
      status: 400,
    });
  }

  if (template.scope !== "project") {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Project access requires a project permission template.",
      status: 400,
    });
  }

  return template;
}

export const POST = withApiGuardrails<RouteParams>(
  "permissions/users/[personId]/project-access#POST",
  async ({ request, params }) => {
    await requireAdmin("permissions/users/[personId]/project-access#POST");
    const { personId } = params;
    const parsed = ProjectAccessPostBody.safeParse(await request.json());

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/users/[personId]/project-access#POST",
        message: "At least one project and template_id are required.",
        details: parsed.error.issues,
      });
    }

    await assertPersonExists(personId, "permissions/users/[personId]/project-access#POST");
    const template = await assertProjectTemplate(
      parsed.data.template_id,
      "permissions/users/[personId]/project-access#POST",
    );

        const now = new Date().toISOString();
    const memberships = getProjectIds(parsed.data).map((projectId) => ({
      project_id: projectId,
      person_id: personId,
      permission_template_id: parsed.data.template_id,
      role: template.name,
      status: "active",
      user_type: "employee",
      updated_at: now,
    }));

    const { error } = await serviceDb.from("project_directory_memberships")
      .upsert(memberships, { onConflict: "project_id,person_id" });

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]/project-access#POST",
        message: `Could not assign project access: ${error.message}`,
        details: error,
      });
    }

    return NextResponse.json({ success: true, count: memberships.length });
  },
);

export const DELETE = withApiGuardrails<RouteParams>(
  "permissions/users/[personId]/project-access#DELETE",
  async ({ request, params }) => {
    await requireAdmin("permissions/users/[personId]/project-access#DELETE");
    const { personId } = params;
    const parsed = ProjectAccessBody.pick({ project_id: true }).safeParse(await request.json());

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/users/[personId]/project-access#DELETE",
        message: "project_id is required.",
        details: parsed.error.issues,
      });
    }

    await assertPersonExists(personId, "permissions/users/[personId]/project-access#DELETE");

    const { error: membershipError } = await serviceDb.from("project_directory_memberships")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("person_id", personId)
      .eq("project_id", parsed.data.project_id);

    if (membershipError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]/project-access#DELETE",
        message: `Could not remove project access: ${membershipError.message}`,
        details: membershipError,
      });
    }

    const { error: overridesError } = await serviceDb.from("user_granular_permission_overrides")
      .delete()
      .eq("person_id", personId)
      .eq("project_id", parsed.data.project_id);

    if (overridesError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]/project-access#DELETE",
        message: `Could not remove project permission exceptions: ${overridesError.message}`,
        details: overridesError,
      });
    }

    return NextResponse.json({ success: true });
  },
);
