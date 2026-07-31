import {
  computeAutoScheduleUpdates,
  computeAutoScheduleUpdatesForDependencyChange,
} from "../schedule-auto-scheduler";
import type { DependencyType, ScheduleDependency, ScheduleTask } from "@/types/scheduling";

function task(id: string, start: string, finish: string, overrides: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id,
    project_id: 43,
    parent_task_id: null,
    name: id,
    start_date: start,
    finish_date: finish,
    duration_days: 2,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 0,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
    schedule_mode: "auto",
    ...overrides,
  };
}

function dependency(taskId: string, predecessorTaskId: string, type: DependencyType = "finish_to_start", lagDays = 0): ScheduleDependency {
  return {
    id: `${predecessorTaskId}-${taskId}-${type}`,
    task_id: taskId,
    predecessor_task_id: predecessorTaskId,
    dependency_type: type,
    lag_days: lagDays,
    created_at: "2026-07-21T00:00:00.000Z",
  };
}

const ROOT_UPDATE = { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 };

describe("computeAutoScheduleUpdates (task-field trigger)", () => {
  it("applies a finish-to-start cascade to an eligible successor", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")],
      dependencies: [dependency("B", "A")],
      update: ROOT_UPDATE,
    });

    expect(result).toEqual({
      status: "applied",
      updates: [{ task_id: "B", start_date: "2026-08-11", finish_date: "2026-08-12" }],
      skipped: [],
    });
  });

  it("cascades transitively through a multi-hop chain (A -> B -> C)", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", "2026-08-10", "2026-08-11"),
        task("C", "2026-08-12", "2026-08-13"),
      ],
      dependencies: [dependency("B", "A"), dependency("C", "B")],
      update: ROOT_UPDATE,
    });

    expect(result.status).toBe("applied");
    expect(result.status === "applied" && result.updates).toEqual([
      { task_id: "B", start_date: "2026-08-11", finish_date: "2026-08-12" },
      { task_id: "C", start_date: "2026-08-13", finish_date: "2026-08-14" },
    ]);
  });

  it("cascades onto a successor that has no dates at all yet — only a duration", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", "", "", { start_date: null, finish_date: null, duration_days: 5 }),
      ],
      dependencies: [dependency("B", "A")],
      update: ROOT_UPDATE,
    });

    expect(result).toEqual({
      status: "applied",
      updates: [{ task_id: "B", start_date: "2026-08-11", finish_date: "2026-08-17" }],
      skipped: [],
    });
  });

  it("skips a successor in manual scheduling mode", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", "2026-08-10", "2026-08-11", { schedule_mode: "manual" }),
      ],
      dependencies: [dependency("B", "A")],
      update: ROOT_UPDATE,
    });

    expect(result).toEqual({
      status: "no_change",
      updates: [],
      skipped: [{ task_id: "B", reason: "manual_mode" }],
    });
  });

  it("skips a successor that already has an actual start date", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", "2026-08-10", "2026-08-11", { actual_start_date: "2026-08-10" }),
      ],
      dependencies: [dependency("B", "A")],
      update: ROOT_UPDATE,
    });

    expect(result).toEqual({
      status: "no_change",
      updates: [],
      skipped: [{ task_id: "B", reason: "actual_dates_set" }],
    });
  });

  it("skips a successor whose dates are already governed by persisted hourly segments", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", "2026-08-10", "2026-08-11", {
          segments: [{
            id: "seg-1",
            task_id: "B",
            segment_index: 0,
            starts_at: "2026-08-10T13:00:00.000Z",
            ends_at: "2026-08-10T17:00:00.000Z",
            planned_minutes: 240,
            lock_reason: null,
          }],
        }),
      ],
      dependencies: [dependency("B", "A")],
      update: ROOT_UPDATE,
    });

    expect(result).toEqual({
      status: "no_change",
      updates: [],
      skipped: [{ task_id: "B", reason: "has_segments" }],
    });
  });

  it("blocks the whole cascade and writes nothing when a downstream constraint would be violated", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", "2026-08-10", "2026-08-11", { constraint_type: "must_finish_on", constraint_date: "2026-08-11" }),
      ],
      dependencies: [dependency("B", "A")],
      update: ROOT_UPDATE,
    });

    expect(result.status).toBe("blocked");
    expect(result.status === "blocked" && result.constraint_conflicts).toEqual([
      expect.objectContaining({ task_id: "B", constraint_type: "must_finish_on" }),
    ]);
  });

  it("is a no-op when the dependency graph cycles (previewScheduleImpact reports unavailable)", () => {
    const result = computeAutoScheduleUpdates({
      taskId: "A",
      tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")],
      dependencies: [dependency("B", "A"), dependency("A", "B")],
      update: ROOT_UPDATE,
    });

    expect(result).toEqual({ status: "no_change", updates: [], skipped: [] });
  });
});

