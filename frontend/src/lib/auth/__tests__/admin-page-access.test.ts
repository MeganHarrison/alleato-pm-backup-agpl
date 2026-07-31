import {
  APP_ADMIN_API_PREFIXES,
  APP_ADMIN_PAGE_PREFIXES,
  usesAppAdminApiAccess,
  usesAppAdminPageAccess,
} from "@/lib/auth/admin-page-access";

describe("admin page access model", () => {
  it("uses the app-admin gate for governed configuration pages", () => {
    expect(usesAppAdminPageAccess("/company-settings")).toBe(true);
    expect(usesAppAdminPageAccess("/company-settings/catalogs")).toBe(true);
    expect(usesAppAdminPageAccess("/ai/learning-promotions")).toBe(true);
    expect(usesAppAdminPageAccess("/meeting-templates")).toBe(true);
    expect(usesAppAdminPageAccess("/observability")).toBe(true);
  });

  it("does not broaden the legacy dashboard allowlist to unrelated pages", () => {
    expect(usesAppAdminPageAccess("/admin")).toBe(false);
    expect(usesAppAdminPageAccess(null)).toBe(false);
    expect(APP_ADMIN_PAGE_PREFIXES).toEqual([
      "/company-settings",
      "/ai/learning-promotions",
      "/meeting-templates",
      "/observability",
    ]);
  });

  it("limits the app-admin API exception to the matching configuration owner", () => {
    expect(usesAppAdminApiAccess("/api/admin/meeting-templates")).toBe(true);
    expect(
      usesAppAdminApiAccess("/api/admin/meeting-templates/template-1"),
    ).toBe(true);
    expect(usesAppAdminApiAccess("/api/admin/ai-learning-promotions")).toBe(
      true,
    );
    expect(
      usesAppAdminApiAccess("/api/admin/ai-learning-promotions/activity"),
    ).toBe(true);
    expect(usesAppAdminApiAccess("/api/admin/project-creation-log")).toBe(true);
    expect(usesAppAdminApiAccess("/api/admin/analytics")).toBe(false);
    expect(APP_ADMIN_API_PREFIXES).toEqual([
      "/api/admin/meeting-templates",
      "/api/admin/ai-learning-promotions",
      "/api/admin/project-creation-log",
    ]);
  });
});
