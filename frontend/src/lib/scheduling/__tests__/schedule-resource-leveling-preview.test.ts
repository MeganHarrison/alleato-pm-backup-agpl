import type {
  DependencyType,
  ScheduleDependency,
  ScheduleResource,
  ScheduleResourceCapacityProfile,
  ScheduleTask,
  ScheduleTaskAssignment,
} from "@/types/scheduling";
import { previewScheduleResourceLeveling } from "../schedule-resource-leveling-preview";

const calendar = {
  working_weekdays: [1, 2, 3, 4, 5],
  non_working_dates: [] as string[],
};

function task(id: string, overrides: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id,
    project_id: 67,
    parent_task_id: null,
    name: id,
    start_date: "2026-08-03",
    finish_date: "2026-08-04",
    duration_days: 2,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 0,
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:00Z",
    ...overrides,
  };
}

function resource(id: string, eligible = true): ScheduleResource {
  return {
    id,
    project_id: 67,
    person_id: `person-${id}`,
    display_name: id,
    email: null,
    job_title: null,
    person_status: eligible ? "active" : "inactive",
    membership_status: "active",
    eligible,
  };
}

function assignment(id: string, taskId: string, resourceId: string, allocationPercent: number): ScheduleTaskAssignment {
  return {
    id,
    project_id: 67,
    task_id: taskId,
    resource_id: resourceId,
    person_id: `person-${resourceId}`,
    allocation_percent: allocationPercent,
  };
}

function dependency(
  taskId: string,
  predecessorTaskId: string,
  dependencyType: DependencyType,
  lagDays = 0,
): ScheduleDependency {
  return {
    id: `${predecessorTaskId}-${taskId}-${dependencyType}`,
    task_id: taskId,
    predecessor_task_id: predecessorTaskId,
    dependency_type: dependencyType,
    lag_days: lagDays,
    created_at: "2026-07-22T00:00:00Z",
  };
}

function profile(
  resourceId: string,
  overrides: Partial<ScheduleResourceCapacityProfile> = {},
): ScheduleResourceCapacityProfile {
  return {
    profile_id: `profile-${resourceId}`,
    project_id: 67,
    resource_id: resourceId,
    configured: true,
    version: 1,
    coverage_start_date: "2026-08-01",
    coverage_finish_date: "2026-09-30",
    weekday_overrides: [],
    exceptions: [],
    ...overrides,
  };
}

