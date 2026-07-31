/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Derived from makeplane/plane cycle grouping and progress utilities at
 * commit 39856932cd6b9bd17eab0920506d628190b47af2.
 */

import type { ScheduleTaskWithHierarchy } from "@/types/scheduling";

export type CycleGroup = "current" | "upcoming" | "completed";

export function canMutateCycles({
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

export function cycleDescendants(
  cycle: ScheduleTaskWithHierarchy,
): ScheduleTaskWithHierarchy[] {
  const descendants: ScheduleTaskWithHierarchy[] = [];
  const collect = (items: ScheduleTaskWithHierarchy[]) => {
    for (const item of items) {
      descendants.push(item);
      collect(item.children ?? []);
    }
  };
  collect(cycle.children ?? []);
  return descendants;
}

export function cycleProgress(cycle: ScheduleTaskWithHierarchy): number {
  const descendants = cycleDescendants(cycle);
  const source = descendants.length > 0 ? descendants : [cycle];
  const total = source.reduce(
    (sum, item) => sum + Math.max(0, Math.min(100, item.percent_complete ?? 0)),
    0,
  );
  return Math.round(total / source.length);
}

export function cycleGroup(
  cycle: ScheduleTaskWithHierarchy,
  today: string,
): CycleGroup {
  if (cycle.status === "complete" || cycleProgress(cycle) === 100) {
    return "completed";
  }
  if (
    cycle.start_date &&
    cycle.finish_date &&
    cycle.start_date <= today &&
    cycle.finish_date >= today
  ) {
    return "current";
  }
  return "upcoming";
}

export function countCycleWork(cycle: ScheduleTaskWithHierarchy): number {
  return cycleDescendants(cycle).length;
}

export function durationDays(startDate: string, finishDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const finish = Date.parse(`${finishDate}T00:00:00Z`);
  return Math.floor((finish - start) / 86_400_000) + 1;
}

export function dateRangesOverlap(
  startDate: string,
  finishDate: string,
  otherStartDate: string,
  otherFinishDate: string,
): boolean {
  return startDate <= otherFinishDate && finishDate >= otherStartDate;
}
