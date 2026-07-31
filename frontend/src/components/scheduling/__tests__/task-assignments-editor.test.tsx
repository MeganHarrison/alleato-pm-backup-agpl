/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import type { ScheduleResourceRosterResponse, ScheduleTask } from "@/types/scheduling";
import { TaskAssignmentsEditor } from "../task-assignments-editor";

const task: ScheduleTask = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  project_id: 67,
  parent_task_id: null,
  name: "Install conveyors",
  start_date: "2026-08-03",
  finish_date: "2026-08-07",
  duration_days: 5,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  constraint_type: null,
  constraint_date: null,
  wbs_code: null,
  sort_order: 0,
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
};

function roster(overrides: Partial<ScheduleResourceRosterResponse> = {}): ScheduleResourceRosterResponse {
  return {
    resources: [],
    candidates: [{
      person_id: "11111111-1111-4111-8111-111111111111",
      resource_id: null,
      display_name: "Active Person",
      email: "active@example.com",
      job_title: null,
    }],
    assignments: [],
    can_manage: true,
    legacy_assignment_count: 0,
    ...overrides,
  };
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

describe("TaskAssignmentsEditor", () => {
  it("adds a project person, edits allocation, and saves separately from task dates", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <TaskAssignmentsEditor
        task={task}
        tasks={[task]}
        roster={roster()}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByLabelText("Add project person"));
    await user.click(screen.getByRole("option", { name: "Active Person" }));
    fireEvent.click(screen.getByRole("button", { name: "Add resource" }));
    fireEvent.change(screen.getByLabelText("Allocation for Active Person"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      { person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: 75 },
    ]));
    expect(task.start_date).toBe("2026-08-03");
    expect(task.finish_date).toBe("2026-08-07");
  });

  it("keeps Enter in an allocation field from submitting the outer task form", () => {
    const onTaskSubmit = jest.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onTaskSubmit}>
        <TaskAssignmentsEditor
          task={task}
          tasks={[task]}
          roster={roster({
            resources: [{
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              project_id: 67,
              person_id: "11111111-1111-4111-8111-111111111111",
              display_name: "Active Person",
              email: null,
              job_title: null,
              person_status: "active",
              membership_status: "active",
              eligible: true,
            }],
            assignments: [{
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              project_id: 67,
              task_id: task.id,
              resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              person_id: "11111111-1111-4111-8111-111111111111",
              allocation_percent: 50,
            }],
          })}
          calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
          onSave={jest.fn()}
        />
      </form>,
    );

    fireEvent.keyDown(screen.getByLabelText("Allocation for Active Person"), { key: "Enter" });
    expect(onTaskSubmit).not.toHaveBeenCalled();
  });

  it("allows Enter on Save assignments to activate the independent save", async () => {
    const user = userEvent.setup();
    const onTaskSubmit = jest.fn((event: FormEvent) => event.preventDefault());
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <form onSubmit={onTaskSubmit}>
        <TaskAssignmentsEditor
          task={task}
          tasks={[task]}
          roster={roster()}
          calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
          onSave={onSave}
        />
      </form>,
    );

    const saveButton = screen.getByRole("button", { name: "Save assignments" });
    saveButton.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([]));
    expect(onTaskSubmit).not.toHaveBeenCalled();
  });

  it("does not claim 100 percent availability when the task span has no working day", async () => {
    const user = userEvent.setup();
    const weekendTask = {
      ...task,
      start_date: "2026-08-08",
      finish_date: "2026-08-08",
    };
    render(
      <TaskAssignmentsEditor
        task={weekendTask}
        tasks={[weekendTask]}
        roster={roster()}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        onSave={jest.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Add project person"));
    await user.click(screen.getByRole("option", { name: "Active Person" }));
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    expect(screen.getByText("Availability unavailable for this task span")).toBeInTheDocument();
  });

  it("includes explicit zero-capacity working days in assignment availability", async () => {
    render(
      <TaskAssignmentsEditor
        task={task}
        tasks={[task]}
        roster={roster({
          candidates: [],
          resources: [{
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            project_id: 67,
            person_id: "11111111-1111-4111-8111-111111111111",
            display_name: "Active Person",
            email: "active@example.com",
            job_title: null,
            person_status: "active",
            membership_status: "active",
            eligible: true,
          }],
          assignments: [{
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            project_id: 67,
            task_id: task.id,
            resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            person_id: "11111111-1111-4111-8111-111111111111",
            allocation_percent: 50,
          }],
        })}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        onSave={jest.fn()}
        loadCapacityProfiles={jest.fn().mockResolvedValue([{
          profile_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          project_id: 67,
          resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          configured: true,
          version: 1,
          coverage_start_date: task.start_date,
          coverage_finish_date: task.finish_date,
          weekday_overrides: [],
          exceptions: [{ date: "2026-08-03", capacity_percent: 0, reason: "Project day off" }],
        }])}
      />,
    );

    expect(await screen.findByText("0% available before this task")).toBeInTheDocument();
    expect(screen.queryByText("100% available before this task")).not.toBeInTheDocument();
  });

  it("surfaces legacy and inactive-resource warnings instead of hiding them", () => {
    const legacyTask = { ...task, assignee: "Legacy Person" };
    render(
      <TaskAssignmentsEditor
        task={legacyTask}
        tasks={[legacyTask]}
        roster={roster({
          resources: [{
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            project_id: 67,
            person_id: "22222222-2222-4222-8222-222222222222",
            display_name: "Inactive Person",
            email: null,
            job_title: null,
            person_status: "active",
            membership_status: "inactive",
            eligible: false,
          }],
          assignments: [{
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            project_id: 67,
            task_id: task.id,
            resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            person_id: "22222222-2222-4222-8222-222222222222",
            allocation_percent: 50,
          }],
        })}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByText(/legacy single-assignee value/i)).toBeInTheDocument();
    expect(screen.getByText(/no longer active in the project directory/i)).toBeInTheDocument();
  });

  it("keeps rejected saves visible and retryable", async () => {
    const onSave = jest.fn().mockRejectedValue(new Error("Assignment rejected by project policy."));
    render(
      <TaskAssignmentsEditor
        task={task}
        tasks={[task]}
        roster={roster({
          assignments: [{
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            project_id: 67,
            task_id: task.id,
            resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            person_id: "11111111-1111-4111-8111-111111111111",
            allocation_percent: 50,
          }],
          resources: [{
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            project_id: 67,
            person_id: "11111111-1111-4111-8111-111111111111",
            display_name: "Active Person",
            email: "active@example.com",
            job_title: null,
            person_status: "active",
            membership_status: "active",
            eligible: true,
          }],
        })}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Assignment rejected by project policy.");
    expect(screen.getByRole("button", { name: "Save assignments" })).toBeEnabled();
  });

  it("never substitutes inherited availability when project capacity fails to load", async () => {
    render(
      <TaskAssignmentsEditor
        task={task}
        tasks={[task]}
        roster={roster({
          assignments: [{
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            project_id: 67,
            task_id: task.id,
            resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            person_id: "11111111-1111-4111-8111-111111111111",
            allocation_percent: 50,
          }],
          resources: [{
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            project_id: 67,
            person_id: "11111111-1111-4111-8111-111111111111",
            display_name: "Active Person",
            email: "active@example.com",
            job_title: null,
            person_status: "active",
            membership_status: "active",
            eligible: true,
          }],
        })}
        calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
        onSave={jest.fn()}
        loadCapacityProfiles={jest.fn().mockRejectedValue(new Error("Capacity service unavailable."))}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Capacity service unavailable.");
    expect(screen.getByText("Availability unavailable for this task span")).toBeInTheDocument();
    expect(screen.queryByText(/% available before this task/i)).not.toBeInTheDocument();
  });
});
