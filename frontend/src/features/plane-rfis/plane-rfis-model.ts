/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { RFI } from "@/types/database-extensions";

export type PlaneRfiStatusFilter = "all" | "open" | "closed";

const OPEN_RFI_STATUSES = new Set(["draft", "open", "answered"]);
const CLOSED_RFI_STATUSES = new Set(["closed", "closed-draft"]);

export function normalizePlaneRfiStatus(status: string | null): string {
  return status?.trim().toLowerCase() || "draft";
}

export function planeRfiMatchesStatus(
  rfi: Pick<RFI, "status">,
  filter: PlaneRfiStatusFilter,
): boolean {
  if (filter === "all") return true;
  const status = normalizePlaneRfiStatus(rfi.status);
  return filter === "open"
    ? OPEN_RFI_STATUSES.has(status)
    : CLOSED_RFI_STATUSES.has(status);
}

export function planeRfiMatchesQuery(
  rfi: Pick<
    RFI,
    | "number"
    | "subject"
    | "question"
    | "status"
    | "assignees"
    | "ball_in_court"
    | "rfi_manager"
  >,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    rfi.number,
    rfi.subject,
    rfi.question,
    rfi.status,
    ...(rfi.assignees ?? []),
    rfi.ball_in_court,
    rfi.rfi_manager,
  ]
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

export function filterPlaneRfis(
  rfis: RFI[],
  filter: PlaneRfiStatusFilter,
  query: string,
): RFI[] {
  return rfis
    .filter(
      (rfi) =>
        planeRfiMatchesStatus(rfi, filter) &&
        planeRfiMatchesQuery(rfi, query),
    )
    .sort((left, right) => right.number - left.number);
}

export function formatPlaneRfiIdentifier(number: number): string {
  return `RFI-${String(number).padStart(3, "0")}`;
}

export function formatPlaneRfiDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
