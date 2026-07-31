/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { WelcomeOnboarding } from "../WelcomeOnboarding";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/hooks/use-current-user-profile", () => ({
  useCurrentUserProfile: () => ({
    profile: {
      email: "sub@example.com",
      fullName: "Brandon Clymer",
    },
  }),
}));

describe("WelcomeOnboarding", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("suppresses automatic onboarding for project-scoped external users", async () => {
    render(
      <WelcomeOnboarding
        suppressAutoOpen
        suppressStorageValue="skipped:subcontractor"
      />,
    );

    await waitFor(() => {
      expect(window.localStorage.getItem("alleato_onboarding_completed_v3")).toBe(
        "skipped:subcontractor",
      );
    });
    expect(screen.queryByText("Welcome to Alleato AI")).not.toBeInTheDocument();
  });

  it("still opens when explicitly forced", async () => {
    render(<WelcomeOnboarding forceOpen suppressAutoOpen />);

    expect(await screen.findByText("Welcome to Alleato AI")).toBeInTheDocument();
  });

  it("exposes route-backed AI actions during onboarding", async () => {
    render(<WelcomeOnboarding forceOpen suppressAutoOpen />);

    expect(await screen.findByText("Welcome to Alleato AI")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "AI onboarding actions" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review my AI profile" })).toHaveAttribute(
      "href",
      "/ai/profile",
    );
    expect(screen.getByRole("link", { name: "Review AI approvals" })).toHaveAttribute(
      "href",
      "/ai/approvals",
    );
  });

  it("combines the welcome and feedback screens into a two-step flow", async () => {
    render(<WelcomeOnboarding forceOpen suppressAutoOpen />);

    expect(await screen.findByText("Welcome, Brandon")).toBeInTheDocument();
    expect(screen.getByText("Feedback is only a click away.")).toBeInTheDocument();
    expect(screen.getByLabelText("Step 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("Set up your first test project.")).toBeInTheDocument();
    expect(screen.getByLabelText("Step 2 of 2")).toBeInTheDocument();
  });
});
