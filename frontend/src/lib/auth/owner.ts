/**
 * The single owner of the workspace.
 *
 * This is the ONE account that is allowed to see every project in the portfolio.
 * Everyone else — including users flagged `is_admin` — only sees the projects
 * they are explicitly assigned to (via directory memberships or project roles).
 *
 * Server-safe: this module has no client-only imports, so it can be used in
 * API routes and server components. `navigation-config.ts` re-exports
 * `OWNER_EMAIL` from here to keep a single source of truth.
 */
export const OWNER_EMAILS = [
  "megan@megankharrison.com",
  "bclymer@alleatogroup.com",
] as const;

/**
 * Primary owner. Kept for backward-compatible single-value imports; new code
 * should prefer `isOwnerEmail()` so every account in `OWNER_EMAILS` is honored.
 */
export const OWNER_EMAIL = OWNER_EMAILS[0];

/**
 * Case-insensitive check for whether an email belongs to a workspace owner.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return OWNER_EMAILS.some((owner) => owner.toLowerCase() === normalized);
}
