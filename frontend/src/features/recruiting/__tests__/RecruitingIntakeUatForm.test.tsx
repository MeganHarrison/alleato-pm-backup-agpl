/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RecruitingIntakeUatForm } from "@/features/recruiting/RecruitingIntakeUatForm";

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

describe("RecruitingIntakeUatForm", () => {
  it("shows the synthetic-data boundary and submits accessible fields", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const request = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          candidateId: "candidate-id",
          applicationId: "application-id",
          candidateName: "Test Candidate",
          expiresAt: "2026-07-31T12:00:00.000Z",
          resumeStatus: "quarantined",
        }),
    });
    global.fetch = request;
    global.FormData = window.FormData;

    render(
      <RecruitingIntakeUatForm
        positions={[
          {
            id: "8b6e0d1c-0569-4ce4-b815-332a024274d2",
            label: "Project Manager",
          },
        ]}
      />,
    );

    expect(
      screen.getByText(/synthetic test information only/i),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/first name/i));
    await user.type(screen.getByLabelText(/first name/i), "Test");
    await user.clear(screen.getByLabelText(/last name/i));
    await user.type(screen.getByLabelText(/last name/i), "Candidate");
    await user.type(
      screen.getByLabelText(/test email/i),
      "jazmin+uat-101@alleatogroup.com",
    );
    await user.click(screen.getByLabelText(/position/i));
    await user.click(
      await screen.findByRole("option", { name: /project manager/i }),
    );
    await user.click(screen.getByRole("checkbox", { name: /consent/i }));
    const file = new window.File(
      ["%PDF-1.7 synthetic test resume"],
      "synthetic-test-resume.pdf",
      { type: "application/pdf" },
    );
    await user.upload(screen.getByLabelText(/synthetic resume/i), file);
    const submitButton = screen.getByRole("button", {
      name: /submit test application/i,
    });
    await user.click(submitButton);

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "/api/recruiting/intake-uat",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(
      await screen.findByText(/test application received/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open candidate in pipeline/i }),
    ).toHaveAttribute(
      "href",
      "/recruiting?requisitionId=8b6e0d1c-0569-4ce4-b815-332a024274d2&applicationId=application-id&tab=pipeline",
    );
  });
});
