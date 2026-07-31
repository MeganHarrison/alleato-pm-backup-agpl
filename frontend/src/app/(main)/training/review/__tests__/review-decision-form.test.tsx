/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

import { ReviewDecisionForm } from "../review-decision-form";

jest.mock("../actions", () => ({
  decideTrainingResource: jest.fn(),
}));

jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  useFormStatus: () => ({ pending: false }),
}));

describe("ReviewDecisionForm", () => {
  it("captures structured reasons, ratings, and preserved written feedback", () => {
    render(
      <ReviewDecisionForm resourceId="9b2ce458-b438-4147-96a0-54f28a58b994" />,
    );

    const notes = screen.getByLabelText("Review feedback");
    expect(notes).toHaveAttribute("name", "notes");
    expect(notes).toHaveAttribute("maxlength", "1000");

    const publish = screen.getByRole("button", { name: "Publish" });
    const archive = screen.getByRole("button", { name: "Archive" });
    expect(publish).toHaveAttribute("name", "decision");
    expect(publish).toHaveAttribute("value", "publish");
    expect(archive).toHaveAttribute("name", "decision");
    expect(archive).toHaveAttribute("value", "archive");
    const strength = screen.getByLabelText("Strong field applicability");
    const concern = screen.getByLabelText("Wrong role or topic");
    fireEvent.click(strength);
    fireEvent.click(concern);
    expect(strength).toBeChecked();
    expect(concern).toBeChecked();
    expect(
      document.querySelectorAll('input[name="reasonCodes"]:checked'),
    ).toHaveLength(2);
    expect(screen.getByLabelText("Relevance")).toBeInTheDocument();
    expect(screen.getByLabelText("Depth")).toBeInTheDocument();
    expect(screen.getByLabelText("Quality")).toBeInTheDocument();

    fireEvent.change(notes, {
      target: { value: "The source is paid and too shallow." },
    });
    expect(notes).toHaveValue("The source is paid and too shallow.");
  });

  it("uses resource-scoped control ids when the queue renders multiple forms", () => {
    render(
      <>
        <ReviewDecisionForm resourceId="9b2ce458-b438-4147-96a0-54f28a58b994" />
        <ReviewDecisionForm resourceId="51e08bb3-101d-44ca-b1a9-f6a59792cb13" />
      </>,
    );

    const relevanceControls = screen.getAllByLabelText("Relevance");
    expect(relevanceControls).toHaveLength(2);
    expect(relevanceControls[0]).not.toHaveAttribute(
      "id",
      relevanceControls[1].getAttribute("id"),
    );
  });
});
