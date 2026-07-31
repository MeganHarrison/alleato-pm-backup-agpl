import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("active employee project access migration", () => {
  const migrationPath = resolve(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260731010000_allow_active_employee_project_access.sql",
  );

  it("recognizes active employee and legacy user identities", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "p.person_type in ('user', 'employee')",
    );
    expect(migration).toContain("p.status = 'active'");
  });

  it("retains active membership and access-bearing template requirements", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("m.project_id = p_project_id");
    expect(migration).toContain("m.status = 'active'");
    expect(migration).toContain("pt.scope in ('project', 'global')");
    expect(migration).toContain("where levels ? 'read'");
  });

  it("does not add a project-role-only bypass", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).not.toContain("project_role_members");
  });

  it("preserves the helper privilege boundary", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "revoke all on function public.current_has_project_access(bigint) from public",
    );
    expect(migration).toMatch(
      /grant execute on function public\.current_has_project_access\(bigint\)\s+to authenticated, service_role/,
    );
    expect(migration).toMatch(
      /if has_function_privilege\(\s+'anon',[\s\S]+raise exception\s+'anon can execute current_has_project_access'/,
    );
  });
});
