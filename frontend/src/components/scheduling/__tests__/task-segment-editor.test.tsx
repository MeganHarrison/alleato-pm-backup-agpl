/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiFetch } from "@/lib/api-client";
import { TaskSegmentEditor } from "../task-segment-editor";
import type { ScheduleTask } from "@/types/scheduling";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));

const task: ScheduleTask = {
  id: "22222222-2222-4222-8222-222222222222",
  project_id: 67,
  parent_task_id: null,
  name: "Install controls",
  start_date: "2026-08-03",
  finish_date: "2026-08-03",
  duration_days: 1,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  constraint_type: null,
  constraint_date: null,
  wbs_code: null,
  sort_order: 1,
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
};

describe("TaskSegmentEditor", () => {
  it("adds and persists a split on the 15-minute grid", async () => {
    (apiFetch as jest.Mock)
      .mockResolvedValueOnce({ data: { task_id: task.id, task_version: 7, state: { task: {}, segments: [] } } })
      .mockResolvedValueOnce({ data: { task_id: task.id, task_version: 8, state: { task: {}, segments: [] } } });
    render(<TaskSegmentEditor projectId="67" task={task} timezoneName="America/Indiana/Indianapolis" />);
    await waitFor(() => expect(screen.getByText(/No hourly segments/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Add split/i }));
    expect(screen.getByLabelText("Segment 1 start")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save hourly segments/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(apiFetch).toHaveBeenLastCalledWith(
      `/api/projects/67/scheduling/tasks/${task.id}/segments`,
      expect.objectContaining({ method: "PUT", body: expect.stringContaining('"expected_task_version":7') }),
    );
  });

  it("preserves an invalid surviving input when another segment is removed", async () => {
    (apiFetch as jest.Mock).mockResolvedValueOnce({
      data: {
        task_id: task.id,
        task_version: 7,
        state: {
          task: {},
          segments: [
            {
              id: "segment-1",
              task_id: task.id,
              segment_index: 0,
              starts_at: "2026-08-03T12:00:00.000Z",
              ends_at: "2026-08-03T13:00:00.000Z",
              planned_minutes: 60,
              lock_reason: null,
            },
            {
              id: "segment-2",
              task_id: task.id,
              segment_index: 1,
              starts_at: "2026-08-03T14:00:00.000Z",
              ends_at: "2026-08-03T15:00:00.000Z",
              planned_minutes: 60,
              lock_reason: null,
            },
          ],
        },
      },
    });
    render(<TaskSegmentEditor projectId="67" task={task} timezoneName="America/Indiana/Indianapolis" />);
    const firstStart = await screen.findByLabelText("Segment 1 start");

    fireEvent.change(firstStart, { target: { value: "not-a-date" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove segment 2" }));

    expect(screen.getByLabelText("Segment 1 start")).toHaveValue("not-a-date");
    expect(screen.getByLabelText("Segment 1 start")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /Save hourly segments/i })).toBeDisabled();
  });
});
