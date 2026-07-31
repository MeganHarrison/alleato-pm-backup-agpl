/**
 * Admin pages with data access governed by `user_profiles.is_admin`, rather
 * than the legacy two-owner Admin Dashboard allowlist.
 */
export const APP_ADMIN_PAGE_PREFIXES = [
  "/company-settings",
  "/ai/learning-promotions",
  "/meeting-templates",
  "/observability",
] as const;

/**
 * API namespaces whose handlers and database policies use the app-admin
 * (`user_profiles.is_admin`) contract rather than dashboard ownership.
 */
export const APP_ADMIN_API_PREFIXES = [
  "/api/admin/meeting-templates",
  "/api/admin/ai-learning-promotions",
  "/api/admin/project-creation-log",
] as const;

export function usesAppAdminPageAccess(pathname: string | null): boolean {
  return APP_ADMIN_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
  );
}

export function usesAppAdminApiAccess(pathname: string): boolean {
  return APP_ADMIN_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
