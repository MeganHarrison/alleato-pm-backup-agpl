import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Project Manager role commitment authorization", () => {
  const migrationPath = resolve(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260731001500_project_manager_role_commitment_access.sql",
  );

  it("grants active Project Manager role members Commitments read and write", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "create or replace function public.current_has_project_module_permission",
    );
    expect(migration).toContain("join public.project_roles pr");
    expect(migration).toContain(
      "lower(btrim(pr.role_name)) = 'project manager'",
    );
    expect(migration).toContain("p_module = 'commitments'");
    expect(migration).toContain("p_required_level in ('read', 'write')");
  });

  it("preserves explicit module overrides ahead of the role grant", () => {
    const migration = readFileSync(migrationPath, "utf8");
    const overrideLookup = migration.indexOf(
      "from public.user_module_permissions ump",
    );
    const overrideReturn = migration.indexOf("if found then", overrideLookup);
    const roleGrant = migration.indexOf("if v_has_project_manager_role");

    expect(overrideLookup).toBeGreaterThan(-1);
    expect(overrideReturn).toBeGreaterThan(overrideLookup);
    expect(roleGrant).toBeGreaterThan(overrideReturn);
  });

  it("does not turn the Project Manager role into Commitments admin", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("p_required_level in ('read', 'write')");
    expect(migration).toContain(
      "v_has_project_manager_role\n    and p_module = 'commitments'",
    );
    expect(migration).not.toContain(
      "p_required_level in ('read', 'write', 'admin')",
    );
  });

  it("fails the migration if the role grant contract is not installed", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "Project Manager role commitment access function contract is invalid",
    );
    expect(migration).toContain(
      "Project Manager role commitment access verification failed",
    );
    expect(migration).toContain(
      "Project Manager role commitment access verification failed: anon can execute helper",
    );
  });
});
