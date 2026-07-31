import { readFileSync } from "fs";
import { join } from "path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260731051836_secure_notes_rls.sql",
  ),
  "utf8",
)
  .replace(/\r\n?/g, "\n")
  .toLowerCase();

describe("secure notes RLS migration contract", () => {
  it("enables RLS and removes anonymous table access", () => {
    expect(migrationSql).toContain(
      "alter table public.notes enable row level security",
    );
    expect(migrationSql).toContain(
      "revoke all privileges on table public.notes from anon",
    );
    expect(migrationSql).not.toContain(
      "grant select, insert, update, delete on table public.notes to anon",
    );
  });

  it("defines explicit module-permission policies for every operation", () => {
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(migrationSql).toContain(
        `create policy notes_project_${operation}`,
      );
      expect(migrationSql).toContain(`for ${operation}\nto authenticated`);
    }

    expect(migrationSql).toContain(
      "public.current_has_project_module_permission(project_id, 'documents', 'read')",
    );
    expect(
      migrationSql.match(
        /public\.current_has_project_module_permission\(project_id, 'documents', 'write'\)/g,
      ),
    ).toHaveLength(4);
    expect(migrationSql).not.toContain(
      "public.current_is_project_member(project_id)",
    );
    expect(migrationSql).toContain("created_by = (select auth.uid())");
  });

  it("hardens the shared effective-permission helper and preserves least privilege", () => {
    expect(migrationSql).toContain(
      "alter function public.current_has_project_module_permission(bigint, text, text)\n  set search_path = ''",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.current_has_project_module_permission(bigint, text, text)\n  from public, anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.current_has_project_module_permission(bigint, text, text)\n  to authenticated, service_role",
    );
    expect(migrationSql).not.toContain(
      "create or replace function public.current_has_project_module_permission",
    );
  });

  it("limits authenticated updates and makes project and creator immutable", () => {
    expect(migrationSql).toContain(
      "grant update (title, body, archived, updated_at) on table public.notes to authenticated",
    );
    expect(migrationSql).toContain(
      "grant insert (project_id, title, body, archived, created_by) on public.notes to authenticated",
    );
    expect(migrationSql).toContain(
      "new.project_id is distinct from old.project_id",
    );
    expect(migrationSql).toContain(
      "new.created_by is distinct from old.created_by",
    );
    expect(migrationSql).toContain(
      "before update of project_id, created_by on public.notes",
    );
  });

  it("documents safe recovery and the exact post-apply ledger check", () => {
    expect(migrationSql).toContain("rollback / recovery");
    expect(migrationSql).toContain("never disable rls as rollback");
    expect(migrationSql).toContain(
      "npm run db:migrations:verify-applied -- supabase/migrations/20260731051836_secure_notes_rls.sql",
    );
  });
});
