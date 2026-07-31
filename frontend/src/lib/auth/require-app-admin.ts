import "server-only";

import { redirect } from "next/navigation";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

/**
 * Requires the current API-route caller to have `user_profiles.is_admin = true`.
 *
 * This is the "is_admin" gate — it matches RLS write policies that call
 * `current_is_app_admin()` (a multi-person flag), unlike
 * `requireAdminDashboardApiAccess` in `@/lib/auth/admin-dashboard`, which
 * gates on a hardcoded 2-person email allowlist. Use this helper for any
 * admin API route whose underlying table's RLS write policy is
 * `current_is_app_admin()` / `is_admin`, so the API gate matches what the
 * database actually permits.
 *
 * Throws a 401 GuardrailError if unauthenticated, or a 403 GuardrailError if
 * the user's `user_profiles.is_admin` flag is not true.
 */
export async function requireAppAdmin(where: string): Promise<void> {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before accessing admin controls.",
      status: 401,
    });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }
}

/**
 * Page-render variant of the app-admin gate. Use this for owner/admin pages
 * whose intended access model is `user_profiles.is_admin`, not the narrower
 * legacy Admin Dashboard email allowlist.
 */
export async function requireAppAdminPageAccess(): Promise<void> {
  const user = await getApiRouteUser();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/access-denied?reason=app-admin");
  }
}
