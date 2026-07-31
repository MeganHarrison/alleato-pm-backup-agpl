import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { logger } from "@/lib/logger";
import { ALL_GRANULAR_FLAGS, type GranularFlag } from "@/lib/permissions-shared";
import { findPermissionUserLinkDiagnostics } from "@/lib/permissions/user-link-reconciliation";
import { z } from "zod";
import InviteUser from "@/emails/auth/InviteUser";
import { APP_BASE_URL } from "@/lib/email/client";
import { sendEmail } from "@/lib/email/send";
import { buildInviteAcceptUrl } from "@/lib/email/invite-links";

const InviteUserSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("A valid email is required"),
  job_title: z.string().trim().optional(),
  // Optional company to tag the person with (e.g. "Alleato Group" when invited
  // from the Employees directory, so the company-scoped table actually shows them).
  company: z.string().trim().optional(),
  // Optional explicit person to link to. When the invite is launched by picking
  // an existing person from the dropdown, this targets that exact row instead of
  // email-matching only person_type='user' (which would create a duplicate for an
  // existing person_type='employee' record).
  person_id: z.string().uuid().optional(),
  access_scope: z.enum(["all_projects", "selected_projects"]),
  template_id: z.string().uuid("A role is required"),
  project_ids: z.array(z.coerce.number().int().positive()).default([]),
});

type AuthAvatarLookup = {
  authUserId: string;
  avatarUrl: string | null;
  error: string | null;
};

type TeamsAccountLookup = {
  supabase_user_id: string;
  platform_user_id: string;
  display_name: string | null;
  created_at: string;
};

function getAuthMetadataAvatarUrl(metadata: Record<string, unknown> | null | undefined) {
  const avatarUrl = metadata?.avatar_url;
  const picture = metadata?.picture;

  if (typeof avatarUrl === "string" && avatarUrl.trim()) {
    return avatarUrl;
  }

  if (typeof picture === "string" && picture.trim()) {
    return picture;
  }

  return null;
}

async function requireAdmin(where: string) {
  return requireUserManagementAccess(where);
}

/**
 * GET /api/permissions/users
 *
 * Returns every person with an auth account, along with:
 *   - is_admin flag from user_profiles
 *   - active project memberships and the template assigned on each
 *
 * Admin only.
 */
