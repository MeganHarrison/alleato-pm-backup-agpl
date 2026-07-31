/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskEditModal } from "../task-edit-modal";
import type { ScheduleTask } from "@/types/scheduling";

const task: ScheduleTask = { id: "task-1", project_id: 43, parent_task_id: null, name: "Install air-handling unit", start_date: "2026-08-20", finish_date: null, duration_days: null, percent_complete: 0, status: "not_started", is_milestone: false, constraint_type: null, constraint_date: null, wbs_code: null, sort_order: 1, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" };

it("shows a blocking submittal reason and allows the link to be removed", async () => {
  const onUnlinkSubmittal = jest.fn().mockResolvedValue(undefined);
  const onLinkSubmittal = jest.fn().mockResolvedValue(undefined);
  render(<TaskEditModal open onOpenChange={jest.fn()} task={task} projectId="43" onSave={jest.fn().mockResolvedValue(undefined)} linkedSubmittals={[{ id: "sub-1", number: "23 73 00-01", title: "Air-handling unit" }]} availableSubmittals={[{ id: "sub-1", number: "23 73 00-01", title: "Air-handling unit" }, { id: "sub-2", number: "26 50 00-04", title: "Lighting fixtures" }]} submittalRisk={{ status: "at_risk", reason: "Submittal 23 73 00-01 is rejected.", blocking_submittal_id: "sub-1", dependency_context: ["Commission air-handling unit"] }} onUnlinkSubmittal={onUnlinkSubmittal} onLinkSubmittal={onLinkSubmittal} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Submittal 23 73 00-01 is rejected.");
  fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
  expect(onUnlinkSubmittal).toHaveBeenCalledWith("sub-1");
  fireEvent.change(screen.getByLabelText("Link submittal"), { target: { value: "sub-2" } });
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  expect(onLinkSubmittal).toHaveBeenCalledWith("sub-2");
  await waitFor(() => expect(screen.getByLabelText("Link submittal")).toHaveValue(""));
});

it("makes a failed submittal link visible instead of leaving an unhandled action", async () => {
  render(<TaskEditModal open onOpenChange={jest.fn()} task={task} projectId="43" onSave={jest.fn().mockResolvedValue(undefined)} availableSubmittals={[{ id: "sub-2", number: "26 50 00-04", title: "Lighting fixtures" }]} onLinkSubmittal={jest.fn().mockRejectedValue(new Error("You do not have permission to link this submittal."))} />);

  fireEvent.change(screen.getByLabelText("Link submittal"), { target: { value: "sub-2" } });
  fireEvent.click(screen.getByRole("button", { name: "Link" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to link this submittal.");
});

it("does not report an empty, clear submittal state when the authoritative risk read failed", () => {
  render(<TaskEditModal open onOpenChange={jest.fn()} task={task} projectId="43" onSave={jest.fn().mockResolvedValue(undefined)} linkedSubmittalsError="Unable to refresh linked submittals." />);

  expect(screen.getByRole("alert")).toHaveTextContent("Unable to refresh linked submittals.");
  expect(screen.queryByText("No submittals linked to this activity.")).not.toBeInTheDocument();
});
