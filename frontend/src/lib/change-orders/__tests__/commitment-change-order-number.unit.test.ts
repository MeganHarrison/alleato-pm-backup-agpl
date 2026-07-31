import { buildNextCommitmentChangeOrderNumber } from "../commitment-change-order-number";

describe("buildNextCommitmentChangeOrderNumber", () => {
  it("generates the next CCO number from the existing commitment CO count", () => {
    expect(buildNextCommitmentChangeOrderNumber(0)).toBe("CCO-001");
    expect(buildNextCommitmentChangeOrderNumber(9)).toBe("CCO-010");
    expect(buildNextCommitmentChangeOrderNumber(42)).toBe("CCO-043");
  });
});