function preview(overrides: Partial<Parameters<typeof previewScheduleResourceLeveling>[0]> = {}) {
  return previewScheduleResourceLeveling({
    tasks: [],
    dependencies: [],
    resources: [],
    assignments: [],
    capacity_profiles: [],
    calendar,
    horizon_days: 20,
    ...overrides,
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe("schedule resource leveling preview", () => {
  it("honors variable capacity for every assigned resource and preserves effective forecast duration", () => {
    const result = preview({
      tasks: [
        task("fixed", {
          start_date: "2026-08-03",
          finish_date: "2026-08-03",
          actual_start_date: "2026-08-03",
        }),
        task("flex", {
          start_date: "2026-08-03",
          finish_date: "2026-08-10",
          forecast_start_date: "2026-08-04",
          forecast_finish_date: null,
        }),
      ],
      resources: [resource("r1"), resource("r2")],
      assignments: [
        assignment("fixed-r1", "fixed", "r1", 60),
        assignment("flex-r1", "flex", "r1", 50),
        assignment("flex-r2", "flex", "r2", 100),
      ],
      capacity_profiles: [
        profile("r1"),
        profile("r2", {
          exceptions: [{ date: "2026-08-04", capacity_percent: 50, reason: "Half day" }],
        }),
      ],
    });

    expect(result.status).toBe("available");
    expect(result.proposals).toEqual([
      expect.objectContaining({
        task_id: "flex",
        previous_start_date: "2026-08-04",
        previous_finish_date: "2026-08-10",
        proposed_start_date: "2026-08-05",
        proposed_finish_date: "2026-08-11",
        delay_working_days: 1,
        constraining_resource_ids: ["r2"],
      }),
    ]);
    expect(result.notice).toBe("Preview only. No schedule dates were changed.");
    expect("generated_at" in result).toBe(false);
  });

  it.each([
    ["finish_to_start", 0, "2026-08-05"],
    ["start_to_start", 1, "2026-08-04"],
    ["finish_to_finish", 1, "2026-08-04"],
    ["start_to_finish", 3, "2026-08-05"],
  ] satisfies Array<[DependencyType, number, string]>) (
    "places a successor using %s dependencies and lag",
    (dependencyType, lagDays, expectedStart) => {
      const result = preview({
        tasks: [
          task("predecessor", { actual_start_date: "2026-08-03" }),
          task("successor", { start_date: "2026-08-03", finish_date: "2026-08-04" }),
        ],
        dependencies: [dependency("successor", "predecessor", dependencyType, lagDays)],
      });

      expect(result.proposals[0]).toEqual(expect.objectContaining({
        task_id: "successor",
        proposed_start_date: expectedStart,
      }));
    },
  );

  it("applies negative dependency lag without accelerating the successor before its effective dates", () => {
    const result = preview({
      tasks: [
        task("predecessor", { actual_start_date: "2026-08-03" }),
        task("successor", {
          start_date: "2026-07-30",
          finish_date: "2026-07-31",
        }),
      ],
      dependencies: [dependency("successor", "predecessor", "finish_to_start", -1)],
    });

    expect(result.proposals[0]).toMatchObject({
      task_id: "successor",
      previous_start_date: "2026-07-30",
      proposed_start_date: "2026-08-04",
    });
  });

  it("supports soft and hard constraints without accelerating a task", () => {
    const soft = preview({
      tasks: [task("soft", {
        constraint_type: "start_no_earlier_than",
        constraint_date: "2026-08-06",
      })],
    });
    expect(soft.proposals[0]).toMatchObject({
      task_id: "soft",
      proposed_start_date: "2026-08-06",
      proposed_finish_date: "2026-08-07",
    });

    const hardStart = preview({
      tasks: [task("hard-start", {
        constraint_type: "must_start_on",
        constraint_date: "2026-08-07",
      })],
    });
    expect(hardStart.proposals[0]).toMatchObject({
      proposed_start_date: "2026-08-07",
      proposed_finish_date: "2026-08-10",
    });

    const hardFinish = preview({
      tasks: [task("hard-finish", {
        constraint_type: "must_finish_on",
        constraint_date: "2026-08-07",
      })],
    });
    expect(hardFinish.proposals[0]).toMatchObject({
      proposed_start_date: "2026-08-06",
      proposed_finish_date: "2026-08-07",
    });

    const impossible = preview({
      tasks: [task("impossible", {
        start_date: "2026-08-10",
        finish_date: "2026-08-11",
        constraint_type: "must_start_on",
        constraint_date: "2026-08-07",
      })],
    });
    expect(impossible.status).toBe("unavailable");
    expect(impossible.diagnostics).toEqual([
      expect.objectContaining({ code: "hard_constraint_conflict", task_id: "impossible" }),
    ]);
  });

  it("normalizes soft constraints to project working dates and diagnoses fixed dependency conflicts", () => {
    const soft = preview({
      tasks: [task("soft", {
        constraint_type: "start_no_earlier_than",
        constraint_date: "2026-08-08",
      })],
    });
    expect(soft.proposals[0]).toMatchObject({
      proposed_start_date: "2026-08-10",
      proposed_finish_date: "2026-08-11",
    });

    const fixedConflict = preview({
      tasks: [
        task("predecessor", {
          start_date: "2026-08-05",
          finish_date: "2026-08-06",
        }),
        task("fixed", {
          start_date: "2026-08-03",
          finish_date: "2026-08-04",
          actual_start_date: "2026-08-03",
        }),
      ],
      dependencies: [dependency("fixed", "predecessor", "finish_to_start")],
    });
    expect(fixedConflict.diagnostics).toEqual([
      expect.objectContaining({ code: "fixed_dependency_conflict", task_id: "fixed" }),
    ]);
    expect(fixedConflict.proposals).toEqual([]);
  });

  it("keeps actual, progressed, and completed tasks fixed as reservations while milestones create zero load", () => {
    const result = preview({
      tasks: [
        task("actual", {
          start_date: "2026-08-03",
          finish_date: "2026-08-03",
          actual_start_date: "2026-08-03",
        }),
        task("progressed", {
          start_date: "2026-08-04",
          finish_date: "2026-08-04",
          percent_complete: 25,
          status: "in_progress",
        }),
        task("completed", {
          start_date: "2026-08-05",
          finish_date: "2026-08-05",
          percent_complete: 100,
          status: "complete",
        }),
        task("milestone", {
          start_date: "2026-08-03",
          finish_date: "2026-08-03",
          duration_days: 0,
          is_milestone: true,
        }),
        task("flex", { start_date: "2026-08-03", finish_date: "2026-08-03", duration_days: 1 }),
      ],
      resources: [resource("r1")],
      assignments: [
        assignment("actual", "actual", "r1", 100),
        assignment("progressed", "progressed", "r1", 100),
        assignment("completed", "completed", "r1", 100),
        assignment("milestone", "milestone", "r1", 100),
        assignment("flex", "flex", "r1", 100),
      ],
      capacity_profiles: [profile("r1")],
    });

    expect(result.proposals).toEqual([
      expect.objectContaining({ task_id: "flex", proposed_start_date: "2026-08-06" }),
    ]);
    expect(result.proposals.some(({ task_id }) => task_id === "actual" || task_id === "progressed" || task_id === "completed")).toBe(false);
  });

  it("returns cycle and unresolved-predecessor diagnostics while still leveling independent branches", () => {
    const result = preview({
      tasks: [
        task("a"),
        task("b"),
        task("downstream"),
        task("fixed", { start_date: "2026-08-03", finish_date: "2026-08-03", actual_start_date: "2026-08-03" }),
        task("independent", { start_date: "2026-08-03", finish_date: "2026-08-03", duration_days: 1 }),
      ],
      dependencies: [
        dependency("b", "a", "finish_to_start"),
        dependency("a", "b", "finish_to_start"),
        dependency("downstream", "a", "finish_to_start"),
      ],
      resources: [resource("r1")],
      assignments: [
        assignment("fixed", "fixed", "r1", 100),
        assignment("independent", "independent", "r1", 100),
      ],
      capacity_profiles: [profile("r1")],
    });

    expect(result.status).toBe("partial");
    expect(result.proposals).toEqual([
      expect.objectContaining({ task_id: "independent", proposed_start_date: "2026-08-04" }),
    ]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "circular_dependency", task_id: "a" }),
      expect.objectContaining({ code: "circular_dependency", task_id: "b" }),
      expect.objectContaining({ code: "unresolved_predecessor", task_id: "downstream" }),
    ]));
  });

  it("names missing, invalid, inactive, duplicate, and uncovered facts", () => {
    const result = preview({
      tasks: [
        task("invalid", { finish_date: "2026-08-01" }),
        task("missing-resource-task"),
        task("inactive-task"),
        task("uncovered-task"),
      ],
      resources: [resource("inactive", false), resource("uncovered")],
      assignments: [
        assignment("missing-resource", "missing-resource-task", "absent", 50),
        assignment("inactive", "inactive-task", "inactive", 50),
        assignment("uncovered", "uncovered-task", "uncovered", 50),
        assignment("missing-task", "absent-task", "uncovered", 50),
      ],
      capacity_profiles: [
        profile("uncovered", {
          coverage_start_date: "2026-08-10",
          exceptions: [
            { date: "2026-08-10", capacity_percent: 50, reason: null },
            { date: "2026-08-10", capacity_percent: 60, reason: null },
          ],
        }),
      ],
    });

    expect(result.status).toBe("unavailable");
    expect(new Set(result.diagnostics.map(({ code }) => code))).toEqual(new Set([
      "duplicate_capacity_fact",
      "inactive_resource",
      "invalid_task_dates",
      "missing_resource",
      "missing_task",
      "uncovered_capacity_range",
    ]));
  });

  it("diagnoses invalid assignments and dependency endpoints before placement", () => {
    const result = preview({
      tasks: [task("invalid-allocation"), task("duplicate-assignment")],
      resources: [resource("r1")],
      assignments: [
        assignment("invalid", "invalid-allocation", "r1", 0),
        assignment("duplicate-a", "duplicate-assignment", "r1", 50),
        assignment("duplicate-b", "duplicate-assignment", "r1", 50),
      ],
      dependencies: [dependency("invalid-allocation", "absent", "finish_to_start")],
    });

    expect(result.status).toBe("unavailable");
    expect(new Set(result.diagnostics.map(({ code }) => code))).toEqual(new Set([
      "invalid_assignment",
      "invalid_dependency",
    ]));
  });

  it("keeps a fixed over-capacity reservation visible and bounds hard-constraint search", () => {
    const fixed = preview({
      tasks: [task("fixed", {
        start_date: "2026-08-03",
        finish_date: "2026-08-03",
        actual_start_date: "2026-08-03",
      })],
      resources: [resource("r1")],
      assignments: [assignment("fixed", "fixed", "r1", 100)],
      capacity_profiles: [profile("r1", {
        exceptions: [{ date: "2026-08-03", capacity_percent: 50, reason: "Half day" }],
      })],
    });
    expect(fixed.diagnostics).toEqual([
      expect.objectContaining({
        code: "fixed_capacity_conflict",
        task_id: "fixed",
        resource_id: "r1",
        date: "2026-08-03",
      }),
    ]);

    const hardAgainstFixed = preview({
      tasks: [
        task("fixed", {
          start_date: "2026-08-04",
          finish_date: "2026-08-04",
          actual_start_date: "2026-08-04",
        }),
        task("hard", {
          start_date: "2026-08-03",
          finish_date: "2026-08-03",
          constraint_type: "must_start_on",
          constraint_date: "2026-08-04",
        }),
      ],
      resources: [resource("r1")],
      assignments: [
        assignment("fixed", "fixed", "r1", 100),
        assignment("hard", "hard", "r1", 100),
      ],
      capacity_profiles: [profile("r1")],
    });
    expect(hardAgainstFixed.diagnostics).toEqual([
      expect.objectContaining({ code: "fixed_capacity_conflict", task_id: "hard" }),
    ]);
    expect(hardAgainstFixed.proposals).toEqual([]);

    const boundedHardConstraint = preview({
      tasks: [task("hard", {
        constraint_type: "must_start_on",
        constraint_date: "2026-08-10",
      })],
      horizon_days: 2,
    });
    expect(boundedHardConstraint.diagnostics).toEqual([
      expect.objectContaining({ code: "horizon_exhausted", task_id: "hard" }),
    ]);
  });

  it("reports finite-horizon exhaustion and finish-no-later-than conflicts", () => {
    const exhausted = preview({
      tasks: [
        task("fixed", { start_date: "2026-08-03", finish_date: "2026-08-07", actual_start_date: "2026-08-03" }),
        task("flex", { start_date: "2026-08-03", finish_date: "2026-08-03", duration_days: 1 }),
      ],
      resources: [resource("r1")],
      assignments: [
        assignment("fixed", "fixed", "r1", 100),
        assignment("flex", "flex", "r1", 100),
      ],
      capacity_profiles: [profile("r1")],
      horizon_days: 2,
    });
    expect(exhausted.diagnostics).toEqual([
      expect.objectContaining({ code: "horizon_exhausted", task_id: "flex", resource_ids: ["r1"] }),
    ]);

    const deadline = preview({
      tasks: [
        task("fixed", { start_date: "2026-08-03", finish_date: "2026-08-03", actual_start_date: "2026-08-03" }),
        task("deadline", {
          start_date: "2026-08-03",
          finish_date: "2026-08-03",
          duration_days: 1,
          constraint_type: "finish_no_later_than",
          constraint_date: "2026-08-03",
        }),
      ],
      resources: [resource("r1")],
      assignments: [
        assignment("fixed", "fixed", "r1", 100),
        assignment("deadline", "deadline", "r1", 100),
      ],
      capacity_profiles: [profile("r1")],
    });
    expect(deadline.diagnostics).toEqual([
      expect.objectContaining({ code: "constraint_conflict", task_id: "deadline" }),
    ]);
  });

  it.each([0, 731, 2.5])("rejects an invalid finite horizon of %s", (horizon_days) => {
    const result = preview({ horizon_days });

    expect(result).toEqual({
      status: "unavailable",
      proposals: [],
      diagnostics: [expect.objectContaining({ code: "invalid_horizon" })],
      notice: "Preview only. No schedule dates were changed.",
    });
  });

  it("does not mutate frozen input and returns identical output for shuffled equivalent input", () => {
    const input = {
      tasks: [
        task("fixed", { start_date: "2026-08-03", finish_date: "2026-08-03", actual_start_date: "2026-08-03" }),
        task("b", { sort_order: 2, start_date: "2026-08-03", finish_date: "2026-08-03", duration_days: 1 }),
        task("a", { sort_order: 1, start_date: "2026-08-03", finish_date: "2026-08-03", duration_days: 1 }),
      ],
      dependencies: [] as ScheduleDependency[],
      resources: [resource("r2"), resource("r1")],
      assignments: [
        assignment("fixed-r1", "fixed", "r1", 100),
        assignment("a-r1", "a", "r1", 100),
        assignment("b-r2", "b", "r2", 100),
      ],
      capacity_profiles: [profile("r2"), profile("r1")],
      calendar,
      horizon_days: 20,
    };
    const frozen = deepFreeze(structuredClone(input));

    const first = previewScheduleResourceLeveling(frozen);
    const second = previewScheduleResourceLeveling({
      ...input,
      tasks: [...input.tasks].reverse(),
      resources: [...input.resources].reverse(),
      assignments: [...input.assignments].reverse(),
      capacity_profiles: [...input.capacity_profiles].reverse(),
    });

    expect(second).toEqual(first);
    expect(first.proposals.map(({ task_id }) => task_id)).toEqual(["a"]);
  });
});
