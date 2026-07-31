import type {
  ScheduleResource,
  ScheduleResourceCapacityProfile,
  ScheduleTask,
  ScheduleTaskAssignment,
} from "@/types/scheduling";
import { calculateScheduleResourceAllocation } from "../schedule-resource-allocation";

const calendar = {
  working_weekdays: [1, 2, 3, 4, 5],
  non_working_dates: [] as string[],
};

function resource(id: string): ScheduleResource {
  return {
    id,
    project_id: 67,
    person_id: `person-${id}`,
    display_name: id,
    email: null,
    job_title: null,
    person_status: "active",
    membership_status: "active",
    eligible: true,
  };
}

function task(id: string, overrides: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id,
    project_id: 67,
    parent_task_id: null,
    name: id,
    start_date: "2026-08-03",
    finish_date: "2026-08-07",
    duration_days: 5,
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

function assignment(
  id: string,
  taskId: string,
  resourceId: string,
  allocationPercent: number,
): ScheduleTaskAssignment {
  return {
    id,
    project_id: 67,
    task_id: taskId,
    resource_id: resourceId,
    person_id: `person-${resourceId}`,
    allocation_percent: allocationPercent,
  };
}

function capacityProfile(
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
    coverage_finish_date: "2026-08-31",
    weekday_overrides: [],
    exceptions: [],
    ...overrides,
  };
}

