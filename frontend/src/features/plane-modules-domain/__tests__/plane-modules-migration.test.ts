import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../supabase/migrations/20260731093000_create_plane_project_modules.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");
const executableSql = sql.split("-- Controlled rollback")[0] ?? sql;
const rollbackSql = sql.split("-- Controlled rollback")[1] ?? "";

describe("Plane Modules migration contract", () => {
  it("creates the dedicated module, member, and canonical-task membership tables", () => {
    expect(sql).toContain("create table public.project_modules");
    expect(sql).toContain("create table public.project_module_members");
    expect(sql).toContain("create table public.module_task_memberships");
    expect(sql).toContain(
      "task_id uuid not null references public.tasks(id) on delete cascade",
    );
  });

  it("enforces project, status, date, member, lead, and task boundaries", () => {
    expect(sql).toContain("project_modules_status_valid");
    expect(sql).toContain("project_modules_date_range_valid");
    expect(sql).toContain("project_modules_validate_lead");
    expect(sql).toContain("project_module_members_validate_member");
    expect(sql).toContain("module_task_memberships_validate_task");
    expect(sql).toContain("task.project_id = new.project_id");
    expect(sql).toContain(
      "new.project_id = any(coalesce(task.project_ids, '{}'::integer[]))",
    );
    expect(sql).not.toContain("document.project_id = new.project_id");
  });

  it("enables forced project-scoped RLS for all three tables", () => {
    for (const table of [
      "project_modules",
      "project_module_members",
      "module_task_memberships",
    ]) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `alter table public.${table} force row level security`,
      );
    }
    expect(sql).toContain("public.current_has_project_access(project_id)");
    expect(sql).toContain(
      "public.current_has_project_module_permission(project_id, 'schedule', 'write')",
    );
    expect(sql).toContain("to authenticated");
  });

  it("uses service-only atomic RPCs and never mutates the schedule lifecycle", () => {
    expect(sql).toContain("plane_create_project_module");
    expect(sql).toContain("plane_update_project_module");
    expect(sql).toContain("plane_replace_module_tasks");
    expect(sql).toContain("to service_role");
    expect(sql).toContain(
      "revoke all on function public.plane_modules_assert_active_project_person",
    );
    expect(executableSql).not.toMatch(
      /\b(insert\s+into|update|delete\s+from|alter\s+table)\s+public\.schedule_tasks\b/i,
    );
  });

  it("documents reverse-order rollback and ledger-safe non-application", () => {
    expect(sql).toContain("-- Controlled rollback");
    expect(sql).toContain(
      "-- drop policy if exists module_task_memberships_delete on public.module_task_memberships;",
    );
    expect(sql).toContain(
      "-- drop trigger if exists module_task_memberships_validate_task on public.module_task_memberships;",
    );
    expect(sql).toContain(
      "-- drop function if exists public.plane_modules_validate_task();",
    );
    expect(sql).toContain(
      "-- drop table if exists public.module_task_memberships;",
    );
    expect(sql).toContain(
      "-- drop table if exists public.project_module_members;",
    );
    expect(sql).toContain("-- drop table if exists public.project_modules;");
    expect(rollbackSql.indexOf("drop policy if exists")).toBeLessThan(
      rollbackSql.indexOf("drop trigger if exists"),
    );
    expect(rollbackSql.indexOf("drop trigger if exists")).toBeLessThan(
      rollbackSql.indexOf(
        "drop function if exists public.plane_modules_validate_task",
      ),
    );
    expect(
      rollbackSql.indexOf(
        "drop function if exists public.plane_modules_validate_task",
      ),
    ).toBeLessThan(
      rollbackSql.indexOf(
        "drop table if exists public.module_task_memberships",
      ),
    );
  });
});
