/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationTitle,
} from "../confirmation";
import { ToolInput, ToolOutput, getApprovalDisplayFields } from "../tool";

jest.mock("../code-block", () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

describe("Eve approval workflow primitives", () => {
  const input = {
    projectId: 43,
    subject: "Confirm roof drain routing",
    question: "Can the overflow drain terminate at the east elevation?",
    dueDate: "2026-08-05",
    ballInCourt: "Architect",
    costImpact: "no",
    scheduleImpact: "tbd",
  };

  it("turns governed RFI input into a decision-first summary", () => {
    expect(getApprovalDisplayFields("createRFI", input)).toEqual([
      {
        label: "Subject",
        value: "Confirm roof drain routing",
        wide: true,
      },
      {
        label: "Question",
        value: "Can the overflow drain terminate at the east elevation?",
        wide: true,
      },
      { label: "Due date", value: "Aug 5, 2026", wide: undefined },
      { label: "Ball in court", value: "Architect", wide: undefined },
      { label: "Cost impact", value: "None", wide: undefined },
      {
        label: "Schedule impact",
        value: "To be determined",
        wide: undefined,
      },
    ]);

    render(<ToolInput input={input} toolName="createRFI" variant="approval" />);

    expect(screen.getByText("Confirm roof drain routing")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Can the overflow drain terminate at the east elevation?",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });

  it("renders a successful governed write as a compact record receipt", () => {
    render(
      <ToolOutput
        errorText={undefined}
        toolName="createRFI"
        output={{
          receipt: {
            toolCallId: "tool-1",
            payloadHash: "hash-1",
          },
          result: {
            success: true,
            record: {
              id: 2,
              number: 2,
              subject: "Confirm roof drain routing",
              status: "open",
            },
          },
        }}
      />,
    );

    expect(screen.getByText("RFI #2 created")).toBeInTheDocument();
    expect(screen.getByText("Confirm roof drain routing")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("Technical receipt")).toBeInTheDocument();
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
  });

  it("only exposes the declined state after a negative approval response", () => {
    const { rerender } = render(
      <Confirmation approval={{ id: "approval-1" }} state="approval-requested">
        <ConfirmationRejected>
          <ConfirmationTitle>RFI not created</ConfirmationTitle>
        </ConfirmationRejected>
      </Confirmation>,
    );

    expect(screen.queryByText("RFI not created")).not.toBeInTheDocument();

    rerender(
      <Confirmation
        approval={{ id: "approval-1", approved: false }}
        state="output-denied"
      >
        <ConfirmationRejected>
          <ConfirmationTitle>RFI not created</ConfirmationTitle>
        </ConfirmationRejected>
      </Confirmation>,
    );

    expect(screen.getByText("RFI not created")).toBeInTheDocument();
  });

  it("removes the transitional approval message once output is available", () => {
    const { rerender } = render(
      <Confirmation
        approval={{ id: "approval-1", approved: true }}
        state="approval-responded"
      >
        <ConfirmationAccepted>
          <ConfirmationTitle>Approval recorded</ConfirmationTitle>
        </ConfirmationAccepted>
      </Confirmation>,
    );

    expect(screen.getByText("Approval recorded")).toBeInTheDocument();

    rerender(
      <Confirmation
        approval={{ id: "approval-1", approved: true }}
        state="output-available"
      >
        <ConfirmationAccepted>
          <ConfirmationTitle>Approval recorded</ConfirmationTitle>
        </ConfirmationAccepted>
      </Confirmation>,
    );

    expect(screen.queryByText("Approval recorded")).not.toBeInTheDocument();
  });
});
