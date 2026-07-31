import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { requireAdminDashboardApiAccess } from "@/lib/auth/admin-dashboard";
import { serviceDb } from "@/lib/supabase/service-db";

export async function requireAdmin(where: string): Promise<void> {
  await requireAdminDashboardApiAccess(where);
}

/**
 * API-route guard for developer-only endpoints. Mirrors `requireAdmin` (throws a
 * GuardrailError with the caller's WHERE label) but checks `is_developer`, so it
 * fits the `withApiGuardrails` throw-pattern instead of the page-level redirect
 * guard in `@/lib/auth/require-developer`.
 */
export async function requireDeveloper(where: string): Promise<void> {
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before accessing developer controls.",
      status: 401,
    });
  }

    const { data: profile, error: profileError } = await serviceDb.from("user_profiles")
    .select("is_developer")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_developer) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Developer access is required.",
      status: 403,
      details: profileError?.message,
    });
  }
}
