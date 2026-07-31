/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import TrainingHubPage from "../page";

jest.mock("@/components/layout", () => ({
  PageShell: ({
    title,
    showHeader,
    children,
  }: {
    title: string;
    showHeader?: boolean;
    children: React.ReactNode;
  }) => (
    <main>
      {showHeader === false ? null : <h1>{title}</h1>}
      {children}
    </main>
  ),
}));

describe("TrainingHubPage", () => {
  it("renders the approved hero treatment and compact training navigation", () => {
    render(<TrainingHubPage />);

    expect(
      screen.getByRole("heading", { name: "Own Your Growth", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByAltText("Alleato Group")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Your partner from the ground up."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Take the Assessment" }),
    ).toHaveAttribute("href", "/training/growth");
    expect(
      screen.getByRole("link", { name: "Training Library" }),
    ).toHaveAttribute("href", "/training/library");
    expect(screen.getByRole("link", { name: "The Method" })).toHaveAttribute(
      "href",
      "/training/method",
    );
    expect(screen.getByRole("link", { name: "My Growth" })).toHaveAttribute(
      "href",
      "/training/growth",
    );
    expect(screen.getByRole("link", { name: "Start Here" })).toHaveAttribute(
      "href",
      "/training#start-here",
    );
    expect(
      screen.getByRole("link", { name: "Ask the Library" }),
    ).toHaveAttribute("href", "/training/ask");
  });

  it("links the PM and Field track tiles to their real handbook + library routes", () => {
    render(<TrainingHubPage />);

    expect(screen.getByRole("link", { name: /PM Handbook/ })).toHaveAttribute(
      "href",
      "/training/guides/pm-handbook",
    );
    expect(
      screen.getByRole("link", { name: /Superintendent Handbook/ }),
    ).toHaveAttribute("href", "/training/guides/superintendent-handbook");
    expect(
      screen.getAllByRole("link", { name: /Resource Library/ }).length,
    ).toBeGreaterThan(0);
  });

  it("links the Skill Wheel and manager coaching module to built destinations", () => {
    render(<TrainingHubPage />);

    expect(
      screen.getByRole("link", { name: "Build your wheel" }),
    ).toHaveAttribute("href", "/training/growth");
    expect(
      screen.getByRole("link", { name: "Manager coaching guide" }),
    ).toHaveAttribute("href", "/training/guides/manager-coaching-guide");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("keeps every hub destination inside Alleato", () => {
    render(<TrainingHubPage />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/training(?:\/|#|$)/);
      expect(link).not.toHaveAttribute("target", "_blank");
    }
  });

  it("renders the eight-card reference library without a duplicate section title", () => {
    const { container } = render(<TrainingHubPage />);

    expect(
      screen.queryByText("The Alleato Training Library"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Courses · Own Your Growth + Running a Project"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/More coming soon/)).not.toBeInTheDocument();
    expect(container.querySelector("#start-here > div")).not.toHaveClass(
      "max-w-content-wide",
    );
    expect(screen.getAllByText("Ask the Library")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Ask a question" }),
    ).toHaveAttribute("href", "/training/ask");
  });
});
