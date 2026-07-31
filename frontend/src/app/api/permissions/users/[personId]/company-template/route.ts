import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import { serviceDb } from "@/lib/supabase/service-db";
import { assignCompanyTemplate, removeCompanyTemplate } from "@/lib/permissions";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ personId: string }>;
}

async function requireAdmin() {
  await requireUserManagementAccess("permissions/users/company-template");
}

const AssignBody = z.object({ template_id: z.string().uuid() });

/**
 * PUT /api/permissions/users/[personId]/company-template
 * Assign (or replace) a company-level template for a person.
 */
export const PUT = withApiGuardrails(
  "permissions/users/[personId]/company-template#PUT",
  async ({ request, params }) => {
    await requireAdmin();
    const { personId } = await params;

    const body = AssignBody.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: "template_id (uuid) is required" }, { status: 400 });
    }

        const { data: template, error: templateError } = await serviceDb.from("permission_templates")
      .select("name, scope")
      .eq("id", body.data.template_id)
      .maybeSingle();

    if (templateError || !template) {
      return NextResponse.json({ error: "Selected permission template no longer exists." }, { status: 404 });
    }

    if (template.scope !== "company") {
      return NextResponse.json({ error: "Company access requires a company permission template." }, { status: 400 });
    }

    const result = await assignCompanyTemplate(personId, body.data.template_id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

    const { data: person, error: personError } = await serviceDb.from("people")
      .select("auth_user_id")
      .eq("id", personId)
      .maybeSingle();

    if (personError) {
      return NextResponse.json({ error: personError.message }, { status: 500 });
    }

    if (person?.auth_user_id) {
      const { error: profileError } = await serviceDb.from("user_profiles")
        .update({ is_admin: template.name === "Admin", updated_at: new Date().toISOString() })
        .eq("id", person.auth_user_id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  },
);

/**
 * DELETE /api/permissions/users/[personId]/company-template
 * Remove company-level template from a person (reverts to project-only access).
 */
export const DELETE = withApiGuardrails(
  "permissions/users/[personId]/company-template#DELETE",
  async ({ params }) => {
    await requireAdmin();
    const { personId } = await params;

    const result = await removeCompanyTemplate(personId);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

        const { data: person, error: personError } = await serviceDb.from("people")
      .select("auth_user_id")
      .eq("id", personId)
      .maybeSingle();

    if (personError) {
      return NextResponse.json({ error: personError.message }, { status: 500 });
    }

    if (person?.auth_user_id) {
      const { error: profileError } = await serviceDb.from("user_profiles")
        .update({ is_admin: false, updated_at: new Date().toISOString() })
        .eq("id", person.auth_user_id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  },
);
