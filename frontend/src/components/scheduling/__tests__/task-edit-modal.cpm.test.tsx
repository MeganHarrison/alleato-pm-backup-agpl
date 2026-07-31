/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskEditModal } from "../task-edit-modal";
import type { ScheduleTask } from "@/types/scheduling";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn((url: string) =>
    Promise.resolve(
      url.endsWith("/contacts")
        ? []
        : {
            data: {
              task_id: "task-1",
              task_version: 1,
              state: { task: {}, segments: [] },
            },
          },
    ),
  ),
}));

const predecessor: ScheduleTask = {
  id: "foundation",
  project_id: 43,
  parent_task_id: null,
  name: "Foundation",
  start_date: "2026-08-06",
  finish_date: "2026-08-07",
  duration_days: 2,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  constraint_type: null,
  constraint_date: null,
  wbs_code: null,
  sort_order: 0,
  created_at: "2026-07-21T00:00:00.000Z",
  updated_at: "2026-07-21T00:00:00.000Z",
};

const successor: ScheduleTask = {
  ...predecessor,
  id: "framing",
  name: "Framing",
  start_date: "2026-08-10",
  finish_date: "2026-08-11",
  dependencies: [{
    id: "foundation-framing",
    task_id: "framing",
    predecessor_task_id: "foundation",
    dependency_type: "finish_to_start",
    lag_days: 0,
    created_at: "2026-07-21T00:00:00.000Z",
  }],
};

describe("TaskEditModal schedule impact preview", () => {
  it("previews predecessor-anchored dates when an undated task receives a duration", async () => {
    const user = userEvent.setup();
    const undatedSuccessor: ScheduleTask = {
      ...successor,
      start_date: null,
      finish_date: null,
      duration_days: null,
    };

    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={undatedSuccessor}
        projectId="43"
        availableTasks={[predecessor, undatedSuccessor]}
        calendar={{
          working_weekdays: [1, 2, 3, 4, 5],
          non_working_dates: ["2026-08-10"],
        }}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    await user.type(screen.getByLabelText("Duration (days)"), "1");

    expect(
      screen.queryByRole("status", { name: "Schedule impact unavailable" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Schedule impact before save" }),
    ).toHaveTextContent("Framing: Unscheduled → 2026-08-11");
  });

  it("previews the successor movement when a dated task becomes a milestone", async () => {
    const user = userEvent.setup();

    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={predecessor}
        projectId="43"
        availableTasks={[predecessor, successor]}
        calendar={{
          working_weekdays: [1, 2, 3, 4, 5],
          non_working_dates: [],
        }}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    await user.click(screen.getByLabelText("This is a milestone"));

    expect(screen.getByLabelText("Duration (days)")).toHaveValue(0);
    expect(screen.getByLabelText("Finish Date")).toHaveValue("2026-08-06");
    expect(
      screen.getByRole("status", { name: "Schedule impact before save" }),
    ).toHaveTextContent("Framing: 2026-08-10 → 2026-08-07");
  });

  it("shows weekday-calculated successor movement before saving an edited task", async () => {
    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={predecessor}
        projectId="43"
        availableTasks={[predecessor, successor]}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: ["2026-08-11"] }}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    fireEvent.change(screen.getByLabelText("Start Date"), { target: { value: "2026-08-07" } });
    fireEvent.change(screen.getByLabelText("Finish Date"), { target: { value: "2026-08-10" } });

    expect(screen.getByRole("status", { name: "Schedule impact before save" })).toHaveTextContent("Framing: 2026-08-10 → 2026-08-12");
    expect(screen.getByRole("status", { name: "Schedule impact before save" })).toHaveTextContent("Calendar: 1, 2, 3, 4, 5 working weekdays; 1 exception.");
  });
});
