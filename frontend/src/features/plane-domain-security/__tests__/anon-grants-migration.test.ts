import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../supabase/migrations/20260731213000_revoke_plane_domain_anon_grants.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8").replace(/\r\n?/g, "\n");
const normalizedSql = sql.toLowerCase();

const expectedTables = [
  "project_modules",
  "project_module_members",
  "module_task_memberships",
  "project_cycles",
  "cycle_task_memberships",
] as const;

const expectedServiceRoleTables = [
  "project_modules",
  "project_module_members",
  "module_task_memberships",
] as const;

describe("Plane domain anonymous grants migration", () => {
  it("revokes every table privilege from public and anon on exactly five tables", () => {
    const revokes = [
      ...normalizedSql.matchAll(
        /revoke all privileges on table public\.([a-z_]+) from (public|anon);/g,
      ),
    ].map((match) => ({ table: match[1], role: match[2] }));

    expect(revokes).toHaveLength(expectedTables.length * 2);
    expect([...new Set(revokes.map(({ table }) => table))].sort()).toEqual(
      [...expectedTables].sort(),
    );

    for (const table of expectedTables) {
      expect(revokes.filter((revoke) => revoke.table === table)).toEqual([
        { table, role: "public" },
        { table, role: "anon" },
      ]);
    }
  });

  it("makes module service-role access explicit without changing cycle grants", () => {
    const serviceRoleGrants = [
      ...normalizedSql.matchAll(
        /grant select, insert, update, delete on table public\.([a-z_]+) to service_role;/g,
      ),
    ].map((match) => match[1]);

    expect(serviceRoleGrants).toEqual(expectedServiceRoleTables);
    expect(serviceRoleGrants).not.toContain("project_cycles");
    expect(serviceRoleGrants).not.toContain("cycle_task_memberships");
  });

  it("preserves authenticated access and changes no other objects", () => {
    const withoutPrivilegeStatements = normalizedSql.replace(
      /(?:revoke|grant)[^;]+;/g,
      "",
    );

    expect(normalizedSql).not.toMatch(/from\s+(authenticated|service_role)/);
    expect(normalizedSql).not.toMatch(/\bgrant\b[^;]*\bto\s+authenticated\b/);
    expect(normalizedSql).not.toMatch(/all tables in schema/);
    expect(withoutPrivilegeStatements).not.toMatch(
      /\b(create|alter|drop|insert|update|delete|truncate)\b/,
    );

    const executableStatements = normalizedSql
      .split("\n")
      .map((line) => line.replace(/--.*$/, "").trim())
      .filter(Boolean);

    expect(executableStatements[0]).toBe("begin;");
    expect(executableStatements.at(-1)).toBe("commit;");
    expect(executableStatements.slice(1, -1)).toHaveLength(13);
    expect(
      executableStatements.slice(1, -1).every(
        (statement) =>
          statement.startsWith("revoke all privileges on table public.") ||
          statement.startsWith(
            "grant select, insert, update, delete on table public.",
          ),
      ),
    ).toBe(true);
  });
});
