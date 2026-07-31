/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import TrainingMethodPage from "../page";

describe("TrainingMethodPage", () => {
  it("renders the method content", () => {
    render(<TrainingMethodPage />);

    expect(screen.getByText("The Method, at a Glance")).toBeInTheDocument();
    expect(screen.getByText("Own it")).toBeInTheDocument();
  });
});
