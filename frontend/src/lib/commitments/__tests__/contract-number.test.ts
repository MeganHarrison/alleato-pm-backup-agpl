import {
  hasCommitmentContractNumberPrefix,
  normalizeCommitmentContractNumber,
} from "../contract-number";

describe("normalizeCommitmentContractNumber", () => {
  it("adds the subcontract prefix when missing", () => {
    expect(normalizeCommitmentContractNumber("123", "SC-")).toBe("SC-123");
  });

  it("normalizes lowercase subcontract prefixes", () => {
    expect(normalizeCommitmentContractNumber("sc-123", "SC-")).toBe("SC-123");
  });

  it("replaces a PO prefix when normalizing a subcontract", () => {
    expect(normalizeCommitmentContractNumber("PO-123", "SC-")).toBe("SC-123");
  });

  it("adds the purchase-order prefix when missing", () => {
    expect(normalizeCommitmentContractNumber("8189-0001", "PO-")).toBe(
      "PO-8189-0001",
    );
  });

  it("replaces an SC prefix when normalizing a purchase order", () => {
    expect(normalizeCommitmentContractNumber("SC-8189-0001", "PO-")).toBe(
      "PO-8189-0001",
    );
  });
});

describe("hasCommitmentContractNumberPrefix", () => {
  it("matches the expected prefix case-insensitively", () => {
    expect(hasCommitmentContractNumberPrefix("po-100", "PO-")).toBe(true);
  });

  it("rejects the wrong prefix", () => {
    expect(hasCommitmentContractNumberPrefix("SC-100", "PO-")).toBe(false);
  });
});
