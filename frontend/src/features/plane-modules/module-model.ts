/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted from Plane v1.3.1 module list progress and status templates.
 */

import type {
  ScheduleTask,
  ScheduleTaskWithHierarchy,
  TaskStatus,
} from "@/types/scheduling";

export const MODULE_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Planned",
  in_progress: "In progress",
  complete: "Completed",
};

export const MODULE_STATUS_OPTIONS = (
  Object.entries(MODULE_STATUS_LABELS) as Array<[TaskStatus, string]>
).map(([value, label]) => ({ value, label }));

export function canMutateModules({
  allowMutations,
  permissionsLoading,
  hasWritePermission,
}: {
  allowMutations: boolean;
  permissionsLoading: boolean;
  hasWritePermission: boolean;
}): boolean {
  return allowMutations && !permissionsLoading && hasWritePermission;
}

export function moduleChildCount(module: ScheduleTaskWithHierarchy): number {
  return module.children.reduce(
    (total, child) => total + 1 + moduleChildCount(child),
    0,
  );
}

export function normalizeModuleProgress(task: ScheduleTask): number {
  const value = Number(task.percent_complete);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function formatModuleDateRange(
  startDate: string | null,
  finishDate: string | null,
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const format = (value: string | null) => {
    if (!value) return null;
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : formatter.format(date);
  };
  const start = format(startDate);
  const finish = format(finishDate);

  if (start && finish) return `${start} to ${finish}`;
  if (start) return `Starts ${start}`;
  if (finish) return `Due ${finish}`;
  return "Dates not set";
}
