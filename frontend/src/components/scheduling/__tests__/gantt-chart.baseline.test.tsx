/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { GanttChart } from "../gantt-chart";
import type { GanttChartItem } from "@/types/scheduling";

const task: GanttChartItem = {
  id: "task-1",
  name: "Mobilize",
  start_date: "2026-08-10",
  finish_date: "2026-08-14",
  duration_days: 5,
  percent_complete: 20,
  status: "in_progress",
  is_milestone: false,
  parent_task_id: null,
  level: 0,
  dependencies: [],
  is_overdue: false,
  baseline_start_date: "2026-08-07",
  baseline_finish_date: "2026-08-12",
  start_variance_days: 1,
  finish_variance_days: 2,
  duration_variance_days: 0,
};

it("renders an accessible, keyboard-operable baseline overlay with local calendar dates", async () => {
  const onTaskClick = jest.fn();
  const { rerender } = render(<GanttChart data={[task]} showBaseline={false} onTaskClick={onTaskClick} />);
  expect(screen.queryByTestId("gantt-baseline-task-1")).not.toBeInTheDocument();

  rerender(<GanttChart data={[task]} showBaseline onTaskClick={onTaskClick} />);
  expect(screen.getByTestId("gantt-baseline-task-1")).toHaveAttribute("aria-hidden", "true");
  const taskButton = screen.getByRole("button", { name: /Mobilize, baseline comparison: 1 day start variance, 2 days finish variance/i });
  fireEvent.keyDown(taskButton, { key: "Enter" });
  expect(onTaskClick).toHaveBeenCalledWith("task-1");
  fireEvent.focus(taskButton);
  expect((await screen.findAllByText(/Baseline: Aug 7 - Aug 12, 2026/)).length).toBeGreaterThan(0);
});

it("announces missing variance as unavailable instead of zero", () => {
  render(<GanttChart data={[{ ...task, start_variance_days: null, finish_variance_days: null }]} showBaseline />);
  expect(screen.getByRole("button", { name: /start variance unavailable, finish variance unavailable/i })).toBeInTheDocument();
});
