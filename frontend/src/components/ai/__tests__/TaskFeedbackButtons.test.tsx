/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CheckSquare2 } from "lucide-react";
import { TaskFeedbackButtons } from "../TaskFeedbackButtons";
import { apiFetch } from "@/lib/api-client";
import type { TaskSnapshot } from "@/lib/ai/task-feedback-types";
import { DetailPropertyItem } from "@/components/ui/detail-property-bar";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/report-non-critical-failure", () => ({
  reportNonCriticalFailure: jest.fn(),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

const taskSnapshot: TaskSnapshot = {
  name: "Follow up on permit comments",
  assignee: "Sam Lee",
  dueDate: null,
  priority: "high",
  notes: null,
  projectId: 42,
  source: "email",
  generatedBy: "gpt-5.5",
};

describe("TaskFeedbackButtons — thumbs up context capture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiFetchMock.mockResolvedValue({ success: true, id: "feedback-1" });
  });

  it("opens a popover on thumbs up and submits the optional context as the reason", async () => {
    render(
      <TaskFeedbackButtons
        projectId={42}
        taskId="task-1"
        taskSnapshot={taskSnapshot}
      />,
    );

    fireEvent.click(screen.getByLabelText("Mark as good example"));

    const textarea = await screen.findByPlaceholderText(
      "Add context for the next version... (optional)",
    );
    fireEvent.change(textarea, {
      target: { value: "Correct assignee and priority pulled from the email thread." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(
      (apiFetchMock.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(requestBody).toMatchObject({
      taskId: "task-1",
      projectId: 42,
      signal: "good",
      reason: "Correct assignee and priority pulled from the email thread.",
    });

    expect(
      await screen.findByText("Marked as good example"),
    ).toBeInTheDocument();
  });

  it("submits thumbs up with a null reason when no context is provided", async () => {
    render(
      <TaskFeedbackButtons
        projectId={42}
        taskId="task-2"
        taskSnapshot={taskSnapshot}
      />,
    );

    fireEvent.click(screen.getByLabelText("Mark as good example"));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(
      (apiFetchMock.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(requestBody).toMatchObject({
      taskId: "task-2",
      signal: "good",
      reason: null,
    });
  });

  it("still opens and submits when mounted inside a detail property item", async () => {
    render(
      <DetailPropertyItem icon={CheckSquare2} aria-label="Task training feedback">
        <TaskFeedbackButtons
          projectId={42}
          taskId="task-3"
          taskSnapshot={taskSnapshot}
          compact
        />
      </DetailPropertyItem>,
    );

    fireEvent.click(screen.getByLabelText("Mark as good example"));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(
      (apiFetchMock.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(requestBody).toMatchObject({
      taskId: "task-3",
      signal: "good",
      reason: null,
    });
  });
});
