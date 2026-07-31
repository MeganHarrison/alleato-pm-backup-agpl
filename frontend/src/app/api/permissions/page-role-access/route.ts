import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminDashboardApiAccess } from "@/lib/auth/admin-dashboard";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type {
  PageRoleAccessMode,
  PageRoleAccessPolicy,
} from "@/lib/page-role-access";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";

const PageRoleAccessPolicySchema = z.object({
  route: z.string().trim().min(1).max(500).startsWith("/"),
  mode: z.enum(["inherit_requirement", "explicit_allowlist"]),
  allowedPermissionTemplateIds: z.array(z.string().uuid()).max(100),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const PutSchema = z.object({
  policies: z.array(PageRoleAccessPolicySchema).min(1).max(250),
});

type PolicyRow = {
  route: string;
  enforcement_mode: string;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type TemplateRow = {
  route: string;
  permission_template_id: string;
};

function toPolicy(
  row: PolicyRow,
  allowedIdsByRoute: Map<string, string[]>,
): PageRoleAccessPolicy {
  return {
    route: row.route,
    mode: row.enforcement_mode as PageRoleAccessMode,
    allowedPermissionTemplateIds: allowedIdsByRoute.get(row.route) ?? [],
    notes: row.notes,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function assertTemplatesExist(templateIds: string[]) {
  if (templateIds.length === 0) return;

    const { data, error } = await serviceDb.from("permission_templates")
    .select("id")
    .in("id", [...new Set(templateIds)]);

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "permissions/page-role-access#assertTemplatesExist",
      message: `Could not validate permission templates: ${error.message}`,
      details: error,
    });
  }

  const found = new Set((data ?? []).map((row) => row.id));
  const missing = templateIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "permissions/page-role-access#assertTemplatesExist",
      message: "Page role policy references unknown permission templates.",
      status: 400,
      details: { missingTemplateIds: missing },
    });
  }
}

async function loadPolicies(): Promise<PageRoleAccessPolicy[]> {
    const [policyResult, templateResult] = await Promise.all([
    serviceDb.from("app_page_role_access_policies")
      .select("route, enforcement_mode, notes, updated_at, updated_by")
      .order("route", { ascending: true }),
    serviceDb.from("app_page_role_access_policy_templates")
      .select("route, permission_template_id")
      .order("route", { ascending: true }),
  ]);

  if (policyResult.error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "permissions/page-role-access#loadPolicies",
      message: `Failed to load page role policies: ${policyResult.error.message}`,
      details: policyResult.error,
    });
  }

  if (templateResult.error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "permissions/page-role-access#loadPolicyTemplates",
      message: `Failed to load page role template assignments: ${templateResult.error.message}`,
      details: templateResult.error,
    });
  }

  const allowedIdsByRoute = new Map<string, string[]>();
  for (const row of (templateResult.data ?? []) as TemplateRow[]) {
    allowedIdsByRoute.set(row.route, [
      ...(allowedIdsByRoute.get(row.route) ?? []),
      row.permission_template_id,
    ]);
  }

  return ((policyResult.data ?? []) as PolicyRow[]).map((row) =>
    toPolicy(row, allowedIdsByRoute),
  );
}

export const GET = withApiGuardrails(
  "permissions/page-role-access#GET",
  async () => {
    await requireAdminDashboardApiAccess("permissions/page-role-access#GET");
    return NextResponse.json({ data: await loadPolicies() });
  },
);

export const PUT = withApiGuardrails(
  "permissions/page-role-access#PUT",
  async ({ request }) => {
    await requireAdminDashboardApiAccess("permissions/page-role-access#PUT");
    const actor = await getApiRouteUser();
    const parsed = PutSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/page-role-access#PUT",
        message: "Page role access payload is invalid.",
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const requestedTemplateIds = parsed.data.policies.flatMap(
      (policy) => policy.allowedPermissionTemplateIds,
    );
    await assertTemplatesExist(requestedTemplateIds);

        const policyRows = parsed.data.policies.map((policy) => ({
      route: policy.route,
      enforcement_mode: policy.mode,
      notes: policy.notes ?? null,
      updated_by: actor?.id ?? null,
    }));

    const { error: policyError } = await serviceDb.from("app_page_role_access_policies")
      .upsert(policyRows, { onConflict: "route" });

    if (policyError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/page-role-access#PUT",
        message: `Failed to save page role policies: ${policyError.message}`,
        details: policyError,
      });
    }

    const routes = parsed.data.policies.map((policy) => policy.route);
    const { error: deleteError } = await serviceDb.from("app_page_role_access_policy_templates")
      .delete()
      .in("route", routes);

    if (deleteError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/page-role-access#PUT.deleteTemplates",
        message: `Failed to replace page role assignments: ${deleteError.message}`,
        details: deleteError,
      });
    }

    const assignmentRows = parsed.data.policies.flatMap((policy) =>
      policy.mode === "explicit_allowlist"
        ? [...new Set(policy.allowedPermissionTemplateIds)].map(
            (templateId) => ({
              route: policy.route,
              permission_template_id: templateId,
              updated_by: actor?.id ?? null,
            }),
          )
        : [],
    );

    if (assignmentRows.length > 0) {
      const { error: insertError } = await serviceDb.from("app_page_role_access_policy_templates")
        .insert(assignmentRows);

      if (insertError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/page-role-access#PUT.insertTemplates",
          message: `Failed to save page role assignments: ${insertError.message}`,
          details: insertError,
        });
      }
    }

    return NextResponse.json({ data: await loadPolicies() });
  },
);
