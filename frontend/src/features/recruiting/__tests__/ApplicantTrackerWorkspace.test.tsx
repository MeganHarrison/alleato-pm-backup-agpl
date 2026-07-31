/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApplicantTrackerWorkspace } from "@/features/recruiting/ApplicantTrackerWorkspace";

jest.setTimeout(15_000);

describe("ApplicantTrackerWorkspace", () => {
  it("shows the daily recruiting inbox and explicit recruiter test states", async () => {
    const user = userEvent.setup();
    render(<ApplicantTrackerWorkspace />);

    expect(
      screen.getByRole("heading", { name: "Applicant Tracker" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Open tasks")).toBeInTheDocument();
    expect(screen.getByText("Missing scorecards")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(
      screen.getByText("Feature readiness and kill switches"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Microsoft 365 connections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Connect Outlook email" }),
    ).toHaveAttribute(
      "href",
      "/api/recruiting/integrations/microsoft/connect?capability=mail",
    );
    expect(screen.getByText("Outlook recruiting mail")).toBeInTheDocument();
    expect(screen.getAllByText("Test enabled")).not.toHaveLength(0);
    expect(screen.getAllByText("Connect account")).not.toHaveLength(0);
    expect(screen.queryByText("Guarded")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Run Resume evidence extraction no-send preview",
      }),
    ).toBeEnabled();
    expect(
      screen.getByText(/recruiter-only synthetic intake is active/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Microsoft mailbox permission has not been verified/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Run Resume evidence extraction no-send preview",
      }),
    );
    expect(screen.getByText("Latest test result")).toBeInTheDocument();
    expect(
      screen.getByText(/Real file parsing, ranking, and hiring decisions remain disabled/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Safety result: nothing sent/i),
    ).toBeInTheDocument();
  });

  it("preserves a keyboard-accessible candidate detail path", async () => {
    const user = userEvent.setup();
    render(<ApplicantTrackerWorkspace />);

    await user.click(screen.getByRole("tab", { name: "Pipeline" }));
    await user.click(screen.getByText("Cameron Davis"));

    expect(
      screen.getByRole("heading", { name: "Cameron Davis" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Candidate identity is separate from this job-specific application.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Draft message" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Preview metadata summary" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("link", { name: "Open original resume" }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/api\/recruiting\/resumes\?documentId=/),
    );
  });

  it("shows unassigned resumes in their own routable inbox", async () => {
    const user = userEvent.setup();
    render(<ApplicantTrackerWorkspace />);

    await user.click(
      screen.getByRole("tab", { name: /Resume inbox/i }),
    );
    expect(
      screen.getByText("synthetic-resume-01.pdf"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open resume" }),
    ).toHaveAttribute(
      "href",
      "/api/recruiting/resumes?documentId=9f2713f7-b235-4305-b817-a7ae16944dc7",
    );
    expect(
      screen.getByLabelText("Position for [UAT] Resume 01"),
    ).toBeInTheDocument();
  });

  it("creates a draft position and keeps the form accessible", async () => {
    const user = userEvent.setup();
    render(<ApplicantTrackerWorkspace />);

    await user.click(screen.getByRole("tab", { name: "Requisitions" }));
    await user.click(screen.getByRole("button", { name: "Add position" }));
    await user.type(
      screen.getByLabelText("Requisition number"),
      "REQ-2026-099",
    );
    await user.type(screen.getByLabelText("Position title"), "Estimator");
    await user.type(screen.getByLabelText("Department"), "Preconstruction");
    await user.type(screen.getByLabelText("Location"), "Indianapolis, IN");
    await user.clear(screen.getByLabelText("Headcount"));
    await user.type(screen.getByLabelText("Headcount"), "2");
    await user.click(screen.getByRole("button", { name: "Create position" }));

    expect(await screen.findByText("Estimator")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("confirms lifecycle actions and removes only draft positions", async () => {
    const user = userEvent.setup();
    render(<ApplicantTrackerWorkspace />);

    await user.click(screen.getByRole("tab", { name: "Requisitions" }));
    await user.click(
      screen.getByRole("button", { name: "Actions for Project Engineer" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    expect(
      screen.getByRole("heading", { name: "Delete Project Engineer?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete position" }));

    await waitFor(() =>
      expect(screen.queryByText("Project Engineer")).not.toBeInTheDocument(),
    );
  });

  it("requires a reason before closing an active position", async () => {
    const user = userEvent.setup();
    render(<ApplicantTrackerWorkspace />);

    await user.click(screen.getByRole("tab", { name: "Requisitions" }));
    await user.click(
      screen.getByRole("button", {
        name: "Actions for Senior Project Manager",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Close position" }));

    const closeButton = screen.getByRole("button", { name: "Close position" });
    expect(closeButton).toBeDisabled();
    await user.type(
      screen.getByLabelText("Reason"),
      "The approved hiring plan has been completed.",
    );
    await user.click(closeButton);

    expect(
      await screen.findByText(/Preview position REQ-2026-015 closed/i),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
