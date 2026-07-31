import {
  canDeletePrimeContractChangeOrderStatus,
  normalizePrimeContractChangeOrderStatus,
  primeContractChangeOrderDeleteBlockedMessage,
} from "../prime-contract-change-order-statuses";

describe("prime contract change order statuses", () => {
  it("treats proposed change orders as deletable", () => {
    expect(canDeletePrimeContractChangeOrderStatus("Proposed")).toBe(true);
    expect(canDeletePrimeContractChangeOrderStatus(" proposed ")).toBe(true);
  });

  it("blocks executed/approved statuses with the exact allowed status set", () => {
    expect(canDeletePrimeContractChangeOrderStatus("Approved")).toBe(false);
    expect(primeContractChangeOrderDeleteBlockedMessage("Approved")).toBe(
      'Cannot delete a change order with status "approved". Only draft, proposed, pending, or rejected change orders can be deleted.',
    );
  });

  it("normalizes legacy proposed values for form controls", () => {
    expect(normalizePrimeContractChangeOrderStatus("Proposed")).toBe("pending");
  });
});