export const GET = withApiGuardrails(
  "permissions/users#GET",
  async ({ request }) => {
    const supabase = await createClient();
    await requireAdmin("permissions/users#GET");
    const service = createServiceClient();
    const url = new URL(request.url);
    const access = url.searchParams.get("access");

    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("id, first_name, last_name, email, auth_user_id, profile_photo_url, person_type")
      .not("auth_user_id", "is", null)
      .order("last_name", { ascending: true });

    if (peopleError) {
      logger.error({ msg: "Error loading people:", data: peopleError });
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users#GET",
        message: "Failed to load users.",
        details: peopleError,
      });
    }

    const authIds = (people ?? [])
      .map((p) => p.auth_user_id)
      .filter((id): id is string => !!id);

    const personIds = (people ?? []).map((p) => p.id);

    const [
      profilesResult,
      membershipsResult,
      companyTemplatesResult,
      granularOverridesResult,
      teamsMappingsResult,
      authAvatarLookups,
    ] = await Promise.all([
      authIds.length
        ? supabase
            .from("user_profiles")
            .select("id, is_admin")
            .in("id", authIds)
        : Promise.resolve({ data: [] as { id: string; is_admin: boolean }[], error: null }),
      personIds.length
        ? supabase
            .from("project_directory_memberships")
            .select(
              `project_id, person_id, status,
               project:projects (id, name),
               permission_template:permission_templates (id, name, scope)`
            )
            .in("person_id", personIds)
            .eq("status", "active")
        : Promise.resolve({ data: [], error: null }),
      personIds.length
        ? supabase
            .from("person_company_templates")
            .select("person_id, template:permission_templates (id, name)")
            .in("person_id", personIds)
        : Promise.resolve({ data: [], error: null }),
      personIds.length
        ? supabase
            .from("user_granular_permission_overrides")
            .select("person_id, project_id, flag, effect")
            .in("person_id", personIds)
        : Promise.resolve({ data: [], error: null }),
      authIds.length
        ? serviceDb.from("bot_user_mappings")
            .select("supabase_user_id, platform_user_id, display_name, created_at")
            .eq("platform", "teams")
            .in("supabase_user_id", authIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as TeamsAccountLookup[], error: null }),
      authIds.length
        ? Promise.all(
            authIds.map(async (authUserId): Promise<AuthAvatarLookup> => {
              const { data, error } = await service.auth.admin.getUserById(authUserId);

              if (error) {
                return {
                  authUserId,
                  avatarUrl: null,
                  error: error.message,
                };
              }

              return {
                authUserId,
                avatarUrl: getAuthMetadataAvatarUrl(data.user?.user_metadata),
                error: null,
              };
            }),
          )
        : Promise.resolve([] as AuthAvatarLookup[]),
    ]);

    if (teamsMappingsResult.error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users#GET",
        message: "Failed to load Teams linked accounts.",
        details: teamsMappingsResult.error,
      });
    }

    const profileMap = new Map<string, boolean>();
    for (const row of profilesResult.data ?? []) {
      profileMap.set(row.id, row.is_admin === true);
    }

    const authAvatarMap = new Map<string, string>();
    for (const lookup of authAvatarLookups) {
      if (lookup.error) {
        logger.warn({
          msg: "Unable to load auth avatar metadata for permissions user.",
          authUserId: lookup.authUserId,
          error: lookup.error,
        });
        continue;
      }

      if (lookup.avatarUrl) {
        authAvatarMap.set(lookup.authUserId, lookup.avatarUrl);
      }
    }

    const companyTemplateMap = new Map<string, { id: string; name: string } | null>();
    for (const row of (companyTemplatesResult.data ?? []) as Array<{
      person_id: string;
      template: { id: string; name: string } | { id: string; name: string }[] | null;
    }>) {
      const tpl = Array.isArray(row.template) ? row.template[0] : row.template;
      companyTemplateMap.set(row.person_id, tpl ?? null);
    }

    const teamsAccountByAuthUser = new Map<
      string,
      { platformUserId: string; displayName: string | null; linkedAt: string }
    >();
    for (const row of (teamsMappingsResult.data ?? []) as TeamsAccountLookup[]) {
      if (teamsAccountByAuthUser.has(row.supabase_user_id)) continue;

      teamsAccountByAuthUser.set(row.supabase_user_id, {
        platformUserId: row.platform_user_id,
        displayName: row.display_name ?? null,
        linkedAt: row.created_at,
      });
    }

    const membershipsByPerson = new Map<
      string,
      Array<{
        projectId: number | string;
        projectName: string | null;
        templateId: string | null;
        templateName: string | null;
      }>
    >();

    const granularOverridesByPerson = new Map<
      string,
      Array<{
        projectId: number | string | null;
        flag: GranularFlag;
        effect: "allow" | "deny";
      }>
    >();

    for (const row of (granularOverridesResult.data ?? []) as Array<{
      person_id: string;
      project_id: number | string | null;
      flag: string;
      effect: string;
    }>) {
      if (
        !ALL_GRANULAR_FLAGS.includes(row.flag as GranularFlag) ||
        (row.effect !== "allow" && row.effect !== "deny")
      ) {
        continue;
      }

      const list = granularOverridesByPerson.get(row.person_id) ?? [];
      list.push({
        projectId: row.project_id ?? null,
        flag: row.flag as GranularFlag,
        effect: row.effect,
      });
      granularOverridesByPerson.set(row.person_id, list);
    }

    for (const row of (membershipsResult.data ?? []) as Array<{
      project_id: number | string;
      person_id: string;
      project: { id: number | string; name: string } | { id: number | string; name: string }[] | null;
      permission_template:
        | { id: string; name: string; scope: string }
        | { id: string; name: string; scope: string }[]
        | null;
    }>) {
      const project = Array.isArray(row.project) ? row.project[0] : row.project;
      const template = Array.isArray(row.permission_template)
        ? row.permission_template[0]
        : row.permission_template;

      const list = membershipsByPerson.get(row.person_id) ?? [];
      list.push({
        projectId: row.project_id,
        projectName: project?.name ?? null,
        templateId: template?.id ?? null,
        templateName: template?.name ?? null,
      });
      membershipsByPerson.set(row.person_id, list);
    }

    const users = (people ?? []).map((p) => {
      const companyTemplate = companyTemplateMap.get(p.id) ?? null;
      return {
        personId: p.id,
        authUserId: p.auth_user_id,
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        email: p.email ?? "",
        personType: p.person_type ?? "",
        profilePhotoUrl: p.profile_photo_url ?? authAvatarMap.get(p.auth_user_id ?? "") ?? null,
        isAdmin: p.auth_user_id ? profileMap.get(p.auth_user_id) === true : false,
        companyTemplateId: companyTemplate?.id ?? null,
        companyTemplateName: companyTemplate?.name ?? null,
        teamsAccount: p.auth_user_id
          ? (teamsAccountByAuthUser.get(p.auth_user_id) ?? null)
          : null,
        memberships: membershipsByPerson.get(p.id) ?? [],
        granularOverrides: granularOverridesByPerson.get(p.id) ?? [],
      };
    });
    const filteredUsers = users.filter((user) => {
      if (access === "app") {
        return user.isAdmin || Boolean(user.companyTemplateId);
      }

      if (access === "project") {
        return !user.isAdmin && !user.companyTemplateId && user.memberships.length > 0;
      }

      return true;
    });

    const linkDiagnostics = await findPermissionUserLinkDiagnostics(service);

    return NextResponse.json({
      data: filteredUsers,
      diagnostics: {
        missingAuthLinks: linkDiagnostics,
      },
    });
  },
);

