import {
  accessLevelRequiresModule,
  inferPageAccessDefaults,
  normalizePageAccessInput,
} from "./page-access";

describe("page access policy helpers", () => {
  it("requires modules only for module access levels", () => {
    expect(accessLevelRequiresModule("module_read")).toBe(true);
    expect(accessLevelRequiresModule("module_write")).toBe(true);
    expect(accessLevelRequiresModule("module_admin")).toBe(true);
    expect(accessLevelRequiresModule("app_admin")).toBe(false);
    expect(accessLevelRequiresModule("signed_in")).toBe(false);
  });

  it("infers app admin access for admin routes", () => {
    expect(
      inferPageAccessDefaults({
        route: "/admin",
        file: "frontend/src/app/(admin)/admin/page.tsx",
        category: "Admin",
      }),
    ).toEqual({ accessLevel: "app_admin", permissionModule: null });
  });

  it("infers module access for project financial pages", () => {
    expect(
      inferPageAccessDefaults({
        route: "/[projectId]/budget",
        file: "frontend/src/app/(main)/[projectId]/budget/page.tsx",
        category: "Financials",
      }),
    ).toEqual({ accessLevel: "module_read", permissionModule: "budget" });
  });

  it("strips modules from non-module access policies", () => {
    expect(
      normalizePageAccessInput({
        route: "/site-map",
        accessLevel: "app_admin",
        permissionModule: "directory",
      }),
    ).toEqual({
      route: "/site-map",
      accessLevel: "app_admin",
      permissionModule: null,
      notes: null,
    });
  });
});
