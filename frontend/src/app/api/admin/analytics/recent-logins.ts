/**
 * Builds the "Recent logins" feed for the platform-analytics panel.
 *
 * The source of truth for sign-ins is Supabase Auth's `auth.users.last_sign_in_at`,
 * read via `supabase.auth.admin.listUsers()`. The legacy `users_auth.last_login_at`
 * column is never written by any code path, so reading it produced a permanently
 * empty panel. `auth.users.id` === `user_profiles.id`, so auth rows enrich cleanly
 * against the profiles already fetched for the dashboard.
 *
 * This is a pure function so the enrichment contract is unit-tested independently
 * of the route — a regression that swaps the source back to a never-written column
 * (empty output) is caught here, not in production.
 */

export interface AuthUserLike {
  id: string;
  email?: string | null;
  last_sign_in_at?: string | null;
}

export interface ProfileLike {
  id: string;
  email: string | null;
  full_name: string | null;
  is_admin: boolean | null;
}

export interface RecentLogin {
  authUserId: string;
  lastLoginAt: string | null;
  email: string | null;
  fullName: string | null;
  isAdmin: boolean;
}

export function buildRecentLogins(
  authUsers: AuthUserLike[],
  profiles: ProfileLike[],
  limit = 15,
): RecentLogin[] {
  const profileByAuthId = new Map(profiles.map((profile) => [profile.id, profile]));

  return authUsers
    .filter((user) => Boolean(user.last_sign_in_at))
    .sort(
      (a, b) =>
        new Date(b.last_sign_in_at as string).getTime() -
        new Date(a.last_sign_in_at as string).getTime(),
    )
    .slice(0, limit)
    .map((user) => {
      const profile = profileByAuthId.get(user.id);
      return {
        authUserId: user.id,
        lastLoginAt: user.last_sign_in_at ?? null,
        email: profile?.email ?? user.email ?? null,
        fullName: profile?.full_name ?? null,
        isAdmin: profile?.is_admin ?? false,
      };
    });
}
