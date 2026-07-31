/**
 * Server-only auth helpers using React cache() for per-request deduplication.
 *
 * These helpers ensure that multiple server components within the same request
 * render only call supabase.auth.getUser() once. The result is memoized for the
 * lifetime of the request (not across requests).
 *
 * Usage:
 *   import { getCurrentUser, getIsAdmin } from "@/lib/auth/current-user";
 *
 *   const user = await getCurrentUser();
 *   const isAdmin = await getIsAdmin();
 *
 * DO NOT import these in 'use client' components — React cache() is server-only.
 * Client components that need admin status should read from the session's JWT
 * via supabase.auth.getSession() or a dedicated API route.
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type ProfileAccessClaims = {
  is_admin: boolean | null;
  is_developer: boolean | null;
  is_leadership: boolean | null;
};

/**
 * Returns the current authenticated user, or null if not logged in.
 * Deduplicated per request via React cache().
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfileAccessClaims = cache(
  async (): Promise<ProfileAccessClaims | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("is_admin, is_developer, is_leadership")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load profile access claims: ${error.message}`);
    }

    return data ?? null;
  },
);

/**
 * Returns true if the current user has is_admin=true in their JWT.
 *
 * The value comes from the custom_access_token_hook which embeds is_admin
 * from user_profiles at token issuance time — no extra DB round-trip.
 *
 * NOTE: the is_admin claim is a SUPERSET of is_developer. Anyone with
 * is_developer=true on their user_profile is automatically reported as admin
 * here. To check "is this user a developer specifically (and not just an
 * admin)" use getIsDeveloper().
 *
 * NOTE: requires the custom_access_token_hook to be registered in Supabase
 * Dashboard → Auth → Hooks. The custom_access_token_hook must be enabled before
 * these JWT claims can be trusted.
 * Until the hook is registered, this always returns false.
 */
export const getIsAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  // is_admin is embedded by the custom_access_token_hook into app_metadata
  // (accessible via user.app_metadata) or directly in the JWT claims.
  // @supabase/ssr surfaces JWT custom claims via user.app_metadata for
  // claims set in the hook's event->claims object.
  if ((user.app_metadata as Record<string, unknown> | undefined)?.is_admin === true) {
    return true;
  }

  const profileClaims = await getProfileAccessClaims();
  return profileClaims?.is_admin === true || profileClaims?.is_developer === true;
});

/**
 * Returns true if the current user has is_developer=true in their JWT.
 *
 * Developers are a strict subset of admins: every developer is also an admin
 * (the JWT hook OR-s is_developer into the is_admin claim), but most admins
 * are NOT developers. Use this for surfaces that should be visible only to
 * the people actively building the site (internal diagnostics, schema dumps,
 * experimental features, prompt tuning, etc.).
 *
 * The value comes from the custom_access_token_hook (same hook that emits
 * is_admin) — no extra DB round-trip.
 */
/**
 * Returns true if the current user is company leadership
 * (user_profiles.is_leadership). Gates leadership-restricted content such as
 * Annual Review meetings. NOT implied by is_admin — a regular admin who is
 * not leadership must not see leadership-restricted rows.
 *
 * The is_leadership claim is embedded by custom_access_token_hook (same hook
 * as is_admin); falls back to a profile read until the token is refreshed.
 */
export const getIsLeadership = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  if (
    (user.app_metadata as Record<string, unknown> | undefined)?.is_leadership === true
  ) {
    return true;
  }

  const profileClaims = await getProfileAccessClaims();
  return profileClaims?.is_leadership === true;
});

export const getIsDeveloper = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  if (
    (user.app_metadata as Record<string, unknown> | undefined)?.is_developer === true
  ) {
    return true;
  }

  const profileClaims = await getProfileAccessClaims();
  return profileClaims?.is_developer === true;
});
