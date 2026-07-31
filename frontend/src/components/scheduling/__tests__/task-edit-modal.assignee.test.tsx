/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskEditModal } from "../task-edit-modal";
import type { ScheduleTask } from "@/types/scheduling";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn().mockResolvedValue([{ id: "person-1", name: "Alex Trade" }]) }));

const task: ScheduleTask = { id: "task-1", project_id: 43, parent_task_id: null, name: "Framing", start_date: null, finish_date: null, duration_days: null, percent_complete: 0, status: "not_started", is_milestone: false, constraint_type: null, constraint_date: null, wbs_code: null, sort_order: 1, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z", assignee_person_id: null };

test("assigns a schedule activity only to an active project member", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<TaskEditModal open onOpenChange={jest.fn()} task={task} projectId="43" onSave={onSave} />);
  await screen.findByText("Alex Trade");
  fireEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
  fireEvent.click(screen.getByRole("option", { name: "Alex Trade" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ assignee_person_id: "person-1" })));
});
