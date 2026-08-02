import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../supabase/migrations/20260802163000_allow_plane_workspace_app_admin_access.sql",
);

describe("Plane workspace app-admin access migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");

  it("grants app admins before project-template access is evaluated", () => {
    const adminGrant = sql.indexOf("if public.current_is_app_admin() then");
    const projectFallback = sql.indexOf(
      "return public.current_has_project_access(p_project_id)",
    );

    expect(adminGrant).toBeGreaterThan(-1);
    expect(projectFallback).toBeGreaterThan(adminGrant);
    expect(sql).toContain(
      "public.current_has_project_module_permission(\n      p_project_id",
    );
  });

  it("keeps browser grants scoped to authenticated users", () => {
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("to authenticated, service_role");
    expect(sql).toContain("security definer\nset search_path = ''");
    expect(sql).toContain("has_function_privilege(\n    'anon'");
  });
});

