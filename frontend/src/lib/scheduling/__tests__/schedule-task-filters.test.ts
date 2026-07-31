import type { ScheduleTaskWithHierarchy } from "@/types/scheduling";
import { filterScheduleTaskHierarchy } from "../schedule-task-filters";

function makeTask(
  overrides: Partial<ScheduleTaskWithHierarchy> & Pick<ScheduleTaskWithHierarchy, "id" | "name">,
): ScheduleTaskWithHierarchy {
  return {
    id: overrides.id,
    project_id: 1144,
    parent_task_id: null,
    name: overrides.name,
    start_date: null,
    finish_date: null,
    duration_days: null,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    level: 0,
    children: [],
    ...overrides,
  };
}

const schedule = [
  makeTask({
    id: "foundation",
    name: "Foundation Phase",
    start_date: "2026-07-20",
    finish_date: "2026-07-24",
    children: [
      makeTask({
        id: "excavate",
        name: "Excavate Footings",
        parent_task_id: "foundation",
        start_date: "2026-07-20",
        finish_date: "2026-07-20",
        status: "complete",
        percent_complete: 100,
        level: 1,
      }),
      makeTask({
        id: "slab",
        name: "Pour Slab",
        parent_task_id: "foundation",
        start_date: "2026-07-21",
        finish_date: "2026-07-22",
        status: "in_progress",
        percent_complete: 50,
        wbs_code: "1.2",
        level: 1,
      }),
    ],
  }),
  makeTask({
    id: "substantial-completion",
    name: "Substantial Completion",
    start_date: "2026-08-01",
    finish_date: "2026-08-01",
    duration_days: 0,
    is_milestone: true,
  }),
  makeTask({
    id: "procurement",
    name: "Unscheduled Procurement",
  }),
];

describe("filterScheduleTaskHierarchy", () => {
  it("returns the full hierarchy when no filters are active", () => {
    const result = filterScheduleTaskHierarchy(schedule, {
      dateFilter: "all",
      searchValue: "  ",
      activeFilters: {},
    });

    expect(result).toEqual(schedule);
  });

  it("searches task names and WBS codes case-insensitively while preserving ancestors", () => {
    const byName = filterScheduleTaskHierarchy(schedule, {
      dateFilter: "all",
      searchValue: "POUR",
      activeFilters: {},
    });
    const byWbs = filterScheduleTaskHierarchy(schedule, {
      dateFilter: "all",
      searchValue: "1.2",
      activeFilters: {},
    });

    expect(byName.map((task) => task.id)).toEqual(["foundation"]);
    expect(byName[0]?.children.map((task) => task.id)).toEqual(["slab"]);
    expect(byWbs[0]?.children.map((task) => task.id)).toEqual(["slab"]);
  });

  it("filters by valid schedule status", () => {
    const result = filterScheduleTaskHierarchy(schedule, {
      dateFilter: "all",
      searchValue: "",
      activeFilters: { status: "complete" },
    });

    expect(result.map((task) => task.id)).toEqual(["foundation"]);
    expect(result[0]?.children.map((task) => task.id)).toEqual(["excavate"]);
  });

  it("filters milestones from regular tasks", () => {
    const milestones = filterScheduleTaskHierarchy(schedule, {
      dateFilter: "all",
      searchValue: "",
      activeFilters: { is_milestone: "true" },
    });

    expect(milestones.map((task) => task.id)).toEqual(["substantial-completion"]);
  });

  it("combines search, status, and task type filters", () => {
    const result = filterScheduleTaskHierarchy(schedule, {
      dateFilter: "all",
      searchValue: "slab",
      activeFilters: {
        status: "in_progress",
        is_milestone: "false",
      },
    });

    expect(result.map((task) => task.id)).toEqual(["foundation"]);
    expect(result[0]?.children.map((task) => task.id)).toEqual(["slab"]);
  });

  it("keeps only tasks active on the selected day and their ancestors", () => {
    const result = filterScheduleTaskHierarchy(
      schedule,
      {
        dateFilter: "today",
        searchValue: "",
        activeFilters: {},
      },
      new Date("2026-07-21T12:00:00"),
    );

    expect(result.map((task) => task.id)).toEqual(["foundation"]);
    expect(result[0]?.children.map((task) => task.id)).toEqual(["slab"]);
  });

  it("does not mutate the original hierarchy while filtering", () => {
    const originalChildIds = schedule[0]?.children.map((task) => task.id);

    filterScheduleTaskHierarchy(schedule, {
      dateFilter: "all",
      searchValue: "slab",
      activeFilters: {},
    });

    expect(schedule[0]?.children.map((task) => task.id)).toEqual(originalChildIds);
  });
});