describe("computeAutoScheduleUpdatesForDependencyChange (dependency-graph trigger)", () => {
  it("cascades a successor's dates forward when a new finish-to-start dependency is created", () => {
    const tasks = [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-03", "2026-08-04")];
    const result = computeAutoScheduleUpdatesForDependencyChange({
      predecessorTaskId: "A",
      tasks,
      dependenciesBefore: [],
      dependenciesAfter: [dependency("B", "A")],
    });

    expect(result).toEqual({
      status: "applied",
      updates: [{ task_id: "B", start_date: "2026-08-10", finish_date: "2026-08-11" }],
      skipped: [],
    });
  });

  it("reports no change when removing a dependency (deletion never auto-moves dates)", () => {
    const tasks = [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")];
    const result = computeAutoScheduleUpdatesForDependencyChange({
      predecessorTaskId: "A",
      tasks,
      dependenciesBefore: [dependency("B", "A")],
      dependenciesAfter: [],
    });

    expect(result).toEqual({ status: "no_change", updates: [], skipped: [] });
  });

  it("blocks creating a dependency that would violate the successor's own constraint", () => {
    const tasks = [
      task("A", "2026-08-06", "2026-08-07"),
      task("B", "2026-08-03", "2026-08-04", { constraint_type: "must_start_on", constraint_date: "2026-08-03" }),
    ];
    const result = computeAutoScheduleUpdatesForDependencyChange({
      predecessorTaskId: "A",
      tasks,
      dependenciesBefore: [],
      dependenciesAfter: [dependency("B", "A")],
    });

    expect(result.status).toBe("blocked");
  });

  it("fills in dates for a freshly created successor that has no dates at all yet — only a duration (regression: live Nexcom bug, 2026-07-23)", () => {
    const tasks = [
      task("A", "2026-08-06", "", { finish_date: null, duration_days: 1 }),
      task("B", "", "", { start_date: null, finish_date: null, duration_days: 5 }),
    ];
    const result = computeAutoScheduleUpdatesForDependencyChange({
      predecessorTaskId: "A",
      tasks,
      dependenciesBefore: [],
      dependenciesAfter: [dependency("B", "A")],
    });

    expect(result).toEqual({
      status: "applied",
      updates: [{ task_id: "B", start_date: "2026-08-07", finish_date: "2026-08-13" }],
      skipped: [],
    });
  });

  it("still reports no change when the ANCHOR predecessor itself has no dates (nothing to anchor the cascade to)", () => {
    const tasks = [
      task("A", "", "", { start_date: null, finish_date: null, duration_days: 1 }),
      task("B", "2026-08-10", "2026-08-11"),
    ];
    const result = computeAutoScheduleUpdatesForDependencyChange({
      predecessorTaskId: "A",
      tasks,
      dependenciesBefore: [],
      dependenciesAfter: [dependency("B", "A")],
    });

    expect(result).toEqual({ status: "no_change", updates: [], skipped: [] });
  });
});
