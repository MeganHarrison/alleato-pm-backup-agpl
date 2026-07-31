import {
  getCommitmentSovLockState,
  hasSubmittedCommitmentInvoice,
} from "../commitment-sov-lock";

describe("commitment SOV lock", () => {
  it("stays unlocked before invoice submission begins", () => {
    expect(
      getCommitmentSovLockState({
        hasSubmittedInvoice: false,
      }),
    ).toEqual({
      locked: false,
      reason: null,
      message: null,
    });
  });

  it("locks after invoice submission begins", () => {
    expect(
      getCommitmentSovLockState({
        hasSubmittedInvoice: true,
      }),
    ).toEqual({
      locked: true,
      reason: "submitted_invoice",
      message:
        "A commitment invoice has already been submitted, so the schedule of values stays locked to protect invoice history.",
    });
  });

  it("treats submitted invoice workflow statuses as lock evidence", () => {
    expect(
      hasSubmittedCommitmentInvoice([
        {
          status: "under_review",
          submitted_at: "2026-07-02T18:00:00.000Z",
          approved_at: null,
        },
      ]),
    ).toBe(true);
  });

  it("ignores draft invoices that have not been submitted", () => {
    expect(
      hasSubmittedCommitmentInvoice([
        {
          status: "draft",
          submitted_at: null,
          approved_at: null,
        },
      ]),
    ).toBe(false);
  });
});
