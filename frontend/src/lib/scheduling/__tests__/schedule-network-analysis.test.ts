import {
  analyzeScheduleNetwork,
  getDependencyStartOffset,
} from "../schedule-network-analysis";
import type {
  DependencyType,
  ScheduleDeadline,
  ScheduleDependency,
  ScheduleTask,
} from "@/types/scheduling";

function task(
  id: string,
  durationDays: number | null,
  startDate: string | null,
  finishDate: string | null,
  overrides: Partial<ScheduleTask> = {},
): ScheduleTask {
  return {
    id,
    project_id: 767,
    parent_task_id: null,
    name: id,
    start_date: startDate,
    finish_date: finishDate,
    duration_days: durationDays,
    percent_complete: 0,
    status: "not_started",
    is_milestone: durationDays === 0,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 0,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function dependency(
  taskId: string,
  predecessorTaskId: string,
  dependencyType: DependencyType = "finish_to_start",
  lagDays = 0,
): ScheduleDependency {
  return {
    id: `${predecessorTaskId}-${taskId}`,
    task_id: taskId,
    predecessor_task_id: predecessorTaskId,
    dependency_type: dependencyType,
    lag_days: lagDays,
    created_at: "2026-08-01T00:00:00.000Z",
  };
}

describe("schedule network analysis", () => {
  it("identifies the critical path and total float across parallel branches", () => {
    const result = analyzeScheduleNetwork({
      tasks: [
        task("A", 3, "2026-08-01", "2026-08-03"),
        task("B", 2, "2026-08-04", "2026-08-05"),
        task("C", 1, "2026-08-04", "2026-08-04"),
        task("D", 2, "2026-08-06", "2026-08-07"),
      ],
      dependencies: [
        dependency("B", "A"),
        dependency("C", "A"),
        dependency("D", "B"),
      ],
      deadlines: [],
    });

    expect(result.project_duration_days).toBe(7);
    expect(result.tasks.A).toEqual(expect.objectContaining({ is_critical_path: true, total_float_days: 0 }));
    expect(result.tasks.B).toEqual(expect.objectContaining({ is_critical_path: true, total_float_days: 0 }));
    expect(result.tasks.D).toEqual(expect.objectContaining({ is_critical_path: true, total_float_days: 0 }));
    expect(result.tasks.C).toEqual(expect.objectContaining({ is_critical_path: false, total_float_days: 3 }));
  });

  it("does not flag missing_dates for a task with a start date + duration but no stored finish date (regression: live Nexcom bug, 2026-07-23)", () => {
    // The auto-scheduler never writes an anchor's own finish date, only its
    // successors' — so a real predecessor can legitimately have only a start date
    // and duration. It should still participate correctly in the critical path.
    const result = analyzeScheduleNetwork({
      tasks: [
        task("A", 1, "2026-08-03", null),
        task("B", 5, "2026-08-04", "2026-08-10"),
      ],
      dependencies: [dependency("B", "A")],
      deadlines: [],
    });

    expect(result.tasks.A.schedule_warnings).not.toContain("missing_dates");
    expect(result.tasks.A).toEqual(expect.objectContaining({ is_critical_path: true, total_float_days: 0 }));
    expect(result.tasks.B).toEqual(expect.objectContaining({ is_critical_path: true, total_float_days: 0 }));
  });

  it.each([
    ["finish_to_start", 3, 2, 2, 5],
    ["start_to_start", 3, 2, 2, 2],
    ["finish_to_finish", 3, 2, 1, 2],
    ["start_to_finish", 3, 2, 1, -1],
  ] satisfies Array<[DependencyType, number, number, number, number]>) (
    "calculates the %s relationship offset",
    (dependencyType, predecessorDuration, successorDuration, lagDays, expected) => {
      expect(
        getDependencyStartOffset(
          dependencyType,
          predecessorDuration,
          successorDuration,
          lagDays,
        ),
      ).toBe(expected);
    },
  );

  it("reports dependency, deadline, and constraint violations", () => {
    const deadlines: ScheduleDeadline[] = [{
      id: "deadline-B",
      task_id: "B",
      deadline_date: "2026-08-03",
      created_at: "2026-08-01T00:00:00.000Z",
    }];
    const result = analyzeScheduleNetwork({
      tasks: [
        task("A", 3, "2026-08-01", "2026-08-03"),
        task("B", 2, "2026-08-03", "2026-08-04", {
          constraint_type: "start_no_earlier_than",
          constraint_date: "2026-08-04",
        }),
      ],
      dependencies: [dependency("B", "A")],
      deadlines,
    });

    expect(result.tasks.B.schedule_warnings).toEqual([
      "dependency_violation",
      "deadline_missed",
      "constraint_violation",
    ]);
  });

  it("validates a finish-to-start link against the predecessor finish date", () => {
    const result = analyzeScheduleNetwork({
      tasks: [
        task("A", 1, "2026-08-01", "2026-08-10"),
        task("B", 2, "2026-08-02", "2026-08-03"),
      ],
      dependencies: [dependency("B", "A")],
      deadlines: [],
    });

    expect(result.tasks.B.schedule_warnings).toContain("dependency_violation");
  });

  it.each([
    ["start_to_start", "2026-08-02", "2026-08-03", "2026-08-01", "2026-08-02"],
    ["finish_to_finish", "2026-08-01", "2026-08-03", "2026-08-01", "2026-08-02"],
    ["start_to_finish", "2026-08-03", "2026-08-04", "2026-08-01", "2026-08-02"],
  ] as const)(
    "validates a %s link against its linked date endpoints",
    (dependencyType, predecessorStart, predecessorFinish, successorStart, successorFinish) => {
      const result = analyzeScheduleNetwork({
        tasks: [
          task("A", 2, predecessorStart, predecessorFinish),
          task("B", 2, successorStart, successorFinish),
        ],
        dependencies: [dependency("B", "A", dependencyType)],
        deadlines: [],
      });

      expect(result.tasks.B.schedule_warnings).toContain("dependency_violation");
    },
  );

  it("derives duration from valid dates when duration is not stored", () => {
    const result = analyzeScheduleNetwork({
    tasks: [task("A", null, "2026-08-03", "2026-08-05")],
      dependencies: [],
      deadlines: [],
    });

    expect(result.project_duration_days).toBe(3);
  });

  it("derives CPM duration from project working days and non-working exceptions", () => {
    const result = analyzeScheduleNetwork({
      tasks: [task("A", null, "2026-08-07", "2026-08-11")],
      dependencies: [],
      deadlines: [],
      calendar: { working_weekdays: [1, 2, 3, 4, 5], non_working_dates: ["2026-08-10"] },
    });

    expect(result.project_duration_days).toBe(2);
  });

  it("flags a finish-to-start successor scheduled on a project non-working date", () => {
    const result = analyzeScheduleNetwork({
      tasks: [
        task("A", 2, "2026-08-06", "2026-08-07"),
        task("B", 1, "2026-08-10", "2026-08-10"),
      ],
      dependencies: [dependency("B", "A")],
      deadlines: [],
      calendar: { working_weekdays: [1, 2, 3, 4, 5], non_working_dates: ["2026-08-10"] },
    });

    expect(result.tasks.B.schedule_warnings).toContain("dependency_violation");
  });

  it.each([
    ["finish_no_later_than", "2026-08-01"],
    ["must_start_on", "2026-08-02"],
    ["must_finish_on", "2026-08-03"],
  ] as const)("reports a violated %s constraint", (constraintType, constraintDate) => {
    const result = analyzeScheduleNetwork({
      tasks: [task("A", 2, "2026-08-01", "2026-08-02", {
        constraint_type: constraintType,
        constraint_date: constraintDate,
      })],
      dependencies: [],
      deadlines: [],
    });

    expect(result.tasks.A.schedule_warnings).toContain("constraint_violation");
  });

  it("reports missing dates without treating an incomplete task as critical", () => {
    const result = analyzeScheduleNetwork({
      tasks: [task("A", 1, null, null)],
      dependencies: [],
      deadlines: [],
    });

    expect(result.tasks.A).toEqual(expect.objectContaining({
      is_critical_path: false,
      schedule_warnings: ["missing_dates"],
    }));
  });

  it("treats an impossible calendar date as missing schedule data", () => {
    const result = analyzeScheduleNetwork({
      tasks: [task("A", 1, "2026-02-30", "2026-02-30")],
      dependencies: [],
      deadlines: [],
    });

    expect(result.tasks.A.schedule_warnings).toContain("missing_dates");
  });

  it("reports circular dependency data instead of returning misleading float", () => {
    const result = analyzeScheduleNetwork({
      tasks: [
        task("A", 1, "2026-08-01", "2026-08-01"),
        task("B", 1, "2026-08-02", "2026-08-02"),
      ],
      dependencies: [dependency("B", "A"), dependency("A", "B")],
      deadlines: [],
    });

    expect(result.has_cycle).toBe(true);
    expect(result.tasks.A.schedule_warnings).toContain("circular_dependency");
    expect(result.tasks.B.schedule_warnings).toContain("circular_dependency");
  });
});
