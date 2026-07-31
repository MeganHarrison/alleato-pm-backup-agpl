/**
 * Guard for the /auth/update-password page.
 *
 * `supabase.auth.updateUser({ password })` operates on whatever session is
 * currently active in the browser. The update-password page is reachable
 * directly, so if a user is already signed in as someone else and lands there
 * (e.g. opens an invite/recovery link for a different account in a tab where
 * they're already authenticated), the update would silently overwrite the
 * *signed-in* user's password instead of the intended account's.
 *
 * This actually happened: a logged-in user's password was rewritten at the
 * moment an invite/reset link was opened in their session. This guard refuses
 * to update a session whose email does not match the intended target, and
 * refuses entirely when there is no verified session.
 */

export type PasswordUpdateGuardKind = "ok" | "no-session" | "email-mismatch";

export interface PasswordUpdateGuardResult {
  allowed: boolean;
  kind: PasswordUpdateGuardKind;
  message: string | null;
}

const normalizeEmail = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

/**
 * Decide whether the active session may have its password updated.
 *
 * @param sessionEmail email of the user the browser is currently signed in as
 *   (from `supabase.auth.getUser()`), or null when there is no session.
 * @param intendedEmail email the password link was issued for (the `email`
 *   query param), or null when the link did not carry one.
 */
export function evaluatePasswordUpdateGuard({
  sessionEmail,
  intendedEmail,
}: {
  sessionEmail: string | null | undefined;
  intendedEmail: string | null | undefined;
}): PasswordUpdateGuardResult {
  const session = normalizeEmail(sessionEmail);

  if (!session) {
    return {
      allowed: false,
      kind: "no-session",
      message:
        "Your password link hasn't been verified or has expired. Request a new link and open it again.",
    };
  }

  const intended = normalizeEmail(intendedEmail);

  if (intended && intended !== session) {
    return {
      allowed: false,
      kind: "email-mismatch",
      message: `This link is for ${intendedEmail}, but you're currently signed in as ${sessionEmail}. Sign out, then open the link again to set that account's password.`,
    };
  }

  return { allowed: true, kind: "ok", message: null };
}
