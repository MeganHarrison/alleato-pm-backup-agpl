import type { ScheduleTaskWithHierarchy } from "@/types/scheduling";

import {
  canMutateCycles,
  countCycleWork,
  cycleGroup,
  cycleProgress,
  dateRangesOverlap,
  durationDays,
} from "../cycle-model";

function task(
  overrides: Partial<ScheduleTaskWithHierarchy> = {},
): ScheduleTaskWithHierarchy {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Cycle",
    project_id: 31,
    parent_task_id: null,
    status: "not_started",
    percent_complete: 0,
    start_date: null,
    finish_date: null,
    children: [],
    ...overrides,
  } as ScheduleTaskWithHierarchy;
}

describe("Plane cycle model", () => {
  it("requires both the server mutation gate and schedule write permission", () => {
    expect(
      canMutateCycles({
        allowMutations: false,
        permissionsLoading: false,
        hasWritePermission: true,
      }),
    ).toBe(false);
    expect(
      canMutateCycles({
        allowMutations: true,
        permissionsLoading: true,
        hasWritePermission: true,
      }),
    ).toBe(false);
    expect(
      canMutateCycles({
        allowMutations: true,
        permissionsLoading: false,
        hasWritePermission: false,
      }),
    ).toBe(false);
    expect(
      canMutateCycles({
        allowMutations: true,
        permissionsLoading: false,
        hasWritePermission: true,
      }),
    ).toBe(true);
  });

  it("derives progress and recursive work count from contained work items", () => {
    const cycle = task({
      children: [
        task({ id: "a", percent_complete: 100 }),
        task({
          id: "b",
          percent_complete: 0,
          children: [task({ id: "c", percent_complete: 50 })],
        }),
      ],
    });
    expect(countCycleWork(cycle)).toBe(3);
    expect(cycleProgress(cycle)).toBe(50);
  });

  it("groups active, upcoming, and completed cycles", () => {
    expect(
      cycleGroup(
        task({ start_date: "2026-07-01", finish_date: "2026-07-31" }),
        "2026-07-30",
      ),
    ).toBe("current");
    expect(cycleGroup(task({ start_date: "2026-08-01" }), "2026-07-30")).toBe(
      "upcoming",
    );
    expect(cycleGroup(task({ status: "complete" }), "2026-07-30")).toBe(
      "completed",
    );
  });

  it("calculates inclusive duration and overlap boundaries", () => {
    expect(durationDays("2026-07-01", "2026-07-01")).toBe(1);
    expect(
      dateRangesOverlap("2026-07-01", "2026-07-15", "2026-07-15", "2026-07-31"),
    ).toBe(true);
    expect(
      dateRangesOverlap("2026-07-01", "2026-07-14", "2026-07-15", "2026-07-31"),
    ).toBe(false);
  });
});
