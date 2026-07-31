/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskDependenciesEditor } from "../task-dependencies-editor";
import type { ScheduleDependency, ScheduleTask } from "@/types/scheduling";

const tasks: ScheduleTask[] = [
  {
    id: "foundation",
    project_id: 43,
    parent_task_id: null,
    name: "Foundation",
    start_date: null,
    finish_date: null,
    duration_days: null,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 1,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
  {
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
  },
];

const dependency: ScheduleDependency = {
  id: "dependency-1",
  task_id: "framing",
  predecessor_task_id: "foundation",
  dependency_type: "finish_to_start",
  lag_days: 2,
  created_at: "2026-07-01T00:00:00.000Z",
};

describe("TaskDependenciesEditor", () => {
  it("shows named predecessors, excludes the task itself, and delegates removal", async () => {
    const onRemove = jest.fn().mockResolvedValue(undefined);
    const onUpdate = jest.fn().mockResolvedValue(undefined);

    render(
      <TaskDependenciesEditor
        taskId="framing"
        dependencies={[dependency]}
        availableTasks={tasks}
        onCreate={jest.fn().mockResolvedValue(undefined)}
        onRemove={onRemove}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("Predecessors")).toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Framing" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Foundation predecessor" }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith("dependency-1"));
  });

  it("updates the selected predecessor in place", async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);

    render(
      <TaskDependenciesEditor
        taskId="framing"
        dependencies={[dependency]}
        availableTasks={tasks}
        onCreate={jest.fn().mockResolvedValue(undefined)}
        onRemove={jest.fn().mockResolvedValue(undefined)}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Foundation predecessor" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("dependency-1", {
      predecessor_task_id: "foundation",
      dependency_type: "finish_to_start",
      lag_days: 2,
    }));
  });

  it("labels and saves a negative value as lead time", async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    const leadDependency = { ...dependency, lag_days: -2 };

    render(
      <TaskDependenciesEditor
        taskId="framing"
        dependencies={[leadDependency]}
        availableTasks={tasks}
        onCreate={jest.fn().mockResolvedValue(undefined)}
        onRemove={jest.fn().mockResolvedValue(undefined)}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText(/2 days lead/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Foundation predecessor" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("dependency-1", {
      predecessor_task_id: "foundation",
      dependency_type: "finish_to_start",
      lag_days: -2,
    }));
  });
});
