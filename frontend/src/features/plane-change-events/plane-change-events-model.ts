/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ChangeEvent } from "@/types/change-events";

export type PlaneChangeEventDataTab =
  | "all"
  | "line_items"
  | "no_line_items"
  | "rfqs";

export function formatPlaneChangeEventIdentifier(
  event: Pick<ChangeEvent, "id" | "number">,
): string {
  return event.number?.trim() || `CE-${String(event.id)}`;
}

export function formatPlaneChangeEventDate(value: string | null): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function changeEventMatchesQuery(
  event: ChangeEvent,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    event.number,
    event.title,
    event.status,
    event.scope,
    event.type,
    event.reason,
    event.origin,
    event.description,
    event.prime_pco,
    event.prime_pco_title,
    event.rfq_title,
    event.commitment_title,
  ]
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

export function filterPlaneChangeEvents(
  events: ChangeEvent[],
  query: string,
): ChangeEvent[] {
  return events.filter((event) => changeEventMatchesQuery(event, query));
}
