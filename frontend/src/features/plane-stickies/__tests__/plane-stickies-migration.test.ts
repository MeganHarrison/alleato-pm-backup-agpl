import { readFileSync } from "fs";
import { join } from "path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260731231400_create_plane_stickies.sql",
  ),
  "utf8",
)
  .replace(/\r\n?/g, "\n")
  .toLowerCase();

describe("Plane Stickies migration contract", () => {
  it("models personal, workspace, and project scope without ambiguous rows", () => {
    expect(migrationSql).toContain(
      "check (scope in ('personal', 'workspace', 'project'))",
    );
    expect(migrationSql).toContain(
      "(scope = 'project' and project_id is not null)",
    );
    expect(migrationSql).toContain(
      "(scope <> 'project' and project_id is null)",
    );
  });

  it("enforces owner isolation and project permissions for every operation", () => {
    expect(
      migrationSql.match(/owner_id = \(select auth\.uid\(\)\)/g),
    ).toHaveLength(5);
    expect(migrationSql).toContain(
      "public.current_has_project_access(project_id)",
    );
    expect(
      migrationSql.match(
        /public\.current_has_project_module_permission\(\n\s+project_id,\n\s+'documents',\n\s+'write'\n\s+\)/g,
      ),
    ).toHaveLength(4);
  });

  it("forces RLS, revokes anonymous access, and keeps ordering deterministic", () => {
    expect(migrationSql).toContain(
      "alter table public.plane_stickies force row level security",
    );
    expect(migrationSql).toContain(
      "revoke all on table public.plane_stickies from anon",
    );
    expect(migrationSql).not.toContain("to anon;");
    expect(migrationSql).toContain("is_pinned desc");
    expect(migrationSql).toContain("updated_at desc");
  });
});
