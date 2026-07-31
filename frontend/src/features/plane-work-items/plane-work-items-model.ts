/**
 * Adapted from Plane's issue-state and issue-identifier presentation model.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md and /source for corresponding source information.
 */

import { type TasksRow } from "@/features/tasks/task-utils";

export type PlaneWorkItemStatus = "open" | "in_progress" | "done";

export function normalizePlaneWorkItemStatus(
  status: string | null,
): PlaneWorkItemStatus {
  const normalized = (status ?? "").toLowerCase();
  if (["done", "complete", "completed", "closed", "cancelled"].includes(normalized)) {
    return "done";
  }
  if (["in_progress", "started", "active"].includes(normalized)) {
    return "in_progress";
  }
  return "open";
}

export function planeWorkItemStatusLabel(status: string | null) {
  const normalized = normalizePlaneWorkItemStatus(status);
  if (normalized === "in_progress") return "In progress";
  if (normalized === "done") return "Done";
  return "Backlog";
}

export function planeWorkItemTitle(task: TasksRow) {
  return task.description || task.title || "Untitled work item";
}

export function planeWorkItemIdentifier(task: TasksRow, index: number) {
  const sequence = task.id?.replace(/\D/g, "").slice(-3);
  return `ALLEATO-${sequence || index + 1}`;
}
