/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import type { ScheduleTaskWithHierarchy } from "@/types/scheduling";
import { ScheduleTimelineView } from "../schedule-views";

function task(
  id: string,
  name: string,
  startDate: string,
  finishDate: string,
): ScheduleTaskWithHierarchy {
  return {
    id,
    project_id: 67,
    parent_task_id: null,
    name,
    start_date: startDate,
    finish_date: finishDate,
    duration_days: null,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 1,
    created_at: "2026-07-29T00:00:00Z",
    updated_at: "2026-07-29T00:00:00Z",
    children: [],
    level: 0,
  };
}

describe("ScheduleTimelineView visible interval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-30T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderTimeline(tasks: ScheduleTaskWithHierarchy[]) {
    render(
      <ScheduleTimelineView
        tasks={tasks}
        selectedIds={new Set()}
        onSelectionChange={jest.fn()}
        onTaskClick={jest.fn()}
        onAddTask={jest.fn()}
        onQuickAddTask={jest.fn()}
        onEditTask={jest.fn()}
        onDeleteTask={jest.fn()}
        onUpdateTask={jest.fn().mockResolvedValue(undefined)}
        isLoading={false}
      />,
    );
  }

  it("does not draw tasks that finish before the visible window", () => {
    renderTimeline([
      task(
        "11111111-1111-4111-8111-111111111111",
        "Finished before window",
        "2025-12-02",
        "2026-03-23",
      ),
    ]);

    expect(screen.queryByTitle("Finished before window")).not.toBeInTheDocument();
  });

  it("does not draw tasks that start after the visible window", () => {
    renderTimeline([
      task(
        "22222222-2222-4222-8222-222222222222",
        "Starts after window",
        "2026-11-01",
        "2026-11-05",
      ),
    ]);

    expect(screen.queryByTitle("Starts after window")).not.toBeInTheDocument();
  });

  it("clips a task to the visible left boundary", () => {
    renderTimeline([
      task(
        "33333333-3333-4333-8333-333333333333",
        "Overlaps left boundary",
        "2026-06-01",
        "2026-07-05",
      ),
    ]);

    expect(screen.getByTitle("Overlaps left boundary")).toHaveStyle({
      left: "0%",
      width: `${(8 / 112) * 100}%`,
    });
  });

  it("clips a task to the visible right boundary", () => {
    renderTimeline([
      task(
        "44444444-4444-4444-8444-444444444444",
        "Overlaps right boundary",
        "2026-10-15",
        "2026-11-01",
      ),
    ]);

    expect(screen.getByTitle("Overlaps right boundary")).toHaveStyle({
      left: `${(109 / 112) * 100}%`,
      width: `${(3 / 112) * 100}%`,
    });
  });

  it("draws a milestone on the first visible day as one visible day", () => {
    const milestone = task(
      "55555555-5555-4555-8555-555555555555",
      "Window opening milestone",
      "2026-06-28",
      "2026-06-28",
    );
    milestone.is_milestone = true;
    renderTimeline([milestone]);

    expect(screen.getByTitle("Window opening milestone")).toHaveStyle({
      left: "0%",
      width: `${(1 / 112) * 100}%`,
    });
  });

  it("draws a task on the final visible day without overflowing the window", () => {
    renderTimeline([
      task(
        "66666666-6666-4666-8666-666666666666",
        "Final visible day",
        "2026-10-17",
        "2026-10-17",
      ),
    ]);

    expect(screen.getByTitle("Final visible day")).toHaveStyle({
      left: `${(111 / 112) * 100}%`,
      width: `${(1 / 112) * 100}%`,
    });
  });

  it("keeps the fall DST window on calendar-week boundaries", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      "America/Indianapolis",
    );
    jest.setSystemTime(new Date("2026-11-15T12:00:00-05:00"));
    renderTimeline([
      task(
        "77777777-7777-4777-8777-777777777777",
        "Fall final visible day",
        "2027-01-30",
        "2027-01-30",
      ),
      task(
        "88888888-8888-4888-8888-888888888888",
        "Fall excluded day",
        "2027-01-31",
        "2027-01-31",
      ),
    ]);

    expect(screen.getByTitle("Fall final visible day")).toHaveStyle({
      left: `${(111 / 112) * 100}%`,
      width: `${(1 / 112) * 100}%`,
    });
    expect(screen.queryByTitle("Fall excluded day")).not.toBeInTheDocument();
  });

  it("keeps the spring DST window on calendar-week boundaries", () => {
    jest.setSystemTime(new Date("2027-03-15T12:00:00-04:00"));
    renderTimeline([
      task(
        "99999999-9999-4999-8999-999999999999",
        "Spring final visible day",
        "2027-06-05",
        "2027-06-05",
      ),
      task(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "Spring excluded day",
        "2027-06-06",
        "2027-06-06",
      ),
    ]);

    expect(screen.getByTitle("Spring final visible day")).toHaveStyle({
      left: `${(111 / 112) * 100}%`,
      width: `${(1 / 112) * 100}%`,
    });
    expect(screen.queryByTitle("Spring excluded day")).not.toBeInTheDocument();
  });
});
