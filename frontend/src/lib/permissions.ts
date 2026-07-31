/**
 * Permissions System
 *
 * Utilities for working with the permission system.
 * Permissions flow: app admin > explicit module override > project template > company template > none
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getIsAdmin } from "@/lib/auth/current-user";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  ALL_MODULES,
  reduceGranularPermissionOverrides,
  type PermissionLevel,
  type PermissionModule,
  type GranularFlag,
  type UserPermissions,
  type PermissionTemplate,
} from "@/lib/permissions-shared";

// Re-export shared types + pure helpers for server-side consumers that
// used to import from this module.
export {
  ALL_MODULES,
  ALL_GRANULAR_FLAGS,
  GRANULAR_FLAG_LABELS,
  hasPermission,
  getPermissionLevel,
  hasGranular,
} from "@/lib/permissions-shared";
export type {
  PermissionLevel,
  PermissionModule,
  GranularFlag,
  UserPermissions,
  PermissionTemplate,
} from "@/lib/permissions-shared";

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Load all permission data for the current (or specified) user on a project.
 */
export async function loadUserPermissions(
  projectId: number,
  userId?: string
): Promise<UserPermissions | null> {
  const supabase = await createClient();

  if (!userId) {
    // Use deduplicated getCurrentUser() to avoid a second getUser() call
    const user = await getCurrentUser();
    if (!user) return null;
    userId = user.id;
  }

  return loadUserPermissionsWithClient(supabase, projectId, userId, {
    isAdmin: await getIsAdmin(),
  });
}

/**
 * Load the same permission contract through an injected trusted client.
 * AI tools use a service-role data seam, so relying on request cookies here
 * would turn valid delegated writes into silent permission misses in workers,
 * contract tests, and other non-route runtimes.
 */
