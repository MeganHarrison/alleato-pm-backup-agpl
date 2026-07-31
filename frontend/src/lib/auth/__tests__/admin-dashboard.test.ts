import {
  ADMIN_DASHBOARD_ALLOWED_EMAILS,
  isAdminDashboardEmailAllowed,
  normalizeAdminDashboardEmail,
} from "@/lib/auth/admin-dashboard-allowlist";

describe("admin dashboard access allowlist", () => {
  it("normalizes email input before comparison", () => {
    expect(normalizeAdminDashboardEmail(" Megan@megankharrison.com ")).toBe(
      "megan@megankharrison.com",
    );
  });

  it("allows only the named dashboard owners case-insensitively", () => {
    expect(isAdminDashboardEmailAllowed("Megan@megankharrison.com")).toBe(true);
    expect(isAdminDashboardEmailAllowed("bclymer@alleatogroup.com")).toBe(true);
    expect(isAdminDashboardEmailAllowed("ADMIN@alleatogroup.com")).toBe(false);
    expect(isAdminDashboardEmailAllowed(null)).toBe(false);
  });

  it("keeps the canonical allowlist intentionally narrow", () => {
    expect([...ADMIN_DASHBOARD_ALLOWED_EMAILS]).toEqual([
      "megan@megankharrison.com",
      "bclymer@alleatogroup.com",
    ]);
  });
});
