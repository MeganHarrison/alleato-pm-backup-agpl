import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  getPermissionTemplates,
  createPermissionTemplate,
} from "@/lib/permissions";

async function ensureSeniorProjectManagerRole() {
    const { data: existing, error: existingError } = await serviceDb.from("permission_templates")
    .select("id")
    .eq("name", "Senior Project Manager")
    .eq("scope", "company")
    .maybeSingle();

  if (existingError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "permissions/templates#ensureSeniorProjectManagerRole",
      message: `Could not check Senior Project Manager role: ${existingError.message}`,
    });
  }

  if (existing) return;

  const { error: insertError } = await serviceDb.from("permission_templates").insert({
    name: "Senior Project Manager",
    description:
      "All-project access for senior PMs who should inherit project-manager permissions across current and future projects.",
    scope: "company",
    is_system: true,
    rules_json: {
      directory: ["read", "write"],
      budget: ["read", "write", "admin"],
      contracts: ["read", "write", "admin"],
      commitments: ["read", "write", "admin"],
      estimates: ["read", "write", "admin"],
      documents: ["read", "write"],
      schedule: ["read", "write", "admin"],
      submittals: ["read", "write", "admin"],
      rfis: ["read", "write", "admin"],
      change_orders: ["read", "write", "admin"],
      change_events: ["read", "write", "admin"],
      emails: ["read", "write"],
    },
    granular_flags: [
      "view_private_commitments",
      "bulk_edit_subcontractor_invoice_status",
      "approve_change_orders",
      "approve_budget_changes",
      "approve_invoices",
      "create_change_events",
      "create_budget_modifications",
      "manage_project_directory",
    ],
  });

  if (insertError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "permissions/templates#ensureSeniorProjectManagerRole",
      message: `Could not create Senior Project Manager role: ${insertError.message}`,
    });
  }
}

/**
 * GET /api/permissions/templates
 * Get all available permission templates
 */
export const GET = withApiGuardrails(
  "permissions/templates#GET",
  async ({ request }) => {

    const scopeParam = request.nextUrl.searchParams.get("scope");
    const scope =
      scopeParam === "project" || scopeParam === "company" || scopeParam === "global"
        ? scopeParam
        : undefined;

    if (!scope || scope === "company") {
      await ensureSeniorProjectManagerRole();
    }

    const templates = await getPermissionTemplates(scope);
    return NextResponse.json({ data: templates });
    },
);

/**
 * POST /api/permissions/templates
 * Create a new permission template (admin only)
 */
export const POST = withApiGuardrails(
  "permissions/templates#POST",
  async ({ request }) => {
    await requireUserManagementAccess("permissions/templates#POST");

    const body = await request.json();
    const { name, description, rules_json, granular_flags, scope } = body;

    if (!name || !rules_json) {
      return NextResponse.json(
        { error: "name and rules_json are required" },
        { status: 400 }
      );
    }

    const normalizedScope =
      scope === "company" || scope === "project" || scope === "global"
        ? scope
        : "project";

    const result = await createPermissionTemplate({
      name,
      description,
      rules_json,
      granular_flags: Array.isArray(granular_flags) ? granular_flags : [],
      scope: normalizedScope,
      is_system: false,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
    },
);
