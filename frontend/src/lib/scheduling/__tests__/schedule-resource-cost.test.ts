import {
  calculateScheduleCost,
  type ScheduleCostAssignment,
  type ScheduleCostResource,
} from "@/lib/scheduling/schedule-resource-cost";
import type { ScheduleTask } from "@/types/scheduling";

const task = (overrides: Partial<ScheduleTask> = {}): ScheduleTask => ({
  id: "task-1",
  project_id: 43,
  parent_task_id: null,
  name: "Install framing",
  start_date: "2026-07-27",
  finish_date: "2026-07-31",
  duration_days: 5,
  percent_complete: 40,
  status: "in_progress",
  is_milestone: false,
  constraint_type: null,
  constraint_date: null,
  wbs_code: "1.1",
  sort_order: 1,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  ...overrides,
});

const resource = (
  overrides: Partial<ScheduleCostResource> = {},
): ScheduleCostResource => ({
  id: "resource-1",
  display_name: "Alex Carpenter",
  standard_rate: 50,
  cost_per_use: 0,
  rate_unit: "hour",
  ...overrides,
});

const assignment = (
  overrides: Partial<ScheduleCostAssignment> = {},
): ScheduleCostAssignment => ({
  id: "assignment-1",
  task_id: "task-1",
  resource_id: "resource-1",
  planned_units: 40,
  actual_units: 18,
  actual_rate: 50,
  actual_cost: null,
  ...overrides,
});