export async function loadUserPermissionsWithClient(
  supabase: SupabaseClient<Database>,
  projectId: number,
  userId: string,
  options: { isAdmin?: boolean } = {},
): Promise<UserPermissions | null> {
  const isAdmin =
    options.isAdmin === true || (await loadProfileAdminStatus(supabase, userId));

  const userAuthResult = await supabase
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (userAuthResult.error || !userAuthResult.data) return null;
  const personId = userAuthResult.data.person_id;

  const personResult = await supabase
    .from("people")
    .select("status")
    .eq("id", personId)
    .maybeSingle();

  if (
    personResult.error ||
    !personResult.data ||
    personResult.data.status !== "active"
  ) {
    return null;
  }

  if (isAdmin) {
    return {
      userId: userId!,
      personId,
      projectId,
      overrides: emptyModulePermissions(),
      explicitOverrideModules: [],
      granularOverrides: {},
      isAdmin: true,
    };
  }

  const [membershipResult, overridesResult, granularOverridesResult, companyTemplateResult] = await Promise.all([
    supabase
      .from("project_directory_memberships")
      .select(
        `permission_template_id,
         permission_template:permission_templates (id, name, rules_json, granular_flags)`
      )
      .eq("project_id", projectId)
      .eq("person_id", personId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("user_module_permissions")
      .select("module, level")
      .eq("project_id", projectId)
      .eq("person_id", personId),
    supabase
      .from("user_granular_permission_overrides")
      .select("project_id, flag, effect")
      .eq("person_id", personId)
      .or(`project_id.is.null,project_id.eq.${projectId}`),
    supabase
      .from("person_company_templates")
      .select("template:permission_templates (id, name, rules_json, granular_flags)")
      .eq("person_id", personId)
      .maybeSingle(),
  ]);

  if (
    membershipResult.error ||
    overridesResult.error ||
    granularOverridesResult.error ||
    companyTemplateResult.error
  ) {
    return null;
  }

  const rawProjectTemplate = Array.isArray(membershipResult.data?.permission_template)
    ? membershipResult.data.permission_template[0]
    : membershipResult.data?.permission_template;

  const rawCompanyTemplate = Array.isArray(companyTemplateResult.data?.template)
    ? companyTemplateResult.data.template[0]
    : companyTemplateResult.data?.template;

  // Project template takes precedence over company template
  const rawTemplate = rawProjectTemplate ?? rawCompanyTemplate;

  const template = rawTemplate
    ? {
        id: rawTemplate.id,
        name: rawTemplate.name,
        rules: rawTemplate.rules_json as Record<PermissionModule, PermissionLevel[]>,
        granularFlags: (rawTemplate.granular_flags ?? []) as GranularFlag[],
      }
    : undefined;

  const emptyOverrides = emptyModulePermissions();

  const explicitOverrideModules = (overridesResult.data ?? [])
    .map((row) => row.module as PermissionModule)
    .filter((module) => ALL_MODULES.includes(module));

  const overrides = (overridesResult.data ?? []).reduce((acc, row) => {
    if (ALL_MODULES.includes(row.module as PermissionModule)) {
      acc[row.module as PermissionModule] = row.level as PermissionLevel;
    }
    return acc;
  }, emptyOverrides);

  const granularOverrides = reduceGranularPermissionOverrides(
    granularOverridesResult.data ?? [],
  );

  return {
    userId: userId!,
    personId,
    projectId,
    template,
    overrides,
    explicitOverrideModules,
    granularOverrides,
    isAdmin,
  };
}

function emptyModulePermissions(): Record<PermissionModule, PermissionLevel> {
  return Object.fromEntries(
    ALL_MODULES.map((m) => [m, "none" as PermissionLevel])
  ) as Record<PermissionModule, PermissionLevel>;
}

async function loadProfileAdminStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  return data?.is_admin === true;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type PermissionTemplateDbRow = {
  id: string;
  name: string;
  description: string | null;
  rules_json: unknown;
  granular_flags: string[] | null;
  is_system: boolean | null;
  scope: string | null;
};

function parsePermissionTemplate(row: PermissionTemplateDbRow): PermissionTemplate {
  // Json column → narrow to PermissionTemplate.rules_json shape. The DB
  // schema doesn't constrain this, so we coerce defensively. Bad shapes will
  // produce permission misses (deny-by-default) rather than crashes.
  const rules = (row.rules_json && typeof row.rules_json === "object"
    ? row.rules_json
    : {}) as Record<PermissionModule, PermissionLevel[]>;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    rules_json: rules,
    granular_flags: (row.granular_flags ?? []) as GranularFlag[],
    is_system: row.is_system ?? false,
    scope: row.scope ?? undefined,
  };
}

export async function getPermissionTemplates(
  scope?: "project" | "company" | "global",
): Promise<PermissionTemplate[]> {
  const supabase = await createClient();

  let query = supabase
    .from("permission_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");

  if (scope) {
    query = query.eq("scope", scope);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading permission templates:", error);
    return [];
  }

  return (data ?? []).map(parsePermissionTemplate);
}

export async function getPermissionTemplateById(
  templateId: string,
): Promise<PermissionTemplate | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("permission_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    console.error("Error loading permission template:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return parsePermissionTemplate(data as PermissionTemplateDbRow);
}

export async function createPermissionTemplate(
  template: Omit<PermissionTemplate, "id">
): Promise<{ data?: PermissionTemplate; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("permission_templates")
    .insert({
      name: template.name,
      description: template.description,
      scope: template.scope ?? "project",
      is_system: false,
      rules_json: template.rules_json,
      granular_flags: template.granular_flags ?? [],
    })
    .select()
    .single();

  if (error) return { error: error.message };
  if (!data) return { error: "Insert returned no row" };
  return { data: parsePermissionTemplate(data as PermissionTemplateDbRow) };
}

export async function updatePermissionTemplate(
  templateId: string,
  updates: Partial<Omit<PermissionTemplate, "id" | "is_system">>
): Promise<{ success: boolean; data?: PermissionTemplate; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("permission_templates")
    .update(updates)
    .eq("id", templateId)
    .eq("is_system", false)
    .select();

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      success: false,
      error:
        "This template could not be updated. System templates are read only.",
    };
  }
  return {
    success: true,
    data: parsePermissionTemplate(data[0] as PermissionTemplateDbRow),
  };
}

