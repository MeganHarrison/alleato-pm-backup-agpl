/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const task: ScheduleTask = {
  id: "framing",
  project_id: 43,
  parent_task_id: null,
  name: "Framing",
  start_date: null,
  finish_date: null,
  duration_days: null,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  constraint_type: null,
  constraint_date: null,
  wbs_code: null,
  sort_order: 2,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  deadline: {
    id: "deadline-1",
    task_id: "framing",
    deadline_date: "2026-07-12",
    created_at: "2026-07-01T00:00:00.000Z",
  },
};

describe("TaskEditModal deadline integration", () => {
  it("shows the persisted deadline in the canonical task modal", async () => {
    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={task}
        projectId="43"
        availableTasks={[task]}
        onSave={jest.fn().mockResolvedValue(undefined)}
        deadlineActions={{
          onSave: jest.fn().mockResolvedValue(undefined),
          onRemove: jest.fn().mockResolvedValue(undefined),
        }}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    expect(screen.getByLabelText("Deadline")).toHaveValue("2026-07-12");
  });

  it("saves a changed deadline through the supplied project action", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={task}
        projectId="43"
        availableTasks={[task]}
        onSave={jest.fn().mockResolvedValue(undefined)}
        deadlineActions={{ onSave, onRemove: jest.fn().mockResolvedValue(undefined) }}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "2026-07-19" } });
    fireEvent.click(screen.getByRole("button", { name: "Save deadline" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("2026-07-19"));
  });

  it("removes the deadline only after the user intentionally clears and saves the field", async () => {
    const onRemove = jest.fn().mockResolvedValue(undefined);

    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={task}
        projectId="43"
        availableTasks={[task]}
        onSave={jest.fn().mockResolvedValue(undefined)}
        deadlineActions={{ onSave: jest.fn().mockResolvedValue(undefined), onRemove }}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save deadline" }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
  });
});
