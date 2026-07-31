import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

export type ProjectCreatorAccessClient = Pick<
  SupabaseClient<Database>,
  "from"
>;

export interface ProjectCreatorAccess {
  personId: string;
  permissionTemplateId: string;
}

interface ResolveProjectCreatorAccessOptions {
  serviceClient: ProjectCreatorAccessClient;
  authUserId: string;
  where: string;
}

interface ProvisionProjectCreatorAccessOptions {
  serviceClient: ProjectCreatorAccessClient;
  projectId: number;
  access: ProjectCreatorAccess;
}

/**
 * Resolve the two records required before a project can be created safely.
 *
 * Project creation routes must call this before inserting the project so they
 * cannot leave an inaccessible project behind when identity provisioning or
 * the system permission template is missing.
 */
export async function resolveProjectCreatorAccess({
  serviceClient,
  authUserId,
  where,
}: ResolveProjectCreatorAccessOptions): Promise<ProjectCreatorAccess> {
  const { data: authLink, error: authLinkError } = await serviceClient
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (authLinkError || !authLink?.person_id) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where,
      message: "Project creator is not linked to a directory person.",
      status: 412,
      severity: "high",
      details: {
        reason: authLinkError?.message ?? "Missing users_auth.person_id",
        authUserId,
      },
      cause: authLinkError ?? undefined,
    });
  }

  const { data: adminTemplate, error: adminTemplateError } = await serviceClient
    .from("permission_templates")
    .select("id")
    .eq("is_system", true)
    .eq("name", "Project Admin")
    .maybeSingle();

  if (adminTemplateError || !adminTemplate?.id) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where,
      message:
        "Project Admin permission template is required to create a project.",
      status: 412,
      severity: "high",
      details: {
        reason:
          adminTemplateError?.message ??
          "Missing system admin permission template",
      },
      cause: adminTemplateError ?? undefined,
    });
  }

  return {
    personId: authLink.person_id,
    permissionTemplateId: adminTemplate.id,
  };
}

/**
 * Give a project's creator durable access using the canonical directory
 * membership boundary shared by normal and bootstrap project creation.
 */
export async function provisionProjectCreatorAccess({
  serviceClient,
  projectId,
  access,
}: ProvisionProjectCreatorAccessOptions): Promise<PostgrestError | null> {
  const { error } = await serviceClient
    .from("project_directory_memberships")
    .insert({
      person_id: access.personId,
      project_id: projectId,
      user_type: "employee",
      status: "active",
      role: "Project Admin",
      permission_template_id: access.permissionTemplateId,
    });

  return error;
}
