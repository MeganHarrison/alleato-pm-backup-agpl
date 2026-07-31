/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ScheduleTaskWithHierarchy } from "@/types/scheduling";

import {
  canMutateModules,
  formatModuleDateRange,
  moduleChildCount,
  normalizeModuleProgress,
} from "./module-model";

function task(
  overrides: Partial<ScheduleTaskWithHierarchy> = {},
): ScheduleTaskWithHierarchy {
  return {
    id: "module-1",
    project_id: 42,
    parent_task_id: null,
    name: "Mobilization",
    start_date: null,
    finish_date: null,
    duration_days: null,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 1,
    created_at: "2026-07-30T00:00:00Z",
    updated_at: "2026-07-30T00:00:00Z",
    children: [],
    level: 0,
    ...overrides,
  };
}

describe("plane module model", () => {
  it("fails closed unless the server gate and project write permission both allow mutations", () => {
    expect(
      canMutateModules({
        allowMutations: false,
        permissionsLoading: false,
        hasWritePermission: true,
      }),
    ).toBe(false);
    expect(
      canMutateModules({
        allowMutations: true,
        permissionsLoading: true,
        hasWritePermission: true,
      }),
    ).toBe(false);
    expect(
      canMutateModules({
        allowMutations: true,
        permissionsLoading: false,
        hasWritePermission: false,
      }),
    ).toBe(false);
    expect(
      canMutateModules({
        allowMutations: true,
        permissionsLoading: false,
        hasWritePermission: true,
      }),
    ).toBe(true);
  });

  it("counts all descendant schedule tasks", () => {
    expect(
      moduleChildCount(
        task({
          children: [
            task({ id: "child-1" }),
            task({
              id: "child-2",
              children: [task({ id: "grandchild-1" })],
            }),
          ],
        }),
      ),
    ).toBe(3);
  });

  it("clamps invalid progress to the supported range", () => {
    expect(normalizeModuleProgress(task({ percent_complete: -10 }))).toBe(0);
    expect(normalizeModuleProgress(task({ percent_complete: 54.6 }))).toBe(55);
    expect(normalizeModuleProgress(task({ percent_complete: 110 }))).toBe(100);
  });

  it("formats complete and partial date ranges", () => {
    expect(formatModuleDateRange("2026-07-01", "2026-07-31")).toBe(
      "Jul 1, 2026 to Jul 31, 2026",
    );
    expect(formatModuleDateRange(null, "2026-08-15")).toBe("Due Aug 15, 2026");
    expect(formatModuleDateRange(null, null)).toBe("Dates not set");
  });
});