export async function deletePermissionTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("permission_templates")
    .delete()
    .eq("id", templateId)
    .eq("is_system", false);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Template assignment
// ---------------------------------------------------------------------------

export async function assignPermissionTemplate(
  projectId: number,
  personId: string,
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: template, error: templateError } = await supabase
    .from("permission_templates")
    .select("scope")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) return { success: false, error: templateError.message };
  if (!template) return { success: false, error: "Selected permission template no longer exists." };
  if (template.scope !== "project") {
    return { success: false, error: "Project access requires a project permission template." };
  }

  const { error } = await supabase
    .from("project_directory_memberships")
    .update({
      permission_template_id: templateId,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .eq("person_id", personId);

  if (error) return { success: false, error: error.message };

  await logPermissionChange(supabase, {
    project_id: projectId,
    person_id: personId,
    changed_by: user?.id,
    action: "assign_template",
    template_id: templateId,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Module overrides
// ---------------------------------------------------------------------------

/**
 * Set an explicit per-module permission override for a user.
 * Works for ALL modules via user_module_permissions table.
 */
export async function setPermissionOverride(
  projectId: number,
  personId: string,
  module: PermissionModule,
  level: PermissionLevel
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("user_module_permissions")
    .select("level")
    .eq("project_id", projectId)
    .eq("person_id", personId)
    .eq("module", module)
    .maybeSingle();

  const { error } = await supabase
    .from("user_module_permissions")
    .upsert(
      {
        project_id: projectId,
        person_id: personId,
        module,
        level,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,person_id,module" }
    );

  if (error) return { success: false, error: error.message };

  await logPermissionChange(supabase, {
    project_id: projectId,
    person_id: personId,
    changed_by: user?.id,
    action: "set_override",
    module,
    old_level: existing?.level,
    new_level: level,
  });

  return { success: true };
}

/**
 * Remove an explicit per-module permission override (falls back to template).
 */
export async function removePermissionOverride(
  projectId: number,
  personId: string,
  module: PermissionModule
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("user_module_permissions")
    .select("level")
    .eq("project_id", projectId)
    .eq("person_id", personId)
    .eq("module", module)
    .maybeSingle();

  const { error } = await supabase
    .from("user_module_permissions")
    .delete()
    .eq("project_id", projectId)
    .eq("person_id", personId)
    .eq("module", module);

  if (error) return { success: false, error: error.message };

  if (existing) {
    await logPermissionChange(supabase, {
      project_id: projectId,
      person_id: personId,
      changed_by: user?.id,
      action: "remove_override",
      module,
      old_level: existing.level,
    });
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Company template (auto-all-projects access)
// ---------------------------------------------------------------------------

export async function assignCompanyTemplate(
  personId: string,
  templateId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("person_company_templates")
    .upsert(
      { person_id: personId, template_id: templateId, assigned_by: user?.id, assigned_at: new Date().toISOString() },
      { onConflict: "person_id" },
    );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function removeCompanyTemplate(
  personId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("person_company_templates")
    .delete()
    .eq("person_id", personId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function logPermissionChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: {
    project_id: number;
    person_id: string;
    changed_by?: string;
    action: string;
    module?: string;
    old_level?: string;
    new_level?: string;
    template_id?: string;
  }
): Promise<void> {
  await supabase.from("permission_audit_log").insert(entry);
}

export async function getPermissionAuditLog(
  projectId: number,
  limit = 50
): Promise<
  Array<{
    id: string;
    action: string;
    module: string | null;
    old_level: string | null;
    new_level: string | null;
    created_at: string;
    person: { first_name: string; last_name: string; email: string } | null;
    template: { name: string } | null;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("permission_audit_log")
    .select(
      `id, action, module, old_level, new_level, created_at,
       person:people (first_name, last_name, email),
       template:permission_templates (name)`
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error loading audit log:", error);
    return [];
  }

  return (data ?? []) as unknown as Array<{
    id: string;
    action: string;
    module: string | null;
    old_level: string | null;
    new_level: string | null;
    created_at: string;
    person: { first_name: string; last_name: string; email: string } | null;
    template: { name: string } | null;
  }>;
}
