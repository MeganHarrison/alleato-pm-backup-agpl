/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { GanttChart } from "../gantt-chart";
import type { GanttChartItem } from "@/types/scheduling";

function task(overrides: Partial<GanttChartItem>): GanttChartItem {
  return {
    id: "pipe-prep",
    name: "Pipe Prep",
    start_date: "2026-08-11",
    finish_date: "2026-08-12",
    duration_days: 2,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    parent_task_id: null,
    level: 0,
    dependencies: [],
    is_overdue: false,
    is_critical_path: false,
    total_float_days: 0,
    schedule_warnings: [],
    ...overrides,
  };
}

describe("GanttChart unscheduled tasks", () => {
  it("keeps an undated successor visible without fabricating a bar or dependency arrow", () => {
    const { container } = render(
      <GanttChart
        data={[
          task({}),
          task({
            id: "pipe-installation",
            name: "Pipe installation",
            start_date: null,
            finish_date: null,
            duration_days: null,
            dependencies: [{
              predecessor_id: "pipe-prep",
              type: "finish_to_start",
              lag_days: 0,
            }],
            schedule_warnings: ["missing_dates"],
          }),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Pipe installation" })).toBeVisible();
    expect(screen.getByText("Unscheduled")).toBeVisible();
    expect(
      Array.from(container.querySelectorAll("svg text")).some(
        (node) => node.textContent === "Pipe installation",
      ),
    ).toBe(false);
    expect(container.querySelector(".dependency-arrow")).not.toBeInTheDocument();
  });

  it.each([
    {
      dependencyType: "finish_to_start" as const,
      predecessor: { finish_date: null },
      successor: {},
    },
    {
      dependencyType: "start_to_start" as const,
      predecessor: { start_date: null },
      successor: {},
    },
    {
      dependencyType: "finish_to_finish" as const,
      predecessor: {},
      successor: { finish_date: null },
    },
    {
      dependencyType: "start_to_finish" as const,
      predecessor: {},
      successor: { finish_date: null },
    },
  ])(
    "suppresses a $dependencyType arrow when its required endpoint is unknown",
    ({ dependencyType, predecessor, successor }) => {
      const { container } = render(
        <GanttChart
          data={[
            task(predecessor),
            task({
              id: "pipe-installation",
              name: "Pipe installation",
              dependencies: [{
                predecessor_id: "pipe-prep",
                type: dependencyType,
                lag_days: 0,
              }],
              ...successor,
            }),
          ]}
        />,
      );

      expect(container.querySelector(".dependency-arrow")).not.toBeInTheDocument();
    },
  );
});
