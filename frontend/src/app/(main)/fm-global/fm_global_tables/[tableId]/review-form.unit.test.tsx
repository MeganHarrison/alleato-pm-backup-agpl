/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

import { FmdsTableReviewForm } from "./review-form";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

describe("FmdsTableReviewForm", () => {
  it("blocks approval and explains the recovery path when no structured candidate exists", () => {
    render(
      <FmdsTableReviewForm
        tableId="17d4bb4f-55aa-4606-a114-dfa622c86759"
        evidencePath="FMDS0834/2026-04/pages/page-012.png"
        candidateIds={["5bfcf857-a162-485c-aa17-3ca85fe5ddc7"]}
        canApprove={false}
      />,
    );

    expect(screen.getByRole("radio", { name: /Approved/i })).toBeDisabled();
    expect(
      screen.getByText(/no structured table candidate to compare/i),
    ).toBeVisible();
    expect(screen.queryByLabelText(/Review notes/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
  });

  it("starts unbiased and treats the Approved radio as the exact-match confirmation", () => {
    render(
      <FmdsTableReviewForm
        tableId="table-with-rows"
        evidencePath="FMDS0834/2026-04/pages/page-020.png"
        candidateIds={["5bfcf857-a162-485c-aa17-3ca85fe5ddc7"]}
        canApprove
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(
      screen
        .getAllByRole("radio")
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Approved/i }));

    expect(screen.queryByLabelText(/Review notes/i)).not.toBeInTheDocument();
    expect(screen.getByText("No notes needed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled();
  });

  it("shows required notes only after Needs changes is selected", () => {
    const reason =
      "Approved is unavailable because the automated cross-check found discrepancies or marked this extraction partial. Choose Needs changes and describe the exact issue.";
    render(
      <FmdsTableReviewForm
        tableId="flagged-candidate"
        evidencePath="FMDS0834/2026-04/crop.png"
        candidateIds={["5bfcf857-a162-485c-aa17-3ca85fe5ddc7"]}
        canApprove={false}
        approvalBlockedReason={reason}
      />,
    );

    expect(screen.getByRole("radio", { name: /Approved/i })).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Needs changes/i }),
    ).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(reason);

    fireEvent.click(screen.getByRole("radio", { name: /Needs changes/i }));

    expect(screen.getByLabelText(/Review notes/i)).toBeRequired();
    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
  });
});