describe("calculateScheduleCost", () => {
  it("calculates BAC, PV, EV, AC, CV, SV, CPI, and SPI from explicit facts", () => {
    const result = calculateScheduleCost({
      resources: [resource()],
      assignments: [assignment()],
      tasks: [task()],
      status_date: "2026-07-29",
    });

    expect(result).toMatchObject({
      budget_at_completion: 2000,
      planned_value: 1200,
      earned_value: 800,
      actual_cost: 900,
      cost_variance: -100,
      schedule_variance: -400,
      cost_performance_index: 0.889,
      schedule_performance_index: 0.667,
      cost_complete: true,
      schedule_complete: true,
      actual_cost_complete: true,
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.diagnostics).toEqual([]);
  });

  it("supports equipment day rates and material unit rates without person-only assumptions", () => {
    const result = calculateScheduleCost({
      resources: [
        resource({
          id: "equipment-1",
          display_name: "Tower crane",
          standard_rate: 900,
          cost_per_use: 250,
          rate_unit: "day",
        }),
        resource({
          id: "material-1",
          display_name: "Structural steel",
          standard_rate: 15,
          cost_per_use: 0,
          rate_unit: "unit",
        }),
      ],
      assignments: [
        assignment({
          id: "equipment-assignment",
          resource_id: "equipment-1",
          planned_units: 2,
          actual_units: 2,
          actual_rate: 950,
        }),
        assignment({
          id: "material-assignment",
          resource_id: "material-1",
          planned_units: 10,
          actual_units: 8,
          actual_rate: 15,
        }),
      ],
      tasks: [task({ percent_complete: 100 })],
      status_date: "2026-08-01",
    });

    expect(result.budget_at_completion).toBe(2200);
    expect(result.actual_cost).toBe(2270);
    expect(result.earned_value).toBe(2200);
  });

  it("keeps actual cost unavailable instead of inferring it from percent complete", () => {
    const result = calculateScheduleCost({
      resources: [resource()],
      assignments: [assignment({ actual_units: null, actual_cost: null })],
      tasks: [task()],
      status_date: "2026-07-29",
    });

    expect(result.actual_cost).toBeNull();
    expect(result.cost_variance).toBeNull();
    expect(result.cost_performance_index).toBeNull();
    expect(result.actual_cost_complete).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "missing_actual_units" }),
    ]);
  });

  it("keeps a task's actual cost unavailable when any cost-bearing assignment lacks actuals", () => {
    const result = calculateScheduleCost({
      resources: [
        resource(),
        resource({ id: "resource-2", display_name: "Second crew" }),
      ],
      assignments: [
        assignment(),
        assignment({
          id: "assignment-2",
          resource_id: "resource-2",
          planned_units: 8,
          actual_units: null,
          actual_cost: null,
        }),
      ],
      tasks: [task()],
      status_date: "2026-07-29",
    });

    expect(result.actual_cost).toBeNull();
    expect(result.cost_variance).toBeNull();
    expect(result.tasks[0]?.actual_cost).toBeNull();
    expect(result.actual_cost_complete).toBe(false);
  });

  it("reports missing task, resource, and rate-unit references instead of dropping them", () => {
    const result = calculateScheduleCost({
      resources: [resource(), resource({ id: "no-unit", rate_unit: null })],
      assignments: [
        assignment({ id: "missing-task", task_id: "not-found" }),
        assignment({ id: "missing-resource", resource_id: "not-found" }),
        assignment({ id: "missing-unit", resource_id: "no-unit" }),
      ],
      tasks: [task()],
      status_date: "2026-07-29",
    });

    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "missing_task",
      "missing_resource",
      "missing_rate_unit",
    ]);
    expect(result.cost_complete).toBe(false);
    expect(result.budget_at_completion).toBeNull();
    expect(result.earned_value).toBeNull();
  });

  it("keeps schedule metrics unavailable for unscheduled work instead of fabricating zero PV", () => {
    const result = calculateScheduleCost({
      resources: [resource()],
      assignments: [assignment()],
      tasks: [task({ start_date: null, finish_date: null })],
      status_date: "2026-07-29",
    });

    expect(result.budget_at_completion).toBe(2000);
    expect(result.earned_value).toBe(800);
    expect(result.planned_value).toBeNull();
    expect(result.schedule_variance).toBeNull();
    expect(result.schedule_performance_index).toBeNull();
    expect(result.schedule_complete).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "unscheduled_task" }),
    ]);
  });

  it("retains explicit actual cost when the planned baseline is zero", () => {
    const result = calculateScheduleCost({
      resources: [resource({ standard_rate: 0 })],
      assignments: [
        assignment({
          planned_units: 0,
          actual_units: null,
          actual_cost: 125,
        }),
      ],
      tasks: [task()],
      status_date: "2026-07-29",
    });

    expect(result.budget_at_completion).toBe(0);
    expect(result.actual_cost).toBe(125);
    expect(result.tasks).toEqual([
      expect.objectContaining({
        budget_at_completion: 0,
        actual_cost: 125,
      }),
    ]);
  });

  it("rejects unsupported runtime rate units", () => {
    const invalidResource = resource();
    Object.defineProperty(invalidResource, "rate_unit", {
      value: "week",
      enumerable: true,
    });
    const result = calculateScheduleCost({
      resources: [invalidResource],
      assignments: [assignment()],
      tasks: [task()],
      status_date: "2026-07-29",
    });

    expect(result.cost_complete).toBe(false);
    expect(result.budget_at_completion).toBeNull();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_cost_fact",
        message: expect.stringContaining("unsupported rate unit"),
      }),
    ]);
  });

  it("fails loudly on invalid facts and reports missing rate, units, and dates", () => {
    const result = calculateScheduleCost({
      resources: [
        resource({ id: "invalid", standard_rate: -1 }),
        resource({ id: "no-rate", standard_rate: null }),
        resource({ id: "no-units" }),
        resource({ id: "unscheduled" }),
      ],
      assignments: [
        assignment({ id: "a", resource_id: "invalid" }),
        assignment({ id: "b", resource_id: "no-rate" }),
        assignment({
          id: "c",
          resource_id: "no-units",
          planned_units: null,
        }),
        assignment({
          id: "d",
          resource_id: "unscheduled",
          task_id: "task-2",
        }),
      ],
      tasks: [
        task(),
        task({
          id: "task-2",
          name: "Unscheduled work",
          start_date: null,
          finish_date: null,
        }),
      ],
      status_date: "2026-07-29",
    });

    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "invalid_cost_fact",
      "missing_rate",
      "missing_planned_units",
      "unscheduled_task",
    ]);
  });

  it("rejects an invalid status date", () => {
    expect(() =>
      calculateScheduleCost({
        resources: [],
        assignments: [],
        tasks: [],
        status_date: "bad-date",
      }),
    ).toThrow("status_date must be a valid ISO date");
    expect(() =>
      calculateScheduleCost({
        resources: [],
        assignments: [],
        tasks: [],
        status_date: "2026-02-30",
      }),
    ).toThrow("status_date must be a valid ISO date");
  });
});
