/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  dependencies: [{
    id: "dependency-1",
    task_id: "framing",
    predecessor_task_id: "foundation",
    dependency_type: "finish_to_start",
    lag_days: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  }],
};

describe("TaskEditModal dependency integration", () => {
  it("exposes the shared predecessor editor for an existing task", async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={task}
        projectId="43"
        availableTasks={[task, { ...task, id: "foundation", name: "Foundation" }]}
        onSave={jest.fn().mockResolvedValue(undefined)}
        dependencyActions={{
          onCreate: jest.fn().mockResolvedValue(undefined),
          onRemove: jest.fn().mockResolvedValue(undefined),
          onUpdate,
        }}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    expect(screen.getByLabelText("Predecessors")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Current predecessors")).getByText("Foundation")).toBeInTheDocument();
  });

  it("routes an edited predecessor through the supplied project action", async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <TaskEditModal
        open
        onOpenChange={jest.fn()}
        task={task}
        projectId="43"
        availableTasks={[task, { ...task, id: "foundation", name: "Foundation" }]}
        onSave={jest.fn().mockResolvedValue(undefined)}
        dependencyActions={{
          onCreate: jest.fn().mockResolvedValue(undefined),
          onRemove: jest.fn().mockResolvedValue(undefined),
          onUpdate,
        }}
      />,
    );

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    fireEvent.click(screen.getByRole("button", { name: "Edit Foundation predecessor" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("dependency-1", {
      predecessor_task_id: "foundation",
      dependency_type: "finish_to_start",
      lag_days: 0,
    }));
  });
});
