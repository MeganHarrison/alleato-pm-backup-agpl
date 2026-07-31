/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { MethodContent } from "../MethodContent";

describe("MethodContent", () => {
  it("renders all four principles and all six steps", () => {
    render(<MethodContent />);

    expect(screen.getByText("Own it")).toBeInTheDocument();
    expect(screen.getByText("Focus your energy")).toBeInTheDocument();
    expect(
      screen.getByText("Start from your role's skills"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cadence & re-score")).toBeInTheDocument();
  });

  it("renders the honesty rubric bands", () => {
    render(<MethodContent />);

    expect(screen.getByText("Aware")).toBeInTheDocument();
    expect(screen.getByText("Teach")).toBeInTheDocument();
  });

  it("renders the toolkit and proficiency checklist", () => {
    render(<MethodContent />);

    expect(screen.getByText("The 1-3-1 rule")).toBeInTheDocument();
    expect(
      screen.getByText(/You make people around you better/),
    ).toBeInTheDocument();
  });
});
