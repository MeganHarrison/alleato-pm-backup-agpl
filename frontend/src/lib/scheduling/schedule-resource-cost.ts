import {
  defaultScheduleCalendar,
  workingDayDuration,
  type ScheduleCalendar,
} from "@/lib/scheduling/schedule-calendar";
import type { ScheduleTask } from "@/types/scheduling";

export interface ScheduleCostResource {
  id: string;
  display_name: string;
  standard_rate?: number | null;
  cost_per_use?: number | null;
  rate_unit?: "hour" | "day" | "unit" | null;
}

export interface ScheduleCostAssignment {
  id: string;
  task_id: string;
  resource_id: string;
  planned_units?: number | null;
  actual_units?: number | null;
  actual_rate?: number | null;
  actual_cost?: number | null;
}

export type ScheduleCostDiagnosticCode =
  | "missing_task"
  | "missing_resource"
  | "missing_rate"
  | "missing_rate_unit"
  | "missing_planned_units"
  | "missing_actual_units"
  | "invalid_cost_fact"
  | "unscheduled_task";

export interface ScheduleCostDiagnostic {
  code: ScheduleCostDiagnosticCode;
  message: string;
  task_id?: string;
  resource_id?: string;
  assignment_id?: string;
}

export interface ScheduleTaskCostSummary {
  task_id: string;
  task_name: string;
  budget_at_completion: number;
  planned_value: number | null;
  earned_value: number;
  actual_cost: number | null;
  cost_variance: number | null;
  schedule_variance: number | null;
  cost_performance_index: number | null;
  schedule_performance_index: number | null;
}

export interface ScheduleCostSummary {
  status_date: string;
  budget_at_completion: number | null;
  planned_value: number | null;
  earned_value: number | null;
  actual_cost: number | null;
  cost_variance: number | null;
  schedule_variance: number | null;
  cost_performance_index: number | null;
  schedule_performance_index: number | null;
  cost_complete: boolean;
  schedule_complete: boolean;
  actual_cost_complete: boolean;
  tasks: ScheduleTaskCostSummary[];
  diagnostics: ScheduleCostDiagnostic[];
}

interface CalculateScheduleCostInput {
  resources: ScheduleCostResource[];
  assignments: ScheduleCostAssignment[];
  tasks: ScheduleTask[];
  status_date: string;
  calendar?: ScheduleCalendar;
}

const MONEY_PRECISION = 100;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * MONEY_PRECISION) / MONEY_PRECISION;
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator + Number.EPSILON) * 1000) / 1000;
}

function parseDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? parsed.getTime()
    : Number.NaN;
}

function plannedProgress(
  task: ScheduleTask,
  statusDate: string,
  calendar: ScheduleCalendar,
): number | null {
  const start = task.start_date;
  const finish = task.finish_date;
  if (!start || !finish) return null;
  const startTime = parseDate(start);
  const finishTime = parseDate(finish);
  const statusTime = parseDate(statusDate);
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(finishTime) ||
    !Number.isFinite(statusTime) ||
    finishTime < startTime
  ) {
    return null;
  }
  if (statusTime < startTime) return 0;
  if (statusTime >= finishTime) return 1;
  const totalDays = workingDayDuration(start, finish, calendar);
  const elapsedDays = workingDayDuration(start, statusDate, calendar);
  return Math.min(1, elapsedDays / totalDays);
}

function assignmentPlannedCost(
  assignment: ScheduleCostAssignment,
  resource: ScheduleCostResource,
): number | null {
  const rate = resource.standard_rate;
  const units = assignment.planned_units;
  if (
    rate === null ||
    rate === undefined ||
    units === null ||
    units === undefined
  ) {
    return null;
  }
  const costPerUse = resource.cost_per_use ?? 0;
  return roundMoney(rate * units + (units > 0 ? costPerUse : 0));
}

function assignmentActualCost(
  assignment: ScheduleCostAssignment,
  resource: ScheduleCostResource,
): number | null {
  if (
    assignment.actual_cost !== null &&
    assignment.actual_cost !== undefined
  ) {
    return roundMoney(assignment.actual_cost);
  }
  const rate = assignment.actual_rate ?? resource.standard_rate;
  const units = assignment.actual_units;
  if (
    rate === null ||
    rate === undefined ||
    units === null ||
    units === undefined
  ) {
    return null;
  }
  const costPerUse = resource.cost_per_use ?? 0;
  return roundMoney(rate * units + (units > 0 ? costPerUse : 0));
}