/**
 * POST /api/permissions/users
 *
 * Invite an employee and atomically connect their auth account, person record,
 * auth/person mapping, and initial access assignment.
 */
export const POST = withApiGuardrails(
  "permissions/users#POST",
  async ({ request }) => {
    const actor = await requireAdmin("permissions/users#POST");
    const parsed = InviteUserSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/users#POST",
        message: "Invalid employee invite.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const body = parsed.data;
    const projectIds = Array.from(new Set(body.project_ids));

    if (body.access_scope === "selected_projects" && projectIds.length === 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/users#POST",
        message: "Select at least one project for project-specific access.",
      });
    }

    const service = createServiceClient();
    const email = body.email.toLowerCase();
    const fullName = [body.first_name, body.last_name].filter(Boolean).join(" ");

    const { data: template, error: templateError } = await serviceDb.from("permission_templates")
      .select("id, name, scope")
      .eq("id", body.template_id)
      .maybeSingle();

    if (templateError || !template) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/users#POST",
        message: "Selected role no longer exists.",
        details: templateError ?? { templateId: body.template_id },
      });
    }

    if (body.access_scope === "all_projects" && template.scope !== "company") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/users#POST",
        message: "All-project access requires an all-project role.",
      });
    }

    if (body.access_scope === "selected_projects" && template.scope === "company") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "permissions/users#POST",
        message: "Project access requires a project role.",
      });
    }

    const grantsAdmin = body.access_scope === "all_projects" && template.name === "Admin";
    let authUserId: string | null = null;
    const { data: existingProfile } = await serviceDb.from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      authUserId = existingProfile.id;
    } else {
      const { data: linkData, error: inviteError } =
        await service.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            redirectTo: `${APP_BASE_URL}/auth/callback`,
            data: {
              full_name: fullName,
              role: body.job_title || template.name,
            },
          },
        });

      if (inviteError || !linkData.user || !linkData.properties?.action_link) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users#POST",
          message: inviteError?.message ?? "Could not create invitation.",
          details: inviteError ?? { email },
        });
      }

      authUserId = linkData.user.id;

      const emailResult = await sendEmail({
        template: "user-invite",
        to: email,
        subject: "You're invited to Alleato",
        react: InviteUser({
          inviterName: actor.email ?? "Alleato",
          inviteeName: fullName,
          email,
          role: template.name,
          acceptUrl: buildInviteAcceptUrl(linkData.properties.action_link, email),
          expiresInHours: 24,
        }),
        entity: { type: "user_invite", id: authUserId },
        userId: authUserId,
        idempotencyKey: `user-invite/${authUserId}/${email}`,
        metadata: {
          accessScope: body.access_scope,
          templateId: body.template_id,
          templateName: template.name,
        },
      });

      if (emailResult.error) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users#POST:send-email",
          message: `Could not send invite email: ${emailResult.error.message}`,
          details: emailResult.error,
        });
      }
    }

    const { error: profileError } = await serviceDb.from("user_profiles").upsert(
      {
        id: authUserId,
        email,
        full_name: fullName,
        role: body.job_title || template.name,
        is_active: true,
        is_admin: grantsAdmin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (profileError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users#POST",
        message: `Could not save user profile: ${profileError.message}`,
        details: profileError,
      });
    }

    // Prefer an explicitly selected person (from the invite dropdown) so we link
    // to that exact record — even a person_type='employee' one — instead of
    // creating a duplicate. Otherwise fall back to matching an existing app user
    // by email.
    let personId = body.person_id ?? null;
    if (!personId) {
      const { data: existingPerson, error: existingPersonError } = await serviceDb.from("people")
        .select("id, auth_user_id")
        .ilike("email", email)
        .eq("person_type", "user")
        .limit(1)
        .maybeSingle();

      if (existingPersonError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users#POST",
          message: `Could not check existing employee record: ${existingPersonError.message}`,
          details: existingPersonError,
        });
      }

      personId = existingPerson?.id ?? null;
    }
    if (personId) {
      const { error: personUpdateError } = await serviceDb.from("people")
        .update({
          first_name: body.first_name,
          last_name: body.last_name,
          email,
          job_title: body.job_title || null,
          auth_user_id: authUserId,
          status: "active",
          ...(body.company ? { company: body.company } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", personId);

      if (personUpdateError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users#POST",
          message: `Could not update employee record: ${personUpdateError.message}`,
          details: personUpdateError,
        });
      }
    } else {
      const { data: person, error: personInsertError } = await serviceDb.from("people")
        .insert({
          first_name: body.first_name,
          last_name: body.last_name,
          email,
          job_title: body.job_title || null,
          auth_user_id: authUserId,
          person_type: "user",
          status: "active",
          company: body.company ?? null,
        })
        .select("id")
        .single();

      if (personInsertError || !person) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users#POST",
          message: `Could not create employee record: ${personInsertError?.message ?? "no row returned"}`,
          details: personInsertError ?? { email },
        });
      }

      personId = person.id;
    }

    const { error: authLinkError } = await serviceDb.from("users_auth").upsert(
      { person_id: personId, auth_user_id: authUserId },
      { onConflict: "person_id" },
    );

    if (authLinkError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users#POST",
        message: `Could not link employee to auth account: ${authLinkError.message}`,
        details: authLinkError,
      });
    }

    if (body.access_scope === "all_projects") {
      const { error: companyAccessError } = await serviceDb.from("person_company_templates")
        .upsert(
          {
            person_id: personId,
            template_id: body.template_id,
            assigned_by: actor.id,
            assigned_at: new Date().toISOString(),
          },
          { onConflict: "person_id" },
        );

      if (companyAccessError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users#POST",
          message: `Could not assign all-project access: ${companyAccessError.message}`,
          details: companyAccessError,
        });
      }
    } else {
      const memberships = projectIds.map((projectId) => ({
        project_id: projectId,
        person_id: personId,
        permission_template_id: body.template_id,
        role: body.job_title || template.name,
        status: "active",
        user_type: "employee",
        invite_status: "invited",
        invited_at: new Date().toISOString(),
        last_invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: membershipError } = await serviceDb.from("project_directory_memberships")
        .upsert(memberships, { onConflict: "project_id,person_id" });

      if (membershipError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users#POST",
          message: `Could not assign project access: ${membershipError.message}`,
          details: membershipError,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        personId,
        authUserId,
        accessScope: body.access_scope,
      },
    }, { status: 201 });
  },
);
