import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import {
  getPermissionTemplateById,
  updatePermissionTemplate,
  deletePermissionTemplate,
} from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

async function requireAdmin(): Promise<{ ok: true } | { error: string; status: number }> {
  try {
    await requireUserManagementAccess("permissions/templates/[templateId]");
    return { ok: true };
  } catch (error) {
    const status =
      error instanceof Error && "status" in error && typeof error.status === "number"
        ? error.status
        : 403;
    return { error: status === 401 ? "Unauthorized" : "Forbidden", status };
  }
}

/**
 * GET /api/permissions/templates/[templateId]
 * Load one permission template (admin only)
 */
export const GET = withApiGuardrails(
  "permissions/templates/[templateId]#GET",
  async ({ params }) => {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { templateId } = await params;
    const template = await getPermissionTemplateById(templateId);

    if (!template) {
      return NextResponse.json(
        { error: "Permission template not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: template });
  },
);

/**
 * PUT /api/permissions/templates/[templateId]
 * Update an existing permission template (admin only)
 */
export const PUT = withApiGuardrails(
  "permissions/templates/[templateId]#PUT",
  async ({ request, params }) => {
  
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { templateId } = await params;
    const body = await request.json();
    const { name, description, rules_json, granular_flags } = body;

    const result = await updatePermissionTemplate(templateId, {
      name,
      description,
      rules_json,
      ...(Array.isArray(granular_flags) ? { granular_flags } : {}),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Template update failed." },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: result.data });
    },
);

/**
 * DELETE /api/permissions/templates/[templateId]
 * Delete a permission template (admin only)
 */
export const DELETE = withApiGuardrails(
  "permissions/templates/[templateId]#DELETE",
  async ({ request, params }) => {
  
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { templateId } = await params;
    const result = await deletePermissionTemplate(templateId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
    },
);
