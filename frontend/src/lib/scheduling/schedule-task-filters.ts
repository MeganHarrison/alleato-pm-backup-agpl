import { endOfDay, endOfWeek, parseISO, startOfDay, startOfWeek } from "date-fns";

import type { ScheduleTask, ScheduleTaskWithHierarchy } from "@/types/scheduling";

export type ScheduleDateFilter = "all" | "today" | "this_week";

type ScheduleTaskFilterValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export type ScheduleTaskFilterOptions = {
  dateFilter: ScheduleDateFilter;
  searchValue: string;
  activeFilters: Record<string, ScheduleTaskFilterValue>;
};

function isTaskActiveOnDate(
  task: ScheduleTask,
  range: { start: Date; end: Date },
): boolean {
  const taskStart = task.start_date ? parseISO(task.start_date) : null;
  const taskEnd = task.finish_date ? parseISO(task.finish_date) : null;

  if (!taskStart && !taskEnd) return false;
  if (taskStart && taskEnd) {
    return taskStart <= range.end && taskEnd >= range.start;
  }
  if (taskStart) {
    return taskStart >= range.start && taskStart <= range.end;
  }
  return Boolean(taskEnd && taskEnd >= range.start && taskEnd <= range.end);
}

function selectedValues(value: ScheduleTaskFilterValue): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (value === null || value === undefined || value === "") {
    return [];
  }
  return [String(value)];
}

function taskMatchesFilters(
  task: ScheduleTaskWithHierarchy,
  options: ScheduleTaskFilterOptions,
  dateRange: { start: Date; end: Date } | null,
): boolean {
  const search = options.searchValue.trim().toLowerCase();
  const searchableText = `${task.name} ${task.wbs_code ?? ""}`.toLowerCase();
  const statusValues = selectedValues(options.activeFilters.status);
  const milestoneValues = selectedValues(options.activeFilters.is_milestone);

  const matchesSearch = search.length === 0 || searchableText.includes(search);
  const matchesStatus = statusValues.length === 0 || statusValues.includes(task.status);
  const matchesMilestone =
    milestoneValues.length === 0 || milestoneValues.includes(String(task.is_milestone));
  const matchesDate = dateRange === null || isTaskActiveOnDate(task, dateRange);

  return matchesSearch && matchesStatus && matchesMilestone && matchesDate;
}

export function filterScheduleTaskHierarchy(
  tasks: ScheduleTaskWithHierarchy[],
  options: ScheduleTaskFilterOptions,
  now = new Date(),
): ScheduleTaskWithHierarchy[] {
  const hasSearch = options.searchValue.trim().length > 0;
  const hasStatusFilter = selectedValues(options.activeFilters.status).length > 0;
  const hasMilestoneFilter = selectedValues(options.activeFilters.is_milestone).length > 0;

  if (
    options.dateFilter === "all" &&
    !hasSearch &&
    !hasStatusFilter &&
    !hasMilestoneFilter
  ) {
    return tasks;
  }

  const dateRange =
    options.dateFilter === "all"
      ? null
      : options.dateFilter === "today"
        ? { start: startOfDay(now), end: endOfDay(now) }
        : {
            start: startOfWeek(now, { weekStartsOn: 1 }),
            end: endOfWeek(now, { weekStartsOn: 1 }),
          };

  const filterHierarchy = (
    hierarchy: ScheduleTaskWithHierarchy[],
  ): ScheduleTaskWithHierarchy[] =>
    hierarchy.flatMap((task) => {
      const children = filterHierarchy(task.children ?? []);
      if (taskMatchesFilters(task, options, dateRange) || children.length > 0) {
        return [{ ...task, children }];
      }
      return [];
    });

  return filterHierarchy(tasks);
}
