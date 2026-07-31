import { getCommitmentChangeOrderLineItemLock } from "../commitment-change-order-status";

describe("commitment change order status", () => {
  it("treats approved status as line-item locked", () => {
    expect(getCommitmentChangeOrderLineItemLock("Approved")).toEqual({
      locked: true,
      reason: "approved",
      message:
        "Approved commitment change orders are read-only. Change the status before editing line items.",
    });
  });

  it("leaves draft status unlocked", () => {
    expect(getCommitmentChangeOrderLineItemLock("draft")).toEqual({
      locked: false,
      reason: null,
      message: null,
    });
  });
});
