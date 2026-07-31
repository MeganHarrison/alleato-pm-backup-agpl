/**
 * Adapted from Plane's issue list filtering and row presentation model at
 * revision 39856932cd6b9bd17eab0920506d628190b47af2.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SubmittalSummary } from "@/hooks/use-submittals";

export const SUBMITTAL_STATUSES = [
  "all",
  "Draft",
  "Open",
  "Distributed",
  "Closed",
] as const;

export type SubmittalStatusFilter = (typeof SUBMITTAL_STATUSES)[number];

export function filterSubmittals(
  submittals: readonly SubmittalSummary[],
  query: string,
  status: SubmittalStatusFilter,
): SubmittalSummary[] {
  const normalizedQuery = query.trim().toLowerCase();

  return submittals.filter((submittal) => {
    if (status !== "all" && submittal.status !== status) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      submittal.submittal_number,
      submittal.title,
      submittal.specification_section,
      submittal.ball_in_court,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery));
  });
}

export function displaySubmittalType(
  type: SubmittalSummary["submittal_type"],
): string {
  if (!type) return "No type";
  return typeof type === "string" ? type : type.name;
}

export function displaySubmittalDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
