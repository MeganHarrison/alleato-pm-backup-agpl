/**
 * Identity resolution — the one owner of "given the authenticated user, what are
 * their id shapes?".
 *
 * Two distinct ids identify a user, and using the wrong one in a write column
 * (which RLS then silently hides) is a recurring bug class:
 *
 *   authUserId  — Supabase `auth.users.id`. Also EQUALS `user_profiles.id`
 *                 (routes read the profile via `.eq("id", authUserId)`), so
 *                 `profileId === authUserId` by construction.
 *   personId    — `people.id`, a SEPARATE id bridged from the auth uid via
 *                 `users_auth.auth_user_id → person_id`. This is what
 *                 `people`-FK columns (submitted_by, reviewed_by, …) require.
 *
 * Before this module the `users_auth → person_id` walk was re-implemented inline
 * across ~16 routes (each also re-deriving the fallbacks), and the private copy
 * lived in `auth-guard.ts`. This is the single home; `verifyProjectAccess` and
 * any route that needs `people.id` for a write call `resolvePersonId` here.
 *
 * See CONTEXT.md → "Identity resolution".
 */

import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface AuthUser {
  id: string;
  email?: string | null;
}

export interface ResolvedIdentity {
  /** Supabase auth.users.id. */
  authUserId: string;
  /** user_profiles.id — equal to authUserId by construction. */
  profileId: string;
  /** people.id, bridged via users_auth. Null only if provisioning failed. */
  personId: string | null;
}

/**
 * Resolve the authenticated user's `people.id`.
 *
 * Walk: `users_auth.auth_user_id → person_id`, then fall back to
 * `people.auth_user_id`, then `people.email` (case-insensitive, and backfill the
 * `users_auth` link on hit), and finally auto-provision a `people` row so an
 * authenticated user always has a valid id for `people`-FK columns. Returns null
 * only if provisioning itself fails.
 *
 * Side effects (idempotent): backfills the `users_auth` link and may insert a
 * `people` row. This is intentional — it guarantees FK columns can always be
 * stamped with a real `people.id`.
 */
export async function resolvePersonId(
  user: AuthUser,
  serviceClient: ServiceClient = createServiceClient(),
): Promise<string | null> {
  const { data: authLink, error: authLinkError } = await serviceClient
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!authLinkError && authLink?.person_id) {
    return authLink.person_id;
  }

  // Backward-compatibility fallback for accounts created before users_auth linkage.
  const { data: personByAuthId, error: personByAuthIdError } = await serviceClient
    .from("people")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!personByAuthIdError && personByAuthId?.id) {
    return personByAuthId.id;
  }

  if (!user.email) {
    return null;
  }

  // Last-resort fallback for environments where auth_user_id was never backfilled.
  const normalizedEmail = user.email.toLowerCase();
  const { data: personByEmail, error: personByEmailError } = await serviceClient
    .from("people")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (!personByEmailError && personByEmail?.id) {
    // Backfill users_auth link for future lookups.
    await serviceClient
      .from("users_auth")
      .upsert(
        { auth_user_id: user.id, person_id: personByEmail.id },
        { onConflict: "auth_user_id" },
      );
    return personByEmail.id;
  }

  // No matching person — auto-provision one so authenticated users always have
  // a valid people row (required for FK columns like submitted_by, reviewed_by).
  const emailLocal = user.email.split("@")[0] || "User";
  const nameParts = emailLocal.split(/[._-]+/).filter(Boolean);
  const firstName = nameParts[0]
    ? nameParts[0][0].toUpperCase() + nameParts[0].slice(1)
    : "User";
  const lastName = nameParts[1]
    ? nameParts[1][0].toUpperCase() + nameParts[1].slice(1)
    : "Account";

  const { data: created, error: createError } = await serviceClient
    .from("people")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: normalizedEmail,
      person_type: "employee",
      auth_user_id: user.id,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return null;
  }

  await serviceClient
    .from("users_auth")
    .upsert(
      { auth_user_id: user.id, person_id: created.id },
      { onConflict: "auth_user_id" },
    );

  return created.id;
}

/**
 * Resolve all id shapes for the authenticated user in one call. `profileId`
 * equals `authUserId` (user_profiles.id IS the auth uid); `personId` is the
 * bridged people.id (see `resolvePersonId`).
 */
export async function resolveIdentity(
  user: AuthUser,
  serviceClient: ServiceClient = createServiceClient(),
): Promise<ResolvedIdentity> {
  const personId = await resolvePersonId(user, serviceClient);
  return { authUserId: user.id, profileId: user.id, personId };
}
