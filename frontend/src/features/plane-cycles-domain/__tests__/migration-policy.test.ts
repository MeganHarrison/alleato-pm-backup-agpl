import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../supabase/migrations/20260731190000_create_plane_cycles_domain.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");

describe("Plane cycles migration policy contract", () => {
  it("keeps cycles independent from schedule_tasks", () => {
    expect(migration).toContain("create table public.project_cycles");
    expect(migration).toContain("create table public.cycle_task_memberships");
    expect(migration).not.toMatch(
      /(?:insert|update|delete|alter)\s+(?:table\s+)?public\.schedule_tasks/i,
    );
  });

  it("enables project-scoped RLS on both domain tables", () => {
    expect(migration).toContain(
      "alter table public.project_cycles enable row level security",
    );
    expect(migration).toContain(
      "alter table public.cycle_task_memberships enable row level security",
    );
    expect(
      migration.match(/current_is_project_member\(project_id\)/g),
    ).toHaveLength(2);
    expect(
      migration.match(
        /current_has_project_module_permission\(project_id, 'schedule', 'write'\)/g,
      ),
    ).toHaveLength(6);
  });

  it("does not let read-only project members bypass schedule write permission", () => {
    expect(migration).toContain("project_cycles_insert_schedule_writer");
    expect(migration).toContain("project_cycles_update_schedule_writer");
    expect(migration).toContain("project_cycles_delete_schedule_writer");
    expect(migration).toContain(
      "cycle_task_memberships_insert_schedule_writer",
    );
    expect(migration).toContain(
      "cycle_task_memberships_delete_schedule_writer",
    );
  });

  it("prevents cross-project and multi-cycle task membership", () => {
    expect(migration).toContain(
      "constraint cycle_task_memberships_one_cycle_per_task unique (task_id)",
    );
    expect(migration).toContain(
      "create trigger cycle_task_memberships_project_scope",
    );
    expect(migration).toContain(
      "Cycle, task, and membership must belong to the same project.",
    );
    expect(migration).toContain("is distinct from v_task_project_id");
    expect(migration).toContain(
      "Cycle membership requires between 1 and 500 tasks.",
    );
  });

  it("restricts privileged membership functions to service role", () => {
    expect(migration).toContain(
      "revoke all on function public.set_cycle_task_memberships",
    );
    expect(migration).toContain(
      "grant execute on function public.set_cycle_task_memberships",
    );
    expect(migration).toContain("to service_role");
  });
});
