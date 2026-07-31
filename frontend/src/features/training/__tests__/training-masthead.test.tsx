/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { TrainingMasthead } from "../TrainingMasthead";

describe("TrainingMasthead", () => {
  it("renders the approved hub navigation and primary content", () => {
    render(
      <TrainingMasthead
        eyebrow="Alleato Training Library"
        title="Own Your Growth"
        description="Learn one precise rep at a time."
      />,
    );

    const heading = screen.getByRole("heading", {
      name: "Own Your Growth",
      level: 1,
    });

    expect(heading).toHaveClass(
      "font-sans",
      "text-4xl",
      "tracking-wider",
      "sm:text-5xl",
      "lg:text-6xl",
    );
    expect(heading.parentElement).toHaveClass(
      "pb-12",
      "pt-5",
      "sm:pb-16",
      "lg:pb-20",
    );
    expect(
      screen.queryByText("Your partner from the ground up."),
    ).not.toBeInTheDocument();
    expect(screen.queryByAltText("Alleato Group")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Training Library" }),
    ).toHaveAttribute("href", "/training/library");
    expect(screen.getByRole("link", { name: "Start Here" })).toHaveAttribute(
      "href",
      "/training#start-here",
    );
  });

  it("renders the Resource Library back path without duplicating hub navigation", () => {
    render(
      <TrainingMasthead
        variant="section"
        eyebrow="Alleato Training Library"
        title="Construction Resource Library"
        description="Free, vetted construction training."
        backLink={{ href: "/training", label: "Back to training platform" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Back to training platform" }),
    ).toHaveAttribute("href", "/training");
    expect(
      screen.queryByRole("navigation", { name: "Training sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Your partner from the ground up."),
    ).toBeInTheDocument();
  });
});
