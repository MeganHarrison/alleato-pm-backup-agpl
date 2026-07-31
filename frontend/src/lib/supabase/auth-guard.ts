import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getIsAdmin } from "@/lib/auth/current-user";
import { resolvePersonId } from "@/lib/auth/identity";

export interface ProjectMembership {
  membershipId: string;
  personId: string;
  authUserId: string;
  projectId: number;
  permissionTemplateId: string | null;
  userType: string | null;
}

interface AuthGuardResult {
  membership: ProjectMembership;
  serviceClient: ReturnType<typeof createServiceClient>;
  userProfile: {
    is_admin: boolean | null;
    is_developer: boolean | null;
    full_name: string | null;
    role: string | null;
    onboarding_completed_at: string | null;
  } | null;
}

/**
 * Verifies the current user is authenticated AND is an active member of the specified project.
 * Returns the service client only after authorization is confirmed.
 *
 * Use this in any API route that needs `createServiceClient()` for a project-scoped operation.
 *
 * @throws Returns a NextResponse with 401 or 403 status on failure.
 */
export async function verifyProjectAccess(
  projectId: number,
  resolvedUser?: { id: string; email?: string | null },
): Promise<AuthGuardResult | NextResponse> {
  // Step 1: Verify authentication from the cookie JWT. API routes should not
  // pay a Supabase Auth network round trip for every project-scoped request.
  const user = resolvedUser ?? await getApiRouteUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const [profileResult, personId] = await Promise.all([
    serviceDb.from("user_profiles")
      .select("is_admin, is_developer, full_name, role, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    resolvePersonId({ id: user.id, email: user.email }, serviceClient),
  ]);

  const profile = profileResult.data ?? null;
  const isAdmin = await getIsAdmin();

  // Step 2: Check if user is app admin (bypass project membership checks)
  if (isAdmin || profile?.is_admin === true || profile?.is_developer === true) {
    return {
      membership: {
        membershipId: `super-admin:${user.id}:${projectId}`,
        personId: personId || user.id,
        authUserId: user.id,
        projectId,
        permissionTemplateId: null,
        userType: profile?.is_developer === true ? "developer" : "admin",
      },
      serviceClient,
      userProfile: profile,
    };
  }

  // Step 3: Look up person_id from auth user for non-admin users
  if (!personId) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 403 },
    );
  }

  // Step 4: Verify active membership in the project
  const { data: membership, error: membershipError } = await serviceDb.from("project_directory_memberships")
    .select("id, person_id, project_id, permission_template_id, user_type")
    .eq("person_id", personId)
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "You do not have access to this project" },
      { status: 403 },
    );
  }

  return {
    membership: {
      membershipId: membership.id,
      personId: membership.person_id,
      authUserId: user.id,
      projectId: membership.project_id,
      permissionTemplateId: membership.permission_template_id,
      userType: membership.user_type,
    },
    serviceClient,
    userProfile: profile,
  };
}

/**
 * Verifies the user has a specific module-level permission for a project.
 * Extends verifyProjectAccess with permission template checks.
 *
 * App admins bypass all permission checks.
 */
export async function verifyProjectPermission(
  projectId: number,
  module: string,
  requiredLevel: "read" | "write" | "admin" = "read",
): Promise<AuthGuardResult | NextResponse> {
  const result = await verifyProjectAccess(projectId);
  if (isAuthError(result)) return result;

  const { membership, serviceClient } = result;

  // Check if user is an app admin (bypass all permission checks)
  if (result.userProfile?.is_admin === true) {
    return result;
  }

  // No template assigned — deny access
  if (!membership.permissionTemplateId) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  // Fetch the permission template
  const { data: template } = await serviceDb.from("permission_templates")
    .select("rules_json")
    .eq("id", membership.permissionTemplateId)
    .maybeSingle();

  if (!template?.rules_json) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const rules = template.rules_json as Record<string, string[]>;
  const modulePerms = rules[module] || [];

  // Check hierarchical permissions: admin > write > read
  let hasPermission = false;
  if (modulePerms.includes("admin")) {
    hasPermission = true;
  } else if (requiredLevel === "write" && modulePerms.includes("write")) {
    hasPermission = true;
  } else if (requiredLevel === "read") {
    hasPermission =
      modulePerms.includes("read") ||
      modulePerms.includes("write") ||
      modulePerms.includes("admin");
  } else {
    hasPermission = modulePerms.includes(requiredLevel);
  }

  if (!hasPermission) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  return result;
}

/**
 * Type guard to check if verifyProjectAccess returned an error response.
 */
export function isAuthError(
  result: AuthGuardResult | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
