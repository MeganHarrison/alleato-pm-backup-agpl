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

const task: ScheduleTask = { id: "task-1", project_id: 43, parent_task_id: null, name: "Framing", start_date: null, finish_date: null, duration_days: null, percent_complete: 0, status: "not_started", is_milestone: false, constraint_type: null, constraint_date: null, wbs_code: null, sort_order: 1, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" };

describe("TaskEditModal field update", () => {
  it("keeps the complete edit form reachable within the viewport", async () => {
    render(<TaskEditModal open onOpenChange={jest.fn()} task={task} projectId="43" availableTasks={[task]} onSave={jest.fn().mockResolvedValue(undefined)} fieldUpdateAction={jest.fn().mockResolvedValue(undefined)} />);

    await screen.findByText("No hourly segments. The task currently uses its date range.");
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog.className).toContain("overflow-y-auto");
  });

  it("sends field facts, reason, note, and attachment URLs only through the supplied audited action", async () => {
    const fieldUpdateAction = jest.fn().mockResolvedValue(undefined);
    render(<TaskEditModal open onOpenChange={jest.fn()} task={task} projectId="43" availableTasks={[task]} onSave={jest.fn().mockResolvedValue(undefined)} fieldUpdateAction={fieldUpdateAction} />);
    await screen.findByText("No hourly segments. The task currently uses its date range.");
    fireEvent.change(screen.getByLabelText("Forecast finish"), { target: { value: "2026-08-14" } });
    fireEvent.change(screen.getByLabelText("Remaining duration (days)"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Delay reason"), { target: { value: "Weather" } });
    fireEvent.change(screen.getByLabelText("Field note"), { target: { value: "Rain delay" } });
    fireEvent.change(screen.getByLabelText("Attachment URLs"), { target: { value: "https://example.com/log.pdf" } });
    fireEvent.click(screen.getByRole("button", { name: "Record field update" }));
    await waitFor(() => expect(fieldUpdateAction).toHaveBeenCalledWith(expect.objectContaining({ forecast_finish_date: "2026-08-14", remaining_duration_days: 8, delay_reason: "Weather", note: "Rain delay", attachment_urls: ["https://example.com/log.pdf"] })));
  });
});
