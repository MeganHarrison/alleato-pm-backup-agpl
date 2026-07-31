export const ADMIN_DASHBOARD_ALLOWED_EMAILS = [
  "megan@megankharrison.com",
  "bclymer@alleatogroup.com",
] as const;

export function normalizeAdminDashboardEmail(
  email: string | null | undefined,
): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function isAdminDashboardEmailAllowed(
  email: string | null | undefined,
): boolean {
  const normalizedEmail = normalizeAdminDashboardEmail(email);
  return ADMIN_DASHBOARD_ALLOWED_EMAILS.includes(
    normalizedEmail as (typeof ADMIN_DASHBOARD_ALLOWED_EMAILS)[number],
  );
}
