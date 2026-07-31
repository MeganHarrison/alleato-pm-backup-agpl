/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Derived from Plane's work-item layout, display-filter, and ordering contracts
 * at makeplane/plane v1.3.1. Adapted to Alleato task fields and URL state.
 * See LICENSES/NOTICE-PLANE.md and /source for corresponding source information.
 */

export const PLANE_WORK_ITEM_VIEWS = [
  "list",
  "board",
  "calendar",
  "spreadsheet",
  "gantt",
] as const;

export const PLANE_WORK_ITEM_STATUSES = [
  "open",
  "in_progress",
  "done",
] as const;

export const PLANE_WORK_ITEM_PRIORITIES = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;

export const PLANE_WORK_ITEM_DUE_FILTERS = [
  "overdue",
  "today",
  "upcoming",
  "none",
] as const;

export const PLANE_WORK_ITEM_SORTS = [
  "manual",
  "created",
  "updated",
  "due_date",
  "priority",
  "title",
] as const;

export type PlaneWorkItemView = (typeof PLANE_WORK_ITEM_VIEWS)[number];
export type PlaneWorkItemStatus = (typeof PLANE_WORK_ITEM_STATUSES)[number];
export type PlaneWorkItemPriority = (typeof PLANE_WORK_ITEM_PRIORITIES)[number];
export type PlaneWorkItemDueFilter =
  (typeof PLANE_WORK_ITEM_DUE_FILTERS)[number];
export type PlaneWorkItemSort = (typeof PLANE_WORK_ITEM_SORTS)[number];
export type PlaneWorkItemSortDirection = "asc" | "desc";

export interface PlaneWorkItemsQuery {
  view: PlaneWorkItemView;
  search: string;
  statuses: PlaneWorkItemStatus[];
  assignees: string[];
  priorities: PlaneWorkItemPriority[];
  due: PlaneWorkItemDueFilter[];
  dueFrom: string | null;
  dueTo: string | null;
  sort: PlaneWorkItemSort;
  direction: PlaneWorkItemSortDirection;
  peekId: string | null;
}

export interface PlaneWorkItemRecord {
  id: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  assignee_person_id?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  priority?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const DEFAULT_QUERY: PlaneWorkItemsQuery = {
  view: "list",
  search: "",
  statuses: [],
  assignees: [],
  priorities: [],
  due: [],
  dueFrom: null,
  dueTo: null,
  sort: "manual",
  direction: "asc",
  peekId: null,
};

function isOneOf<const T extends readonly string[]>(
  value: string | null,
  values: T,
): value is T[number] {
  return value !== null && values.includes(value);
}

function uniqueValues<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function parseList<const T extends readonly string[]>(
  value: string | null,
  allowed: T,
): T[number][] {
  if (!value) return [];
  return uniqueValues(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry): entry is T[number] => isOneOf(entry, allowed)),
  );
}

function parseAssignees(value: string | null): string[] {
  if (!value) return [];
  return uniqueValues(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function parseDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

export function parsePlaneWorkItemsQuery(
  value: URLSearchParams | string,
): PlaneWorkItemsQuery {
  const params =
    typeof value === "string"
      ? new URLSearchParams(value.startsWith("?") ? value.slice(1) : value)
      : value;
  const view = params.get("view");
  const sort = params.get("sort");
  const direction = params.get("direction");

  return {
    view: isOneOf(view, PLANE_WORK_ITEM_VIEWS) ? view : DEFAULT_QUERY.view,
    search: (params.get("q") ?? "").trim(),
    statuses: parseList(params.get("status"), PLANE_WORK_ITEM_STATUSES),
    assignees: parseAssignees(params.get("assignee")),
    priorities: parseList(params.get("priority"), PLANE_WORK_ITEM_PRIORITIES),
    due: parseList(params.get("due"), PLANE_WORK_ITEM_DUE_FILTERS),
    dueFrom: parseDateParam(params.get("due_from")),
    dueTo: parseDateParam(params.get("due_to")),
    sort: isOneOf(sort, PLANE_WORK_ITEM_SORTS) ? sort : DEFAULT_QUERY.sort,
    direction:
      direction === "desc" || direction === "asc"
        ? direction
        : DEFAULT_QUERY.direction,
    peekId: params.get("peek")?.trim() || null,
  };
}

export function serializePlaneWorkItemsQuery(
  query: PlaneWorkItemsQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.view !== DEFAULT_QUERY.view) params.set("view", query.view);
  if (query.search.trim()) params.set("q", query.search.trim());
  if (query.statuses.length)
    params.set("status", uniqueValues(query.statuses).join(","));
  if (query.assignees.length)
    params.set("assignee", uniqueValues(query.assignees).join(","));
  if (query.priorities.length)
    params.set("priority", uniqueValues(query.priorities).join(","));
  if (query.due.length) params.set("due", uniqueValues(query.due).join(","));
  if (query.dueFrom) params.set("due_from", query.dueFrom);
  if (query.dueTo) params.set("due_to", query.dueTo);
  if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort);
  if (query.direction !== DEFAULT_QUERY.direction)
    params.set("direction", query.direction);
  if (query.peekId) params.set("peek", query.peekId);
  return params;
}

