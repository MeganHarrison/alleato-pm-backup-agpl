import { applyScheduleBaselineComparisonToGantt, compareScheduleBaselineTasks } from "../schedule-baselines";

const calendar = {
  working_weekdays: [1, 2, 3, 4, 5],
  non_working_dates: ["2026-08-10"],
};

describe("schedule baseline comparison", () => {
  it("uses actual then forecast then planned dates and reports signed working-day variance", () => {
    const result = compareScheduleBaselineTasks(
      [{ source_task_id: "task-1", name: "Mobilize", start_date: "2026-08-07", finish_date: "2026-08-14", duration_days: 5 }],
      [{
        source_task_id: "task-1",
        name: "Mobilize",
        start_date: "2026-08-07",
        finish_date: "2026-08-14",
        duration_days: 7,
        actual_start_date: "2026-08-11",
        actual_finish_date: null,
        forecast_start_date: "2026-08-12",
        forecast_finish_date: "2026-08-18",
      }],
      calendar,
    );

    expect(result).toEqual([
      expect.objectContaining({
        source_task_id: "task-1",
        comparison_status: "changed",
        current_start_date: "2026-08-11",
        current_finish_date: "2026-08-18",
        start_variance_days: 1,
        finish_variance_days: 2,
        duration_variance_days: 2,
      }),
    ]);
  });

  it("keeps added and removed activities explicit instead of inventing zero variance", () => {
    const result = compareScheduleBaselineTasks(
      [{ source_task_id: "removed", name: "Removed", start_date: "2026-08-03", finish_date: "2026-08-04", duration_days: 2 }],
      [{ source_task_id: "added", name: "Added", start_date: "2026-08-05", finish_date: "2026-08-06", duration_days: 2 }],
      calendar,
    );

    expect(result).toEqual([
      expect.objectContaining({ source_task_id: "removed", comparison_status: "removed", start_variance_days: null }),
      expect.objectContaining({ source_task_id: "added", comparison_status: "added", finish_variance_days: null }),
    ]);
  });

  it("draws the effective current dates only while Tracking Gantt is enabled", () => {
    const item = {
      id: "task-1", name: "Mobilize", start_date: "2026-08-07", finish_date: "2026-08-14",
      duration_days: 5, percent_complete: 20, status: "in_progress" as const, is_milestone: false,
      parent_task_id: null, level: 0, dependencies: [], is_overdue: false,
    };
    const comparison = compareScheduleBaselineTasks(
      [{ source_task_id: "task-1", name: "Mobilize", start_date: "2026-08-07", finish_date: "2026-08-14", duration_days: 5 }],
      [{ ...item, source_task_id: "task-1", forecast_start_date: "2026-08-12", forecast_finish_date: "2026-08-18", duration_days: 7 }],
      calendar,
    );

    expect(applyScheduleBaselineComparisonToGantt([item], comparison, false)[0]).toMatchObject({ start_date: "2026-08-07", finish_date: "2026-08-14" });
    expect(applyScheduleBaselineComparisonToGantt([item], comparison, true)[0]).toMatchObject({
      start_date: "2026-08-12",
      finish_date: "2026-08-18",
      duration_days: 7,
      comparison_status: "changed",
    });
  });
});
