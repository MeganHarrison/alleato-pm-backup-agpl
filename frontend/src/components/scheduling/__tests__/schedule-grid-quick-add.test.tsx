/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { ScheduleTaskWithHierarchy } from "@/types/scheduling";
import { ScheduleGridView } from "../schedule-views";

function task(
  id: string,
  name: string,
  parentTaskId: string | null,
  children: ScheduleTaskWithHierarchy[] = [],
): ScheduleTaskWithHierarchy {
  return {
    id,
    project_id: 67,
    parent_task_id: parentTaskId,
    name,
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
    created_at: "2026-07-29T00:00:00Z",
    updated_at: "2026-07-29T00:00:00Z",
    children,
    level: parentTaskId ? 1 : 0,
  };
}

describe("ScheduleGridView quick add", () => {
  it("anchors a new root task after the last root sibling, not the last flattened child", async () => {
    const onQuickAddTask = jest.fn().mockResolvedValue(undefined);
    const child = task(
      "22222222-2222-4222-8222-222222222222",
      "Last child",
      "11111111-1111-4111-8111-111111111111",
    );
    const root = task(
      "11111111-1111-4111-8111-111111111111",
      "Root task",
      null,
      [child],
    );

    render(
      <ScheduleGridView
        tasks={[root]}
        selectedIds={new Set()}
        onSelectionChange={jest.fn()}
        onTaskClick={jest.fn()}
        onAddTask={jest.fn()}
        onQuickAddTask={onQuickAddTask}
        onEditTask={jest.fn()}
        onDeleteTask={jest.fn()}
        onUpdateTask={jest.fn().mockResolvedValue(undefined)}
        isLoading={false}
      />,
    );

    const input = screen.getByPlaceholderText("Type task name and press Enter");
    fireEvent.change(input, { target: { value: "New root task" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(onQuickAddTask).toHaveBeenCalledWith({
        name: "New root task",
      }),
    );
  });
});
