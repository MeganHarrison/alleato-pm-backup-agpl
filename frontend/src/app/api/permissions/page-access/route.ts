import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  PAGE_ACCESS_LEVELS,
  PAGE_ACCESS_MODULES,
  accessLevelRequiresModule,
  type PageAccessLevel,
  type PageAccessPolicy,
} from "@/lib/page-access";
import type { PermissionModule } from "@/lib/permissions-shared";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const PageAccessPolicySchema = z.object({
  route: z.string().trim().min(1).max(500).startsWith("/"),
  accessLevel: z.enum(PAGE_ACCESS_LEVELS as [PageAccessLevel, ...PageAccessLevel[]]),
  permissionModule: z
    .enum(PAGE_ACCESS_MODULES as [PermissionModule, ...PermissionModule[]])
    .nullable()
    .optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const PutSchema = z.object({
  policies: z.array(PageAccessPolicySchema).min(1).max(250),
});

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
      status: 401,
    });
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: `Could not verify admin access: ${error.message}`,
      details: error,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Page access management requires app admin access.",
      status: 403,
    });
  }

  return user;
}

function toPolicy(row: {
  route: string;
  access_level: string;
  permission_module: string | null;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}): PageAccessPolicy {
  return {
    route: row.route,
    accessLevel: row.access_level as PageAccessLevel,
    permissionModule: row.permission_module as PermissionModule | null,
    notes: row.notes,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function normalizePolicy(input: z.infer<typeof PageAccessPolicySchema>) {
  const needsModule = accessLevelRequiresModule(input.accessLevel);

  if (needsModule && !input.permissionModule) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "permissions/page-access#normalizePolicy",
      message: `${input.accessLevel} access requires a permission module for ${input.route}.`,
      status: 400,
    });
  }

  return {
    route: input.route,
    access_level: input.accessLevel,
    permission_module: needsModule ? input.permissionModule ?? null : null,
    notes: input.notes ?? null,
  };
}

export const GET = withApiGuardrails(
  "permissions/page-access#GET",
  async () => {
    await requireAdmin("permissions/page-access#GET");
        const { data, error } = await serviceDb.from("app_page_access_policies")
      .select("route, access_level, permission_module, notes, updated_at, updated_by")
      .order("route", { ascending: true });

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/page-access#GET",
        message: `Failed to load page access policies: ${error.message}`,
        details: error,
      });
    }

    return NextResponse.json({ data: (data ?? []).map(toPolicy) });
  },
);

export const PUT = withApiGuardrails(
  "permissions/page-access#PUT",
  async ({ request }) => {
    const actor = await requireAdmin("permissions/page-access#PUT");
    const parsed = PutSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/page-access#PUT",
        message: "Page access payload is invalid.",
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const rows = parsed.data.policies.map((policy) => ({
      ...normalizePolicy(policy),
      updated_by: actor.id,
    }));

        const { data, error } = await serviceDb.from("app_page_access_policies")
      .upsert(rows, { onConflict: "route" })
      .select("route, access_level, permission_module, notes, updated_at, updated_by");

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/page-access#PUT",
        message: `Failed to save page access policies: ${error.message}`,
        details: error,
      });
    }

    return NextResponse.json({ data: (data ?? []).map(toPolicy) });
  },
);
