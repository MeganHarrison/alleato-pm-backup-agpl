import { previewScheduleImpact } from "../schedule-impact-preview";
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
    ...overrides,
  };
}

function dependency(taskId: string, predecessorTaskId: string, type: DependencyType, lagDays = 0): ScheduleDependency {
  return {
    id: `${predecessorTaskId}-${taskId}-${type}`,
    task_id: taskId,
    predecessor_task_id: predecessorTaskId,
    dependency_type: type,
    lag_days: lagDays,
    created_at: "2026-07-21T00:00:00.000Z",
  };
}

describe("schedule impact preview", () => {
  it("skips the weekend and reports a moved finish-to-start successor before save", () => {
    const result = previewScheduleImpact({
      taskId: "A",
      tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")],
      dependencies: [dependency("B", "A", "finish_to_start")],
      update: { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 },
    });

    expect(result).toEqual(expect.objectContaining({ status: "available" }));
    expect(result.affected).toEqual([
      expect.objectContaining({ task_id: "B", previous_start: "2026-08-10", next_start: "2026-08-11", next_finish: "2026-08-12" }),
    ]);
  });

  it("uses a project non-working date when moving a successor", () => {
    const result = previewScheduleImpact({
      taskId: "A",
      tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")],
      dependencies: [dependency("B", "A", "finish_to_start")],
      update: { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 },
      calendar: { working_weekdays: [1, 2, 3, 4, 5], non_working_dates: ["2026-08-11"] },
    });

    expect(result.affected).toEqual([
      expect.objectContaining({ task_id: "B", next_start: "2026-08-12", next_finish: "2026-08-13" }),
    ]);
  });

  it.each([
    ["start_to_start", "2026-08-07"],
    ["finish_to_finish", "2026-08-07"],
    ["start_to_finish", "2026-08-06"],
  ] satisfies Array<[DependencyType, string]>)("calculates %s successor movement", (type, expectedStart) => {
    const result = previewScheduleImpact({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", type === "start_to_finish" ? "2026-08-05" : "2026-08-06", type === "start_to_finish" ? "2026-08-06" : "2026-08-07"),
      ],
      dependencies: [dependency("B", "A", type)],
      update: { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 },
    });

    expect(result.status).toBe("available");
    expect(result.affected[0]).toEqual(expect.objectContaining({ task_id: "B", next_start: expectedStart }));
  });

  it.each([
    ["finish_to_start", "2026-08-07", "2026-08-10", "2026-08-10"],
    ["start_to_start", "2026-08-05", "2026-08-06", "2026-08-06"],
    ["finish_to_finish", "2026-08-05", "2026-08-06", "2026-08-06"],
    ["start_to_finish", "2026-08-04", "2026-08-05", "2026-08-05"],
  ] satisfies Array<[DependencyType, string, string, string]>)(
    "applies negative lead time to %s relationships",
    (type, successorStart, successorFinish, expectedStart) => {
      const result = previewScheduleImpact({
        taskId: "A",
        tasks: [
          task("A", "2026-08-06", "2026-08-07"),
          task("B", successorStart, successorFinish),
        ],
        dependencies: [dependency("B", "A", type, -1)],
        update: { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 },
      });

      expect(result.status).toBe("available");
      expect(result.affected[0]).toEqual(expect.objectContaining({ task_id: "B", next_start: expectedStart }));
    },
  );

  it("surfaces a named constraint conflict instead of silently proposing an invalid successor", () => {
    const result = previewScheduleImpact({
      taskId: "A",
      tasks: [
        task("A", "2026-08-06", "2026-08-07"),
        task("B", "2026-08-10", "2026-08-11", { constraint_type: "must_finish_on", constraint_date: "2026-08-11" }),
      ],
      dependencies: [dependency("B", "A", "finish_to_start")],
      update: { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 },
    });

    expect(result.constraint_conflicts).toEqual([
      expect.objectContaining({ task_id: "B", constraint_type: "must_finish_on", calculated_date: "2026-08-12" }),
    ]);
  });

  it("fails loudly when an impacted task has no dates or the dependency graph cycles", () => {
    const missingDates = previewScheduleImpact({
      taskId: "A",
      tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "", "")],
      dependencies: [dependency("B", "A", "finish_to_start")],
      update: { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 },
    });
    expect(missingDates).toEqual(expect.objectContaining({ status: "unavailable", reason: "missing_dates" }));

    const cycle = previewScheduleImpact({
      taskId: "A",
      tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")],
      dependencies: [dependency("B", "A", "finish_to_start"), dependency("A", "B", "finish_to_start")],
      update: { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 },
    });
    expect(cycle).toEqual(expect.objectContaining({ status: "unavailable", reason: "circular_dependency" }));
  });
});
