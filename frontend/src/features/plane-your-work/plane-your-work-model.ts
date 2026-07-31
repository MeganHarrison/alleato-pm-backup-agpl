/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { TasksRow } from "@/features/tasks/task-utils";
import type { TaskStatusValue } from "@/features/tasks/task-values";

export type PlaneYourWorkScope = "mine" | "all";
export type PlaneYourWorkStatusFilter = "open" | "done";

const DONE_STATUSES = new Set(["complete", "closed", "done", "cancelled"]);
const IN_PROGRESS_STATUSES = new Set(["in_progress", "started", "active"]);

export function normalizePlaneTaskStatus(
  status: string | null,
): TaskStatusValue {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (DONE_STATUSES.has(normalized)) {
    return normalized === "cancelled" ? "cancelled" : "done";
  }
  if (IN_PROGRESS_STATUSES.has(normalized)) return "in_progress";
  if (normalized === "blocked") return "blocked";
  return "open";
}

export function isPlaneTaskDone(task: Pick<TasksRow, "status">): boolean {
  const status = normalizePlaneTaskStatus(task.status);
  return status === "done" || status === "cancelled";
}

export function planeTaskMatchesQuery(
  task: TasksRow,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    task.title,
    task.description,
    task.project_name,
    task.assignee_name,
    task.assignee_email,
    task.priority,
    task.status,
    task.source_title,
    task.meeting_title,
  ]
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

export function filterPlaneYourWorkTasks(
  tasks: TasksRow[],
  statusFilter: PlaneYourWorkStatusFilter,
  projectFilter: string,
  query: string,
): TasksRow[] {
  return tasks.filter((task) => {
    const done = isPlaneTaskDone(task);
    if (statusFilter === "done" ? !done : done) return false;

    const projectId = task.project_id ?? task.project_ids?.[0] ?? null;
    if (
      projectFilter !== "all" &&
      (projectFilter === "unscoped"
        ? projectId !== null
        : String(projectId) !== projectFilter)
    ) {
      return false;
    }

    return planeTaskMatchesQuery(task, query);
  });
}

export interface PlaneTaskGroup {
  key: string;
  label: string;
  tasks: TasksRow[];
}

export function groupPlaneTasksByProject(tasks: TasksRow[]): PlaneTaskGroup[] {
  const groups = new Map<string, PlaneTaskGroup>();

  for (const task of tasks) {
    const projectId = task.project_id ?? task.project_ids?.[0] ?? null;
    const key = projectId === null ? "unscoped" : String(projectId);
    const label =
      task.project_name?.trim() ||
      (projectId === null ? "No project" : `Project ${projectId}`);
    const current = groups.get(key);
    if (current) {
      current.tasks.push(task);
    } else {
      groups.set(key, { key, label, tasks: [task] });
    }
  }

  return [...groups.values()].sort((left, right) => {
    if (left.key === "unscoped") return 1;
    if (right.key === "unscoped") return -1;
    return left.label.localeCompare(right.label);
  });
}

export function formatPlaneTaskDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
