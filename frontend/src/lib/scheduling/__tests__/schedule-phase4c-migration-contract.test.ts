import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

describe("Phase 4C scheduling migration contract", () => {
  it("defines enterprise calendars, task segments, immutable leveling runs, and guarded CAS functions", () => {
    const migrationsDirectory = resolve(
      process.cwd(),
      "../supabase/migrations",
    );
    const migrationName = readdirSync(migrationsDirectory).find((name) =>
      name.endsWith("_schedule_phase4c_enterprise_hourly_splits_leveling.sql"),
    );

    expect(migrationName).toBeDefined();
    const sql = readFileSync(
      resolve(migrationsDirectory, migrationName!),
      "utf8",
    );

    for (const objectName of [
      "schedule_person_work_calendars",
      "schedule_person_work_weekly_intervals",
      "schedule_person_work_date_intervals",
      "schedule_person_allocation_revisions",
      "schedule_task_segments",
      "schedule_leveling_runs",
      "schedule_leveling_run_changes",
      "schedule_leveling_events",
    ]) {
      expect(sql).toContain(objectName);
    }

    for (const functionName of [
      "get_schedule_enterprise_capacity",
      "replace_schedule_person_work_calendar",
      "replace_schedule_task_segments",
      "create_schedule_leveling_run",
      "apply_schedule_leveling_run",
      "undo_schedule_leveling_event",
      "get_schedule_leveling_history",
    ]) {
      expect(sql).toContain(functionName);
    }

    expect(sql).toMatch(/enable row level security/gi);
    expect(sql).toMatch(/security definer/gi);
    expect(sql).toMatch(/set search_path = ''/gi);
    expect(sql).toMatch(/revoke all on function/gi);
    expect(sql).toMatch(/pg_advisory_xact_lock/gi);
  });

  it("hardens previews with server context, person locks, canonical state, and safe history", () => {
    const migrationsDirectory = resolve(
      process.cwd(),
      "../supabase/migrations",
    );
    const migrationName = readdirSync(migrationsDirectory).find((name) =>
      name.endsWith("_schedule_phase4c_authoritative_leveling_hardening.sql"),
    );
    expect(migrationName).toBeDefined();
    const sql = readFileSync(
      resolve(migrationsDirectory, migrationName!),
      "utf8",
    );

    expect(sql).toContain("get_schedule_hourly_leveling_context");
    expect(sql).toContain("for update");
    expect(sql).toContain("schedule_leveling_runs_validate_person_vector");
    expect(sql).toContain("canonicalize_leveling_change_before_insert");
    expect(sql).toContain("expected_undo_task_version");
    expect(sql).toContain(
      "drop constraint if exists schedule_leveling_run_changes_task_project_fkey",
    );
    expect(sql).toContain("require_enterprise_calendar_admin");
    expect(sql).toMatch(/revoke all on function/gi);
  });

  it("restricts run creation to the trusted service and tenant-binds event references", () => {
    const migrationsDirectory = resolve(process.cwd(), "../supabase/migrations");
    const migrationName = readdirSync(migrationsDirectory).find((name) =>
      name.endsWith("_schedule_phase4c_release_boundary_hardening.sql"),
    );
    expect(migrationName).toBeDefined();
    const sql = readFileSync(resolve(migrationsDirectory, migrationName!), "utf8");

    expect(sql).toContain("create_authoritative_schedule_leveling_run");
    expect(sql).toContain("current_user <> 'service_role'");
    expect(sql).toMatch(/revoke all on function public\.create_schedule_leveling_run[\s\S]*authenticated/);
    expect(sql).toContain("schedule_leveling_events_related_event_project_fkey");
    expect(sql).toContain("schedule_leveling_events_source_revision_project_fkey");
    expect(sql).toContain("schedule_leveling_events_target_revision_project_fkey");
  });
});