export function updatePlaneWorkItemsQuery(
  current: URLSearchParams | string,
  patch: Partial<PlaneWorkItemsQuery>,
): URLSearchParams {
  return serializePlaneWorkItemsQuery({
    ...parsePlaneWorkItemsQuery(current),
    ...patch,
  });
}

function normalizeStatus(
  value: string | null | undefined,
): PlaneWorkItemStatus {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (["done", "completed", "complete", "closed"].includes(normalized ?? ""))
    return "done";
  if (
    ["in_progress", "progress", "started", "active"].includes(normalized ?? "")
  )
    return "in_progress";
  return "open";
}

function normalizePriority(
  value: string | null | undefined,
): PlaneWorkItemPriority {
  const normalized = value?.trim().toLowerCase();
  return isOneOf(normalized ?? null, PLANE_WORK_ITEM_PRIORITIES)
    ? normalized
    : "none";
}

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function matchesDueFilter(
  dueDate: string | null | undefined,
  filters: PlaneWorkItemDueFilter[],
  today: string,
): boolean {
  if (!filters.length) return true;
  const due = dateKey(dueDate);
  return filters.some((filter) => {
    if (filter === "none") return due === null;
    if (due === null) return false;
    if (filter === "overdue") return due < today;
    if (filter === "today") return due === today;
    return due > today;
  });
}

function assigneeKeys(item: PlaneWorkItemRecord): string[] {
  return [item.assignee_person_id, item.assignee_name, item.assignee_email]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().toLowerCase());
}

function textValue(item: PlaneWorkItemRecord): string {
  return [
    item.id,
    item.title,
    item.description,
    item.assignee_name,
    item.assignee_email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function compareNullable(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

const PRIORITY_RANK: Record<PlaneWorkItemPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

function compareWorkItems(
  left: PlaneWorkItemRecord,
  right: PlaneWorkItemRecord,
  sort: PlaneWorkItemSort,
): number {
  if (sort === "created")
    return compareNullable(left.created_at, right.created_at);
  if (sort === "updated")
    return compareNullable(left.updated_at, right.updated_at);
  if (sort === "due_date")
    return compareNullable(dateKey(left.due_date), dateKey(right.due_date));
  if (sort === "priority")
    return (
      PRIORITY_RANK[normalizePriority(left.priority)] -
      PRIORITY_RANK[normalizePriority(right.priority)]
    );
  if (sort === "title")
    return compareNullable(
      left.title ?? left.description,
      right.title ?? right.description,
    );
  return 0;
}

export function filterAndSortPlaneWorkItems<T extends PlaneWorkItemRecord>(
  items: readonly T[],
  query: PlaneWorkItemsQuery,
  options: { today?: string } = {},
): T[] {
  const search = query.search.trim().toLowerCase();
  const assignees = query.assignees.map((value) => value.toLowerCase());
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (search && !textValue(item).includes(search)) return false;
      if (
        query.statuses.length &&
        !query.statuses.includes(normalizeStatus(item.status))
      )
        return false;
      if (
        query.priorities.length &&
        !query.priorities.includes(normalizePriority(item.priority))
      )
        return false;
      if (!matchesDueFilter(item.due_date, query.due, today)) return false;
      const dueDate = dateKey(item.due_date);
      if (query.dueFrom && (!dueDate || dueDate < query.dueFrom)) return false;
      if (query.dueTo && (!dueDate || dueDate > query.dueTo)) return false;
      if (assignees.length) {
        const keys = assigneeKeys(item);
        const isUnassigned = keys.length === 0;
        if (
          !assignees.some(
            (assignee) =>
              (assignee === "unassigned" && isUnassigned) ||
              keys.includes(assignee),
          )
        )
          return false;
      }
      return true;
    })
    .sort((left, right) => {
      const comparison = compareWorkItems(left.item, right.item, query.sort);
      if (comparison === 0) return left.index - right.index;
      return query.direction === "desc" ? -comparison : comparison;
    })
    .map(({ item }) => item);
}