describe("schedule resource allocation", () => {
  it("aggregates overlapping assignments and distinguishes exact capacity from overallocation", () => {
    const result = calculateScheduleResourceAllocation({
      resources: [resource("r1")],
      tasks: [task("a"), task("b", { start_date: "2026-08-05" })],
      assignments: [assignment("aa", "a", "r1", 50), assignment("ab", "b", "r1", 50)],
      calendar,
      range: { start: "2026-08-03", finish: "2026-08-07" },
    });

    expect(result.daily.find((row) => row.date === "2026-08-05")).toMatchObject({
      assigned_percent: 100,
      available_percent: 0,
      overallocated_percent: 0,
    });
    expect(result.summaries[0]).toEqual({
      resource_id: "r1",
      peak_assigned_percent: 100,
      overallocated_dates: [],
    });

    const overloaded = calculateScheduleResourceAllocation({
      resources: [resource("r1")],
      tasks: [task("a"), task("b")],
      assignments: [assignment("aa", "a", "r1", 60), assignment("ab", "b", "r1", 60)],
      calendar,
      range: { start: "2026-08-03", finish: "2026-08-03" },
    });
    expect(overloaded.daily[0]).toMatchObject({ assigned_percent: 120, overallocated_percent: 20 });
    expect(overloaded.summaries[0].overallocated_dates).toEqual(["2026-08-03"]);
  });

  it("uses zero capacity on non-working days and honors explicit working overrides", () => {
    const result = calculateScheduleResourceAllocation({
      resources: [resource("r1")],
      tasks: [task("a", { start_date: "2026-08-08", finish_date: "2026-08-09" })],
      assignments: [assignment("aa", "a", "r1", 100)],
      calendar: { ...calendar, working_date_overrides: ["2026-08-09"] },
      range: { start: "2026-08-08", finish: "2026-08-09" },
    });

    expect(result.daily).toEqual([
      expect.objectContaining({ date: "2026-08-08", capacity_percent: 0, assigned_percent: 0 }),
      expect.objectContaining({ date: "2026-08-09", capacity_percent: 100, assigned_percent: 100 }),
    ]);
  });

  it("uses forecast boundaries independently and gives milestones no load", () => {
    const result = calculateScheduleResourceAllocation({
      resources: [resource("r1")],
      tasks: [
        task("forecast", { forecast_start_date: "2026-08-05", forecast_finish_date: "2026-08-06" }),
        task("milestone", { is_milestone: true, start_date: "2026-08-05", finish_date: "2026-08-05" }),
      ],
      assignments: [
        assignment("af", "forecast", "r1", 75),
        assignment("am", "milestone", "r1", 100),
      ],
      calendar,
      range: { start: "2026-08-03", finish: "2026-08-07" },
    });

    expect(result.daily.find((row) => row.date === "2026-08-04")?.assigned_percent).toBe(0);
    expect(result.daily.find((row) => row.date === "2026-08-05")?.assigned_percent).toBe(75);
    expect(result.daily.find((row) => row.date === "2026-08-06")?.assigned_percent).toBe(75);
  });

  it("reports missing owners, unscheduled tasks, and invalid ranges without hiding them", () => {
    const result = calculateScheduleResourceAllocation({
      resources: [resource("r1")],
      tasks: [
        task("unscheduled", { start_date: null }),
        task("invalid", { start_date: "2026-08-07", finish_date: "2026-08-03" }),
      ],
      assignments: [
        assignment("missing-task", "absent", "r1", 50),
        assignment("missing-resource", "unscheduled", "absent", 50),
        assignment("unscheduled", "unscheduled", "r1", 50),
        assignment("invalid", "invalid", "r1", 50),
      ],
      calendar,
      range: { start: "2026-08-03", finish: "2026-08-07" },
    });

    expect(result.diagnostics).toEqual([
      { code: "invalid_date_range", assignment_id: "invalid", task_id: "invalid" },
      { code: "missing_resource", assignment_id: "missing-resource", task_id: "unscheduled" },
      { code: "missing_task", assignment_id: "missing-task", task_id: "absent" },
      { code: "unscheduled_task", assignment_id: "unscheduled", task_id: "unscheduled" },
    ]);
  });

  it("returns deterministic resource, date, task, and diagnostic ordering", () => {
    const result = calculateScheduleResourceAllocation({
      resources: [resource("z"), resource("a")],
      tasks: [task("z-task"), task("a-task")],
      assignments: [assignment("z", "z-task", "z", 20), assignment("a", "a-task", "a", 30)],
      calendar,
      range: { start: "2026-08-03", finish: "2026-08-03" },
    });

    expect(result.daily.map((row) => row.resource_id)).toEqual(["a", "z"]);
    expect(result.summaries.map((row) => row.resource_id)).toEqual(["a", "z"]);
  });

  it("calculates availability against exception and weekday capacity with provenance", () => {
    const result = calculateScheduleResourceAllocation({
      resources: [resource("r1")],
      tasks: [task("a")],
      assignments: [assignment("aa", "a", "r1", 50)],
      capacity_profiles: [capacityProfile("r1", {
        weekday_overrides: [{ weekday: 1, capacity_percent: 60 }],
        exceptions: [{ date: "2026-08-04", capacity_percent: 25, reason: "Training" }],
      })],
      calendar,
      range: { start: "2026-08-03", finish: "2026-08-04" },
    });

    expect(result.daily).toEqual([
      expect.objectContaining({
        date: "2026-08-03",
        capacity_percent: 60,
        capacity_source: "weekday_override",
        assigned_percent: 50,
        available_percent: 10,
      }),
      expect.objectContaining({
        date: "2026-08-04",
        capacity_percent: 25,
        capacity_source: "date_exception",
        capacity_reason: "Training",
        assigned_percent: 50,
        overallocated_percent: 25,
      }),
    ]);
  });

  it("keeps inactive, duplicate, invalid, and uncovered capacity facts visible", () => {
    const inactive = resource("inactive");
    inactive.eligible = false;
    inactive.person_status = "inactive";
    const result = calculateScheduleResourceAllocation({
      resources: [inactive, resource("r1")],
      tasks: [task("a")],
      assignments: [assignment("aa", "a", "inactive", 50)],
      capacity_profiles: [capacityProfile("r1", {
        coverage_start_date: "2026-08-05",
        weekday_overrides: [
          { weekday: 1, capacity_percent: 50 },
          { weekday: 1, capacity_percent: 75 },
          { weekday: 2, capacity_percent: -1 },
        ],
      })],
      calendar,
      range: { start: "2026-08-03", finish: "2026-08-04" },
    });

    expect(result.daily.find((row) => row.resource_id === "inactive")).toMatchObject({
      capacity_percent: 0,
      capacity_source: "resource_inactive",
      available_percent: 0,
      overallocated_percent: 50,
    });
    expect(new Set(result.diagnostics.map(({ code }) => code))).toEqual(new Set([
      "duplicate_capacity_fact",
      "inactive_resource",
      "invalid_capacity_fact",
      "uncovered_capacity_range",
    ]));
  });
});
