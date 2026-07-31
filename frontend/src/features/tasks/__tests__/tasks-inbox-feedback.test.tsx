/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import {
  TASKS_SPLIT_WORKSPACE_CLASSNAME,
  TASKS_SPLIT_FIRST_PANE_WIDTH,
  TASK_DETAIL_PROPERTY_BAR_CLASSNAME,
  TASK_DETAIL_SECONDARY_PROPERTY_BAR_CLASSNAME,
  TaskListItem,
} from "../tasks-inbox";
import type { TasksRow } from "../task-utils";

jest.mock("@/components/ai/TaskFeedbackButtons", () => ({
  TaskFeedbackButtons: ({ taskId }: { taskId?: string | null }) => (
    <div data-testid="task-feedback-buttons">{taskId}</div>
  ),
}));

jest.mock("@/components/misc/markdown", () => ({
  Markdown: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

jest.mock("@/components/ds/SwipeableListRow", () => ({
  SwipeableListRow: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

function buildTask(overrides: Partial<TasksRow> = {}): TasksRow {
  return {
    id: "task-1",
    metadata_id: null,
    segment_id: null,
    source_chunk_id: null,
    schedule_task_id: null,
    description: "Follow up on revised permit comments",
    assignee_person_id: null,
    assignee_name: "Sam Lee",
    assignee_email: "sam@example.com",
    meeting_title: null,
    project_id: 42,
    project_name: "North Yard",
    client_id: null,
    due_date: null,
    priority: "high",
    status: "open",
    source_system: "email",
    embedding: null,
    created_at: "2026-06-08T10:00:00Z",
    updated_at: "2026-06-08T10:00:00Z",
    project_ids: [42],
    file_name: null,
    source_title: null,
    source_type: null,
    source_date: "2026-06-07T10:00:00Z",
    source_url: null,
    source_web_url: null,
    fireflies_link: null,
    meeting_link: null,
    source_context: "Sam needs to follow up on revised permit comments.",
    title: "Follow up on permit comments",
    assigned_by: "Brandon",
    extraction_source: "email",
    extraction_model: "gpt-5.5",
    extraction_prompt_version: "task_extraction.v5.gpt-5.5",
    extraction_metadata: null,
    ...overrides,
  };
}

describe("TaskListItem feedback visibility", () => {
  it("keeps generated-task feedback out of list rows so detail owns the correction path", () => {
    const { rerender } = render(
      <TaskListItem
        item={buildTask()}
        projects={[]}
        isSelected={false}
        isChecked={false}
        onClick={() => {}}
        onCheckedChange={() => {}}
      />,
    );

    expect(
      screen.queryByTestId("task-feedback-buttons"),
    ).not.toBeInTheDocument();

    rerender(
      <TaskListItem
        item={buildTask({
          extraction_source: null,
          extraction_model: null,
          extraction_prompt_version: null,
        })}
        projects={[]}
        isSelected={false}
        isChecked={false}
        onClick={() => {}}
        onCheckedChange={() => {}}
      />,
    );

    expect(
      screen.queryByTestId("task-feedback-buttons"),
    ).not.toBeInTheDocument();
  });
});

describe("Tasks split layout", () => {
  it("keeps the split view on the same parent-fill contract as emails", () => {
    expect(TASKS_SPLIT_WORKSPACE_CLASSNAME).toContain("h-full");
    expect(TASKS_SPLIT_WORKSPACE_CLASSNAME).toContain("min-h-0");
    expect(TASKS_SPLIT_WORKSPACE_CLASSNAME).toContain("flex-1");
    expect(TASKS_SPLIT_WORKSPACE_CLASSNAME).toContain("overflow-hidden");
    expect(TASKS_SPLIT_WORKSPACE_CLASSNAME).toContain("w-full");
    expect(TASKS_SPLIT_WORKSPACE_CLASSNAME).not.toContain("100dvh");
  });

  it("uses the shared split-page width API for the wider tasks list pane", () => {
    expect(TASKS_SPLIT_FIRST_PANE_WIDTH).toBe("30rem");
  });

  it("keeps task detail metadata on the shared property-bar spacing contract", () => {
    expect(TASK_DETAIL_PROPERTY_BAR_CLASSNAME).toContain("mt-3");
    expect(TASK_DETAIL_PROPERTY_BAR_CLASSNAME).toContain("mb-0");
    expect(TASK_DETAIL_PROPERTY_BAR_CLASSNAME).not.toContain("grid");
    expect(TASK_DETAIL_SECONDARY_PROPERTY_BAR_CLASSNAME).toContain("mt-2");
    expect(TASK_DETAIL_SECONDARY_PROPERTY_BAR_CLASSNAME).toContain("mb-0");
    expect(TASK_DETAIL_SECONDARY_PROPERTY_BAR_CLASSNAME).not.toContain("grid");
  });
});
