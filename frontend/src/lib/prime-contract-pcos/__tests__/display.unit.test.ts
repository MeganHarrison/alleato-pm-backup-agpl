import {
  formatPrimeContractPcoNumber,
  getPrimeContractPcoDisplayName,
} from "../display";

describe("prime contract PCO display", () => {
  it("normalizes PPCO numbers into the Prime PCO naming convention", () => {
    expect(formatPrimeContractPcoNumber("PPCO-001")).toBe("Prime PCO-001");
    expect(formatPrimeContractPcoNumber(" ppco-014 ")).toBe("Prime PCO-014");
  });

  it("falls back safely when the number is unavailable", () => {
    expect(getPrimeContractPcoDisplayName({ title: "Laundry deduct" })).toBe(
      "Laundry deduct",
    );
    expect(getPrimeContractPcoDisplayName({})).toBe("Prime Contract PCO");
  });
});
