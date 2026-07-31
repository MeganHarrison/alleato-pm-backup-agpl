import {
  parseTasksWorkSurfaceState,
  serializeTaskFilterParams,
  taskMatchesWorkSurfaceFilters,
  taskViewParam,
} from "@/features/tasks/tasks-work-surface-state";

describe("Tasks work-surface URL state", () => {
  it("uses List and the open-task filter when URL state is missing or invalid", () => {
    expect(
      parseTasksWorkSurfaceState(
        new URLSearchParams(
          "view=split&status=unknown&priority=critical&due_from=yesterday",
        ),
      ),
    ).toEqual({
      view: "list",
      filters: {
        status: "open",
        assignee_person_id: undefined,
        priority: undefined,
        due_date_from: undefined,
        due_date_to: undefined,
      },
    });
  });

  it("restores canonical List and Board URLs with valid task filters", () => {
    expect(
      parseTasksWorkSurfaceState(
        new URLSearchParams(
          "view=list&status=done&assignee=person-42&priority=high&due_from=2026-07-01&due_to=2026-07-31",
        ),
      ),
    ).toEqual({
      view: "list",
      filters: {
        status: "done",
        assignee_person_id: "person-42",
        priority: "high",
        due_date_from: "2026-07-01",
        due_date_to: "2026-07-31",
      },
    });

    expect(
      parseTasksWorkSurfaceState(new URLSearchParams("view=board")).view,
    ).toBe("board");
  });

  it("serializes filters without leaking internal filter names into the URL", () => {
    expect(
      serializeTaskFilterParams({
        status: "done",
        assignee_person_id: "person-42",
        priority: "urgent",
        due_date_from: "2026-07-01",
        due_date_to: "2026-07-31",
      }),
    ).toEqual({
      status: "done",
      assignee: "person-42",
      priority: "urgent",
      due_from: "2026-07-01",
      due_to: "2026-07-31",
    });

    expect(
      serializeTaskFilterParams({
        status: "open",
        assignee_person_id: undefined,
        priority: undefined,
        due_date_from: undefined,
        due_date_to: undefined,
      }),
    ).toEqual({
      status: null,
      assignee: null,
      priority: null,
      due_from: null,
      due_to: null,
    });
  });

  it("publishes the semantic work-surface view names", () => {
    expect(taskViewParam("list")).toBe("list");
    expect(taskViewParam("board")).toBe("board");
  });

  it("applies the same status, assignee, priority, and due-date contract to every view", () => {
    const filters = parseTasksWorkSurfaceState(
      new URLSearchParams(
        "status=open&assignee=person-42&priority=high&due_from=2026-07-01&due_to=2026-07-31",
      ),
    ).filters;

    expect(
      taskMatchesWorkSurfaceFilters(
        {
          status: "in_progress",
          assignee_person_id: "person-42",
          assignee_email: null,
          priority: "high",
          due_date: "2026-07-18T15:00:00.000Z",
        },
        filters,
      ),
    ).toBe(true);

    expect(
      taskMatchesWorkSurfaceFilters(
        {
          status: "done",
          assignee_person_id: "person-42",
          assignee_email: null,
          priority: "high",
          due_date: "2026-07-18",
        },
        filters,
      ),
    ).toBe(false);

    expect(
      taskMatchesWorkSurfaceFilters(
        {
          status: "open",
          assignee_person_id: "someone-else",
          assignee_email: null,
          priority: "high",
          due_date: "2026-07-18",
        },
        filters,
      ),
    ).toBe(false);

    expect(
      taskMatchesWorkSurfaceFilters(
        {
          status: "open",
          assignee_person_id: "person-42",
          assignee_email: null,
          priority: "low",
          due_date: "2026-07-18",
        },
        filters,
      ),
    ).toBe(false);

    expect(
      taskMatchesWorkSurfaceFilters(
        {
          status: "open",
          assignee_person_id: "person-42",
          assignee_email: null,
          priority: "high",
          due_date: "2026-08-01",
        },
        filters,
      ),
    ).toBe(false);
  });
});
