/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { GanttChart } from "../gantt-chart";
import type { GanttChartItem } from "@/types/scheduling";

const criticalTask: GanttChartItem = {
  id: "foundation",
  name: "Foundation",
  start_date: "2026-08-01",
  finish_date: "2026-08-03",
  duration_days: 3,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  parent_task_id: null,
  level: 0,
  dependencies: [],
  is_overdue: false,
  is_critical_path: true,
  total_float_days: 0,
  schedule_warnings: [],
};

describe("GanttChart critical path", () => {
  it("shows an accessible critical marker only when the overlay is enabled", () => {
    const { rerender } = render(
      <GanttChart data={[criticalTask]} showCriticalPath />,
    );

    expect(screen.getByText("Critical")).toBeVisible();
    expect(screen.getByRole("img", { name: "Foundation, critical task" })).toBeVisible();

    rerender(<GanttChart data={[criticalTask]} showCriticalPath={false} />);
    expect(screen.queryByText("Critical")).not.toBeInTheDocument();
  });
});
