/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import { GanttChart } from "../gantt-chart";
import type { GanttChartItem } from "@/types/scheduling";

function task(overrides: Partial<GanttChartItem>): GanttChartItem {
  return {
    id: "task-1",
    name: "Mobilization",
    start_date: "2026-08-03",
    finish_date: "2026-08-03",
    duration_days: 1,
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

describe("GanttChart task-name label", () => {
  it("renders the task name as an SVG label next to its bar, to the right by default", () => {
    const { container } = render(<GanttChart data={[task({})]} />);

    const labels = Array.from(container.querySelectorAll("svg text")).filter(
      (node) => node.textContent === "Mobilization",
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0].getAttribute("text-anchor")).toBe("start");
  });

  it("flips the label to the left of the bar when it would run past the chart's right edge", () => {
    // An extremely long name guarantees its estimated width exceeds the timeline's
    // total width (padded to roughly a month either side of the task) regardless of
    // exact date-range math, without needing to hand-tune days-to-edge alignment.
    const longName = "A".repeat(500);
    const { container } = render(<GanttChart data={[task({ name: longName })]} />);

    const labels = Array.from(container.querySelectorAll("svg text")).filter(
      (node) => node.textContent === longName,
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0].getAttribute("text-anchor")).toBe("end");
  });

  it("renders a milestone's name label next to its diamond marker", () => {
    const { container } = render(
      <GanttChart data={[task({ is_milestone: true, name: "Kickoff" })]} />,
    );

    const labels = Array.from(container.querySelectorAll("svg text")).filter(
      (node) => node.textContent === "Kickoff",
    );
    expect(labels.length).toBeGreaterThan(0);
  });
});
