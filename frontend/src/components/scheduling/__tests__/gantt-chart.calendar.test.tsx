/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

import { GanttChart } from "../gantt-chart";
import type { GanttChartItem } from "@/types/scheduling";

const task: GanttChartItem = {
  id: "calendar-task",
  name: "Calendar-aware task",
  start_date: "2026-08-10",
  finish_date: "2026-08-12",
  duration_days: 3,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  parent_task_id: null,
  level: 0,
  dependencies: [],
  is_overdue: false,
};

describe("GanttChart project calendar", () => {
  it("uses calendar exceptions for non-working shading while retaining configured Saturday work", () => {
    render(
      <GanttChart
        data={[task]}
        calendar={{
          working_weekdays: [1, 2, 3, 4, 5, 6],
          non_working_dates: ["2026-08-10"],
        }}
      />,
    );

    expect(screen.getByText("M 10")).toHaveAttribute(
      "fill",
      "hsl(var(--muted-foreground) / 0.6)",
    );
    expect(screen.getByText("S 8")).toHaveAttribute(
      "fill",
      "hsl(var(--muted-foreground))",
    );
  });
});
