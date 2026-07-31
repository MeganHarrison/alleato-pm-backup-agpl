import type {
  ResourceAllocationDiagnostic,
  ResourceAllocationSummary,
  ResourceDailyAllocation,
  ScheduleResource,
  ScheduleResourceAllocationResult,
  ScheduleResourceCapacityProfile,
  ScheduleTask,
  ScheduleTaskAssignment,
} from "@/types/scheduling";
import { isWorkingDay, type ScheduleCalendar } from "./schedule-calendar";
import { buildScheduleResourceCapacityResolver } from "./schedule-resource-capacity";

const DAY_MS = 86_400_000;

export interface CalculateScheduleResourceAllocationInput {
  resources: ScheduleResource[];
  tasks: ScheduleTask[];
  assignments: ScheduleTaskAssignment[];
  capacity_profiles?: ScheduleResourceCapacityProfile[];
  calendar: ScheduleCalendar;
  range: { start: string; finish: string };
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function datesBetween(start: string, finish: string): string[] {
  const parsedStart = parseDate(start);
  const parsedFinish = parseDate(finish);
  if (!parsedStart || !parsedFinish || parsedStart > parsedFinish) {
    throw new Error("Resource allocation range must contain valid ascending schedule dates.");
  }

  const dates: string[] = [];
  for (let cursor = parsedStart; cursor <= parsedFinish; cursor = new Date(cursor.getTime() + DAY_MS)) {
    dates.push(formatDate(cursor));
  }
  return dates;
}

function diagnostic(
  code: ResourceAllocationDiagnostic["code"],
  assignment: ScheduleTaskAssignment,
): ResourceAllocationDiagnostic {
  return { code, assignment_id: assignment.id, task_id: assignment.task_id };
}

export function calculateScheduleResourceAllocation({
  resources,
  tasks,
  assignments,
  capacity_profiles = [],
  calendar,
  range,
}: CalculateScheduleResourceAllocationInput): ScheduleResourceAllocationResult {
  const dates = datesBetween(range.start, range.finish);
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const dailyByKey = new Map<string, ResourceDailyAllocation>();
  const capacityResolver = buildScheduleResourceCapacityResolver({ calendar, capacity_profiles });
  const diagnostics: ResourceAllocationDiagnostic[] = [
    ...capacityResolver.diagnostics,
    ...capacityResolver.rangeDiagnostics(range.start, range.finish),
  ];

  for (const resource of [...resources].sort((left, right) => left.id.localeCompare(right.id))) {
    const inactive = !resource.eligible
      || resource.person_status !== "active"
      || resource.membership_status !== "active";
    if (inactive) {
      diagnostics.push({
        code: "inactive_resource",
        resource_id: resource.id,
        message: `Resource ${resource.display_name} is inactive or ineligible for project scheduling.`,
      });
    }
    for (const date of dates) {
      const resolution = inactive
        ? {
            capacity_percent: 0,
            source: "resource_inactive" as const,
            reason: null,
            available: false,
          }
        : capacityResolver.resolve(resource.id, date);
      dailyByKey.set(`${resource.id}:${date}`, {
        resource_id: resource.id,
        date,
        capacity_percent: resolution.capacity_percent,
        capacity_source: resolution.source,
        capacity_reason: resolution.reason,
        assigned_percent: 0,
        available_percent: resolution.capacity_percent,
        overallocated_percent: 0,
        task_allocations: [],
      });
    }
  }

  for (const assignment of assignments) {
    const task = tasksById.get(assignment.task_id);
    const resource = resourcesById.get(assignment.resource_id);
    if (!task) {
      diagnostics.push(diagnostic("missing_task", assignment));
      continue;
    }
    if (!resource) {
      diagnostics.push(diagnostic("missing_resource", assignment));
      continue;
    }
    if (task.is_milestone) continue;

    const start = task.forecast_start_date ?? task.start_date;
    const finish = task.forecast_finish_date ?? task.finish_date;
    if (!start || !finish) {
      diagnostics.push(diagnostic("unscheduled_task", assignment));
      continue;
    }

    const parsedStart = parseDate(start);
    const parsedFinish = parseDate(finish);
    if (!parsedStart || !parsedFinish || parsedStart > parsedFinish) {
      diagnostics.push(diagnostic("invalid_date_range", assignment));
      continue;
    }

    for (const date of dates) {
      if (date < start || date > finish || !isWorkingDay(date, calendar)) continue;
      const row = dailyByKey.get(`${resource.id}:${date}`);
      if (!row) continue;
      row.assigned_percent += assignment.allocation_percent;
      row.task_allocations.push({
        task_id: task.id,
        task_name: task.name,
        allocation_percent: assignment.allocation_percent,
      });
    }
  }

  const summariesByResourceId = new Map<string, ResourceAllocationSummary>(
    [...resourcesById.keys()]
      .sort((left, right) => left.localeCompare(right))
      .map((resourceId) => [resourceId, {
        resource_id: resourceId,
        peak_assigned_percent: 0,
        overallocated_dates: [],
      }]),
  );
  const daily = [...dailyByKey.values()]
    .sort((left, right) => left.resource_id.localeCompare(right.resource_id) || left.date.localeCompare(right.date))
    .map((row) => {
      row.available_percent = Math.max(0, row.capacity_percent - row.assigned_percent);
      row.overallocated_percent = Math.max(0, row.assigned_percent - row.capacity_percent);
      row.task_allocations.sort(
        (left, right) => left.task_name.localeCompare(right.task_name) || left.task_id.localeCompare(right.task_id),
      );
      const summary = summariesByResourceId.get(row.resource_id);
      if (summary) {
        summary.peak_assigned_percent = Math.max(summary.peak_assigned_percent, row.assigned_percent);
        if (row.overallocated_percent > 0) summary.overallocated_dates.push(row.date);
      }
      return row;
    });

  const summaries = [...summariesByResourceId.values()];

  diagnostics.sort(
    (left, right) => JSON.stringify([
      left.assignment_id,
      left.code,
      left.task_id,
      left.resource_id,
      left.fact_type,
      left.key,
      left.date,
    ]).localeCompare(JSON.stringify([
      right.assignment_id,
      right.code,
      right.task_id,
      right.resource_id,
      right.fact_type,
      right.key,
      right.date,
    ])),
  );

  return { daily, summaries, diagnostics };
}
