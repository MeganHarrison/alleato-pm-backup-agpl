/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Adapted from Plane v1.3.1 project Views filter behavior.
 */

import type { SavedViewFilterValue } from "@/hooks/use-saved-table-views";

export const PROJECT_TASK_VIEW_FILTER_KEYS = [
  "view",
  "status",
  "priority",
  "due_date_from",
  "due_date_to",
  "description",
  "access",
] as const;

export type ProjectTaskViewFilterKey =
  (typeof PROJECT_TASK_VIEW_FILTER_KEYS)[number];

export type ProjectTaskViewFilters = Record<
  ProjectTaskViewFilterKey,
  SavedViewFilterValue
>;

export const DEFAULT_PROJECT_TASK_VIEW_FILTERS: ProjectTaskViewFilters = {
  view: "list",
  status: "open",
  priority: null,
  due_date_from: null,
  due_date_to: null,
  description: null,
  access: "private",
};

function nonEmptyString(
  value: SavedViewFilterValue | undefined,
): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeProjectTaskViewFilters(
  filters: Record<string, SavedViewFilterValue> | null | undefined,
): ProjectTaskViewFilters {
  const status = nonEmptyString(filters?.status);
  const view = nonEmptyString(filters?.view);
  const priority = nonEmptyString(filters?.priority);
  const dueDateFrom = nonEmptyString(filters?.due_date_from);
  const dueDateTo = nonEmptyString(filters?.due_date_to);
  const description = nonEmptyString(filters?.description);

  return {
    view: view === "board" ? "board" : "list",
    status: status === "done" ? "done" : "open",
    priority:
      priority && ["low", "medium", "high", "urgent"].includes(priority)
        ? priority
        : null,
    due_date_from: dueDateFrom,
    due_date_to: dueDateTo,
    description,
    access: "private",
  };
}

export function projectTaskViewFiltersFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): ProjectTaskViewFilters {
  return normalizeProjectTaskViewFilters({
    view: searchParams.get("view"),
    status: searchParams.get("status"),
    priority: searchParams.get("priority"),
    due_date_from: searchParams.get("due_from"),
    due_date_to: searchParams.get("due_to"),
  });
}

export function applyProjectTaskViewFiltersToSearchParams(
  current: URLSearchParams,
  filters: Record<string, SavedViewFilterValue> | null | undefined,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const normalized = normalizeProjectTaskViewFilters(filters);

  next.set("view", normalized.view === "board" ? "board" : "list");

  if (normalized.status === "done") next.set("status", "done");
  else next.delete("status");

  const entries: Array<
    [ProjectTaskViewFilterKey, "priority" | "due_from" | "due_to"]
  > = [
    ["priority", "priority"],
    ["due_date_from", "due_from"],
    ["due_date_to", "due_to"],
  ];

  entries.forEach(([filterKey, queryKey]) => {
    const value = nonEmptyString(normalized[filterKey]);
    if (value) next.set(queryKey, value);
    else next.delete(queryKey);
  });

  next.delete("task");
  return next;
}

export function describeProjectTaskViewFilters(
  filters: Record<string, SavedViewFilterValue> | null | undefined,
): string {
  const normalized = normalizeProjectTaskViewFilters(filters);
  const parts = [normalized.status === "done" ? "Done" : "Open"];

  const priority = nonEmptyString(normalized.priority);
  if (priority) {
    parts.push(
      `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`,
    );
  }

  const dueFrom = nonEmptyString(normalized.due_date_from);
  const dueTo = nonEmptyString(normalized.due_date_to);
  if (dueFrom && dueTo) parts.push(`${dueFrom} to ${dueTo}`);
  else if (dueFrom) parts.push(`Due after ${dueFrom}`);
  else if (dueTo) parts.push(`Due by ${dueTo}`);

  // Keep the source ASCII-only so Windows tooling cannot reinterpret the
  // separator as a visible mojibake sequence.
  return parts.join(" \u00b7 ");
}
