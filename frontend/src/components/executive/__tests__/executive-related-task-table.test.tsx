/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ExecutiveRelatedTaskTable } from "../executive-related-task-table";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/app/(main)/actions/executive-briefing-actions", () => ({
  deleteExecutiveRelatedTaskAction: jest.fn(),
  updateExecutiveRelatedTaskAction: jest.fn(),
}));

describe("ExecutiveRelatedTaskTable", () => {
  it("renders an Assign affordance for tasks with no assignee", () => {
    render(
      <ExecutiveRelatedTaskTable
        employees={[
          {
            id: "person-1",
            label: "Misty Franklin",
            email: "misty@example.com",
          },
        ]}
        tasks={[
          {
            id: "task-1",
            title: "Confirm permit drawing path",
            description: "Confirm permit drawing path",
            status: "open",
            priority: "high",
            dueDate: null,
            assigneeName: null,
            assigneeEmail: null,
            assigneePersonId: null,
            metadataId: "meeting-1",
            projectName: "Ulta Beauty Fresno",
          },
        ]}
      />,
    );

    const assigneePicker = screen.getByRole("combobox", {
      name: /assignee for confirm permit drawing path/i,
    });

    expect(assigneePicker).toHaveTextContent("Assign");
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });
});
