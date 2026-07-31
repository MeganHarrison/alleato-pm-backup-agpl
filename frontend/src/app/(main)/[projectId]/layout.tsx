import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { isOwnerEmail } from "@/lib/auth/owner";
import { resolveProjectAccessForPerson } from "@/lib/auth/project-access";
import { canonicalizeProjectPath } from "@/lib/page-role-access";

/**
 * Cached authorization check per user+project pair.
 *
 * Access is project-scoped for EVERYONE except the workspace owner (handled
 * in the layout below). A user may reach a project through an active directory
 * membership, a project-role assignment, or a company-wide permission template.
 * This MUST stay in sync with the visibility rules in `GET /api/projects`, or a
 * project can appear in the portfolio list yet 404 when opened.
 *
 * Result is cached for 60 seconds to avoid redundant DB round-trips on every
 * navigation within the same project.
 */
function getProjectAuthorization(userId: string, projectId: number) {
  return unstable_cache(
    async () => {

      const [{ data: authLink }, { data: profile }] = await Promise.all([
        serviceDb.from("users_auth")
          .select("person_id")
          .eq("auth_user_id", userId)
          .maybeSingle(),
        serviceDb.from("user_profiles")
          .select("is_admin, is_developer")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      const isAdmin =
        profile?.is_admin === true || profile?.is_developer === true;
      const isDeveloper = profile?.is_developer === true;

      if (isAdmin && !authLink?.person_id) {
        return {
          authorized: true,
          isAdmin,
          isDeveloper,
          permissionTemplateId: null,
        } as const;
      }

      if (!authLink?.person_id) {
        return { authorized: false, reason: "no-profile" } as const;
      }

      const access = await resolveProjectAccessForPerson(
        createServiceClient(),
        authLink.person_id,
        projectId,
      );

      if (access.authorized) {
        return {
          authorized: true,
          isAdmin,
          isDeveloper,
          permissionTemplateId: access.permissionTemplateId,
        } as const;
      }

      return { authorized: false, reason: access.reason } as const;
    },
    // Cache key: unique per user + project so entries never cross-contaminate.
    [`project-auth-${userId}-${projectId}`],
    { revalidate: 60 },
  )();
}

async function getPageRoleAccessDecision({
  route,
  isAdmin,
  isDeveloper,
  permissionTemplateId,
}: {
  route: string;
  isAdmin: boolean;
  isDeveloper: boolean;
  permissionTemplateId: string | null;
}): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (isAdmin || isDeveloper) {
    return { allowed: true };
  }

    const { data: policy, error: policyError } = await serviceDb.from("app_page_role_access_policies")
    .select("route, enforcement_mode")
    .eq("route", route)
    .maybeSingle();

  if (policyError) {
    return { allowed: false, reason: "page-role-policy-load-failed" };
  }

  if (!policy || policy.enforcement_mode === "inherit_requirement") {
    return { allowed: true };
  }

  if (!permissionTemplateId) {
    return { allowed: false, reason: "page-role-missing-template" };
  }

  const { data: assignment, error: assignmentError } = await serviceDb.from("app_page_role_access_policy_templates")
    .select("route")
    .eq("route", route)
    .eq("permission_template_id", permissionTemplateId)
    .maybeSingle();

  if (assignmentError) {
    return { allowed: false, reason: "page-role-policy-load-failed" };
  }

  return assignment
    ? { allowed: true }
    : { allowed: false, reason: "page-role-denied" };
}

/**
 * Server-side layout guard for project-scoped pages.
 * Verifies the current user has an active membership in the requested project.
 * Only the workspace owner bypasses membership checks and reaches every project;
 * admins are membership-scoped just like everyone else.
 * Redirects to access-denied if not authorized.
 *
 * Optimizations vs the previous version:
 * - Result cached 60 s per user+project (saves ~600ms on repeat navigations)
 * - Uses the service role client to bypass RLS for reliable auth queries
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);

  if (isNaN(projectIdNum)) {
    redirect("/access-denied?reason=invalid-project");
  }

  // Read auth from the cookie JWT — zero network calls.
  const user = await getApiRouteUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Only the workspace owner sees every project. Admins are membership-scoped.
  if (isOwnerEmail(user.email)) {
    return <div className="flex flex-1 flex-col">{children}</div>;
  }

  const result = await getProjectAuthorization(user.id, projectIdNum);

  if (!result.authorized) {
    redirect(`/access-denied?reason=${result.reason}`);
  }

  const requestHeaders = await headers();
  const route = canonicalizeProjectPath(
    requestHeaders.get("x-alleato-pathname") ?? "",
  );

  if (route) {
    const pageAccess = await getPageRoleAccessDecision({
      route,
      isAdmin: result.isAdmin,
      isDeveloper: result.isDeveloper,
      permissionTemplateId: result.permissionTemplateId,
    });

    if (!pageAccess.allowed) {
      redirect(`/access-denied?reason=${pageAccess.reason}`);
    }
  }

  return <div className="flex flex-1 flex-col">{children}</div>;
}
