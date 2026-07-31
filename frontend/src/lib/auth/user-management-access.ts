import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { canAccessUserManagement } from "@/lib/auth/user-management-access.shared";
export { canAccessUserManagement } from "@/lib/auth/user-management-access.shared";

export async function requireUserManagementAccess(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
  }

  const [
    { data: profile, error: profileError },
    { data: person, error: personError },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("is_admin, is_developer, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("people")
      .select("job_title")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);

  const loadError = profileError ?? personError;
  if (loadError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: "Failed to verify User Management access.",
      details: loadError,
    });
  }

  const hasAccess = canAccessUserManagement({
    isAdmin: profile?.is_admin,
    isDeveloper: profile?.is_developer,
    role: profile?.role,
    title: person?.job_title,
  });

  if (!hasAccess) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "User Management requires admin, Senior Project Manager, Project Manager, or Superintendent access.",
    });
  }

  return user;
}