function hasInvalidCostFact(
  assignment: ScheduleCostAssignment,
  resource: ScheduleCostResource,
): boolean {
  return [
    resource.standard_rate,
    resource.cost_per_use,
    assignment.planned_units,
    assignment.actual_units,
    assignment.actual_rate,
    assignment.actual_cost,
  ].some(
    (value) =>
      value !== null &&
      value !== undefined &&
      (!Number.isFinite(value) || value < 0),
  );
}

export function calculateScheduleCost(
  input: CalculateScheduleCostInput,
): ScheduleCostSummary {
  const calendar = input.calendar ?? defaultScheduleCalendar;
  if (!Number.isFinite(parseDate(input.status_date))) {
    throw new Error("Schedule cost status_date must be a valid ISO date.");
  }

  const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
  const resourcesById = new Map(
    input.resources.map((resource) => [resource.id, resource]),
  );
  const costsByTask = new Map<
    string,
    {
      planned: number;
      actual: number;
      assignmentCount: number;
      actualAssignmentCount: number;
    }
  >();
  const diagnostics: ScheduleCostDiagnostic[] = [];
  const incompleteCostTaskIds = new Set<string>();
  let hasUnattributedCostFact = false;

  for (const assignment of input.assignments) {
    const task = tasksById.get(assignment.task_id);
    const resource = resourcesById.get(assignment.resource_id);
    if (!task) {
      hasUnattributedCostFact = true;
      diagnostics.push({
        code: "missing_task",
        message: `Cost assignment ${assignment.id} references a missing task.`,
        task_id: assignment.task_id,
        resource_id: assignment.resource_id,
        assignment_id: assignment.id,
      });
      continue;
    }
    if (!resource) {
      incompleteCostTaskIds.add(task.id);
      diagnostics.push({
        code: "missing_resource",
        message: `Cost assignment ${assignment.id} references a missing resource.`,
        task_id: assignment.task_id,
        resource_id: assignment.resource_id,
        assignment_id: assignment.id,
      });
      continue;
    }
    if (hasInvalidCostFact(assignment, resource)) {
      incompleteCostTaskIds.add(task.id);
      diagnostics.push({
        code: "invalid_cost_fact",
        message: `Invalid cost fact for ${resource.display_name} on ${task.name}.`,
        task_id: task.id,
        resource_id: resource.id,
        assignment_id: assignment.id,
      });
      continue;
    }
    if (!resource.rate_unit) {
      incompleteCostTaskIds.add(task.id);
      diagnostics.push({
        code: "missing_rate_unit",
        message: `${resource.display_name} needs a rate unit before planned cost can be calculated.`,
        task_id: task.id,
        resource_id: resource.id,
        assignment_id: assignment.id,
      });
      continue;
    }
    if (!["hour", "day", "unit"].includes(resource.rate_unit)) {
      incompleteCostTaskIds.add(task.id);
      diagnostics.push({
        code: "invalid_cost_fact",
        message: `${resource.display_name} has an unsupported rate unit.`,
        task_id: task.id,
        resource_id: resource.id,
        assignment_id: assignment.id,
      });
      continue;
    }
    if (resource.standard_rate === null || resource.standard_rate === undefined) {
      incompleteCostTaskIds.add(task.id);
      diagnostics.push({
        code: "missing_rate",
        message: `${resource.display_name} needs a standard rate before planned cost can be calculated.`,
        task_id: task.id,
        resource_id: resource.id,
        assignment_id: assignment.id,
      });
      continue;
    }
    if (
      assignment.planned_units === null ||
      assignment.planned_units === undefined
    ) {
      incompleteCostTaskIds.add(task.id);
      diagnostics.push({
        code: "missing_planned_units",
        message: `${task.name} needs planned ${resource.rate_unit ?? "units"} for ${resource.display_name}.`,
        task_id: task.id,
        resource_id: resource.id,
        assignment_id: assignment.id,
      });
      continue;
    }

    const planned = assignmentPlannedCost(assignment, resource);
    if (planned === null) {
      incompleteCostTaskIds.add(task.id);
      diagnostics.push({
        code: "invalid_cost_fact",
        message: `Planned cost could not be resolved for ${resource.display_name} on ${task.name}.`,
        task_id: task.id,
        resource_id: resource.id,
        assignment_id: assignment.id,
      });
      continue;
    }
    const actual = assignmentActualCost(assignment, resource);
    if (actual === null) {
      diagnostics.push({
        code: "missing_actual_units",
        message: `${task.name} has no actual units or actual cost for ${resource.display_name}.`,
        task_id: task.id,
        resource_id: resource.id,
        assignment_id: assignment.id,
      });
    }
    const current = costsByTask.get(task.id) ?? {
      planned: 0,
      actual: 0,
      assignmentCount: 0,
      actualAssignmentCount: 0,
    };
    current.planned = roundMoney(current.planned + planned);
    current.assignmentCount += 1;
    if (actual !== null) {
      current.actual = roundMoney(current.actual + actual);
      current.actualAssignmentCount += 1;
    }
    costsByTask.set(task.id, current);
  }

  const taskSummaries: ScheduleTaskCostSummary[] = [];
  for (const task of input.tasks) {
    const cost = costsByTask.get(task.id);
    if (!cost || incompleteCostTaskIds.has(task.id)) continue;
    const progress = plannedProgress(task, input.status_date, calendar);
    if (progress === null) {
      diagnostics.push({
        code: "unscheduled_task",
        message: `${task.name} needs valid start and finish dates before planned value can be calculated.`,
        task_id: task.id,
      });
    }
    const plannedValue =
      progress === null ? null : roundMoney(cost.planned * progress);
    const earnedValue = roundMoney(
      cost.planned * Math.min(100, Math.max(0, task.percent_complete)) / 100,
    );
    const actualCost =
      cost.assignmentCount > 0 &&
      cost.actualAssignmentCount === cost.assignmentCount
        ? roundMoney(cost.actual)
        : null;
    taskSummaries.push({
      task_id: task.id,
      task_name: task.name,
      budget_at_completion: cost.planned,
      planned_value: plannedValue,
      earned_value: earnedValue,
      actual_cost: actualCost,
      cost_variance:
        actualCost === null ? null : roundMoney(earnedValue - actualCost),
      schedule_variance:
        plannedValue === null
          ? null
          : roundMoney(earnedValue - plannedValue),
      cost_performance_index:
        actualCost === null ? null : safeRatio(earnedValue, actualCost),
      schedule_performance_index:
        plannedValue === null ? null : safeRatio(earnedValue, plannedValue),
    });
  }

  const totals = taskSummaries.reduce(
    (sum, task) => ({
      bac: sum.bac + task.budget_at_completion,
      pv: sum.pv + (task.planned_value ?? 0),
      ev: sum.ev + task.earned_value,
      ac: sum.ac + (task.actual_cost ?? 0),
      actualComplete: sum.actualComplete && task.actual_cost !== null,
      scheduleComplete:
        sum.scheduleComplete && task.planned_value !== null,
    }),
    {
      bac: 0,
      pv: 0,
      ev: 0,
      ac: 0,
      actualComplete: taskSummaries.length > 0,
      scheduleComplete: taskSummaries.length > 0,
    },
  );
  const costComplete =
    !hasUnattributedCostFact && incompleteCostTaskIds.size === 0;
  const actualCostComplete = costComplete && totals.actualComplete;
  const scheduleComplete = costComplete && totals.scheduleComplete;
  const earnedValue = costComplete ? roundMoney(totals.ev) : null;
  const plannedValue = scheduleComplete ? roundMoney(totals.pv) : null;
  const actualCost = actualCostComplete ? roundMoney(totals.ac) : null;

  return {
    status_date: input.status_date,
    budget_at_completion: costComplete ? roundMoney(totals.bac) : null,
    planned_value: plannedValue,
    earned_value: earnedValue,
    actual_cost: actualCost,
    cost_variance:
      actualCost === null || earnedValue === null
        ? null
        : roundMoney(earnedValue - actualCost),
    schedule_variance:
      plannedValue === null || earnedValue === null
        ? null
        : roundMoney(earnedValue - plannedValue),
    cost_performance_index:
      actualCost === null || earnedValue === null
        ? null
        : safeRatio(earnedValue, actualCost),
    schedule_performance_index:
      plannedValue === null || earnedValue === null
        ? null
        : safeRatio(earnedValue, plannedValue),
    cost_complete: costComplete,
    schedule_complete: scheduleComplete,
    actual_cost_complete: actualCostComplete,
    tasks: taskSummaries,
    diagnostics,
  };
}
