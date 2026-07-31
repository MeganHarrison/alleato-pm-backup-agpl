import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type ProjectAccessClient = Pick<SupabaseClient<Database>, "from">;

export type ProjectAccessDecision =
  | {
      authorized: true;
      accessSource: "directory" | "project-role" | "company-template";
      membershipId: string;
      permissionTemplateId: string | null;
      userType: string | null;
    }
  | {
      authorized: false;
      reason: "no-project-access" | "project-access-query-failed";
      error?: string;
    };

export async function resolveCompanyTemplateIdForPerson(
  client: ProjectAccessClient,
  personId: string,
): Promise<{ templateId: string | null; error: string | null }> {
  const result = await client
    .from("person_company_templates")
    .select("template_id, template:permission_templates!inner(scope)")
    .eq("person_id", personId)
    .eq("template.scope", "company")
    .maybeSingle();

  return {
    templateId: result.data?.template_id ?? null,
    error: result.error?.message ?? null,
  };
}

/**
 * Resolves the canonical project-access contract for an active person.
 *
 * A person can reach a project through an active directory membership, a
 * project-team role, or a company-wide permission template. A direct project
 * template always overrides the company template for that project.
 */
export async function resolveProjectAccessForPerson(
  client: ProjectAccessClient,
  personId: string,
  projectId: number,
): Promise<ProjectAccessDecision> {
  const activePersonResult = await client
    .from("people")
    .select("id")
    .eq("id", personId)
    .eq("status", "active")
    .maybeSingle();

  if (activePersonResult.error) {
    return {
      authorized: false,
      reason: "project-access-query-failed",
      error: activePersonResult.error.message,
    };
  }

  if (!activePersonResult.data) {
    return { authorized: false, reason: "no-project-access" };
  }

  const [membershipResult, roleMembershipResult, companyTemplateResult] =
    await Promise.all([
      client
        .from("project_directory_memberships")
        .select("id, permission_template_id, user_type")
        .eq("person_id", personId)
        .eq("project_id", projectId)
        .eq("status", "active")
        .maybeSingle(),
      client
        .from("project_role_members")
        .select("id, project_role:project_roles!inner(project_id)")
        .eq("person_id", personId)
        .eq("project_roles.project_id", projectId)
        .limit(1)
        .maybeSingle(),
      resolveCompanyTemplateIdForPerson(client, personId),
    ]);

  const lookupErrorMessage =
    membershipResult.error?.message ??
    roleMembershipResult.error?.message ??
    companyTemplateResult.error;

  if (lookupErrorMessage) {
    return {
      authorized: false,
      reason: "project-access-query-failed",
      error: lookupErrorMessage,
    };
  }

  const companyTemplateId = companyTemplateResult.templateId;
  const membership = membershipResult.data;

  if (membership) {
    return {
      authorized: true,
      accessSource: "directory",
      membershipId: membership.id,
      permissionTemplateId:
        membership.permission_template_id ?? companyTemplateId,
      userType: membership.user_type,
    };
  }

  const roleMembership = roleMembershipResult.data;
  if (roleMembership) {
    return {
      authorized: true,
      accessSource: "project-role",
      membershipId: `role:${roleMembership.id}`,
      permissionTemplateId: companyTemplateId,
      userType: null,
    };
  }

  if (companyTemplateId) {
    return {
      authorized: true,
      accessSource: "company-template",
      membershipId: `company-template:${personId}:${projectId}`,
      permissionTemplateId: companyTemplateId,
      userType: "employee",
    };
  }

  return { authorized: false, reason: "no-project-access" };
}
