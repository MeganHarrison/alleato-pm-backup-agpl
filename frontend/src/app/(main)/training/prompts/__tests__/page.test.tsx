/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import TrainingPromptsPage from "../page";

describe("TrainingPromptsPage", () => {
  it("renders every prompt starter", () => {
    render(<TrainingPromptsPage />);

    expect(screen.getByText("AI Prompt Starters")).toBeInTheDocument();
    expect(
      screen.getByText(/Explain how to read a civil grading plan/),
    ).toBeInTheDocument();
  });
});
