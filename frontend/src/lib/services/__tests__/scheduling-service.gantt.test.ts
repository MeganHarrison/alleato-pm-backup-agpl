import { SchedulingService } from "../scheduling-service";
import type { ScheduleTask } from "@/types/scheduling";

const projectId = "43";

function task(overrides: Partial<ScheduleTask>): ScheduleTask {
  return {
    id: "task-1",
    project_id: Number(projectId),
    parent_task_id: null,
    name: "Foundation",
    start_date: "2026-07-01",
    finish_date: "2026-07-03",
    duration_days: 3,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 1,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function createSchedulingClient({ includeCalendarException = false } = {}) {
  const tasks = [
    task({ id: "predecessor", name: "Foundation", sort_order: 1 }),
    task({
      id: "successor",
      name: "Framing",
      start_date: includeCalendarException ? "2026-07-06" : "2026-07-08",
      finish_date: "2026-07-10",
      duration_days: 5,
      sort_order: 2,
    }),
  ];

  const client = {
    from: jest.fn(function (this: unknown, table: string) {
      expect(this).toBe(client);
      const dataByTable: Record<string, unknown[]> = {
        schedule_tasks: tasks,
        schedule_dependencies: [{
          id: "dependency-1",
          task_id: "successor",
          predecessor_task_id: "predecessor",
          dependency_type: "finish_to_start",
          lag_days: 2,
          created_at: "2026-07-01T00:00:00.000Z",
        }],
        schedule_deadlines: [{
          id: "deadline-1",
          task_id: "successor",
          deadline_date: "2026-07-12",
          created_at: "2026-07-01T00:00:00.000Z",
        }],
        ...(includeCalendarException ? {
          project_schedule_calendars: [{ project_id: 43, working_weekdays: [1, 2, 3, 4, 5] }],
          project_schedule_calendar_exceptions: [{ exception_date: "2026-07-06", is_working: false }],
        } : {}),
      };
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        range: () => query,
        maybeSingle: () => Promise.resolve({ data: dataByTable[table]?.[0] ?? null, error: null }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve(resolve({ data: dataByTable[table], error: null })),
      };
      return query;
    }),
  };
  return client;
}

describe("SchedulingService.getGanttData", () => {
  it("returns persisted predecessor relationships and deadlines for the Gantt consumer", async () => {
    const service = new SchedulingService(createSchedulingClient() as never);

    await expect(service.getGanttData(projectId)).resolves.toEqual([
      expect.objectContaining({
        id: "predecessor",
        dependencies: [],
        deadline: undefined,
        is_critical_path: true,
        total_float_days: 0,
        schedule_warnings: [],
      }),
      expect.objectContaining({
        id: "successor",
        dependencies: [{
          predecessor_id: "predecessor",
          type: "finish_to_start",
          lag_days: 2,
        }],
        deadline: "2026-07-12",
        is_critical_path: true,
        total_float_days: 0,
        schedule_warnings: [],
      }),
    ]);
  });

  it("uses persisted project exceptions when deriving Gantt schedule warnings", async () => {
    const service = new SchedulingService(createSchedulingClient({ includeCalendarException: true }) as never);

    const data = await service.getGanttData(projectId);

    expect(data.find((item) => item.id === "successor")?.schedule_warnings).toContain("dependency_violation");
  });

  it("derives a missing finish date from duration instead of falling back to today (regression: inverted Gantt bar, 2026-07-23)", async () => {
    // A task with only a start date + duration is a valid, common state (the
    // auto-scheduler never writes a predecessor's own finish date). Falling back to
    // `today` produced finish < start whenever the task's real start wasn't today,
    // detaching its bar and any dependency line from its true position.
    const client = {
      from: jest.fn(function (this: unknown, table: string) {
        const dataByTable: Record<string, unknown[]> = {
          schedule_tasks: [task({ id: "predecessor", start_date: "2026-08-03", finish_date: null, duration_days: 1 })],
          schedule_dependencies: [],
          schedule_deadlines: [],
        };
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: () => query,
          range: () => query,
          maybeSingle: () => Promise.resolve({ data: dataByTable[table]?.[0] ?? null, error: null }),
          then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve(resolve({ data: dataByTable[table], error: null })),
        };
        return query;
      }),
    };
    const service = new SchedulingService(client as never);

    const data = await service.getGanttData(projectId);

    expect(data).toEqual([
      expect.objectContaining({ id: "predecessor", start_date: "2026-08-03", finish_date: "2026-08-03" }),
    ]);
  });

  it("derives a missing start date from finish and duration", async () => {
    const client = {
      from: jest.fn(function (this: unknown, table: string) {
        const dataByTable: Record<string, unknown[]> = {
          schedule_tasks: [
            task({
              id: "backward-derived",
              start_date: null,
              finish_date: "2026-08-07",
              duration_days: 5,
            }),
          ],
          schedule_dependencies: [],
          schedule_deadlines: [],
        };
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: () => query,
          range: () => query,
          maybeSingle: () => Promise.resolve({ data: dataByTable[table]?.[0] ?? null, error: null }),
          then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve(resolve({ data: dataByTable[table], error: null })),
        };
        return query;
      }),
    };
    const service = new SchedulingService(client as never);

    const data = await service.getGanttData(projectId);

    expect(data).toEqual([
      expect.objectContaining({
        id: "backward-derived",
        start_date: "2026-08-03",
        finish_date: "2026-08-07",
      }),
    ]);
  });

  it("preserves a fully unscheduled successor instead of fabricating today's date (regression: live Nexcom bug, 2026-07-29)", async () => {
    const client = {
      from: jest.fn(function (this: unknown, table: string) {
        const dataByTable: Record<string, unknown[]> = {
          schedule_tasks: [
            task({
              id: "pipe-prep",
              name: "Pipe Prep",
              start_date: "2026-08-11",
              finish_date: "2026-08-12",
              duration_days: 2,
              sort_order: 1,
            }),
            task({
              id: "pipe-installation",
              name: "Pipe installation",
              start_date: null,
              finish_date: null,
              duration_days: null,
              sort_order: 2,
            }),
          ],
          schedule_dependencies: [{
            id: "dependency-1",
            task_id: "pipe-installation",
            predecessor_task_id: "pipe-prep",
            dependency_type: "finish_to_start",
            lag_days: 0,
            created_at: "2026-07-24T17:39:45.454Z",
          }],
          schedule_deadlines: [],
        };
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: () => query,
          range: () => query,
          maybeSingle: () => Promise.resolve({ data: dataByTable[table]?.[0] ?? null, error: null }),
          then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve(resolve({ data: dataByTable[table], error: null })),
        };
        return query;
      }),
    };
    const service = new SchedulingService(client as never);

    const data = await service.getGanttData(projectId);

    expect(data.find((item) => item.id === "pipe-installation")).toEqual(
      expect.objectContaining({
        start_date: null,
        finish_date: null,
        duration_days: null,
        schedule_warnings: ["missing_dates"],
      }),
    );
  });
});
