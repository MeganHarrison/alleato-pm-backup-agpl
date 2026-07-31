import {
  resolvePromotedPccoTotalAmount,
  sumPcoLineItemAmounts,
} from "@/lib/prime-contract-pcos/promote-total";

describe("resolvePromotedPccoTotalAmount", () => {
  it("uses the PCO's marked-up total instead of the base line-item sum (regression: PPCO-001)", () => {
    // Repro from production project 1141: base $20,000 + 1.35% insurance ($270) + 10% fee
    // ($2,000) = $22,270 stored on prime_contract_pcos.total_amount. The promoted PCCO must
    // carry $22,270, not the $20,000 base sum, or the owner-facing change order is understated.
    const pco = { total_amount: 22270 };
    const lineItems = [{ amount: 20000 }];

    expect(resolvePromotedPccoTotalAmount(pco, lineItems)).toBe(22270);
  });

  it("falls back to the summed base line items when the PCO has no persisted total", () => {
    const pco = { total_amount: null };
    const lineItems = [{ amount: 12000 }, { amount: 3500 }];

    expect(resolvePromotedPccoTotalAmount(pco, lineItems)).toBe(15500);
  });

  it("treats undefined total_amount as no persisted total", () => {
    const pco = { total_amount: undefined };
    const lineItems = [{ amount: 500 }];

    expect(resolvePromotedPccoTotalAmount(pco, lineItems)).toBe(500);
  });

  it("preserves a legitimate zero total rather than falling back to line items", () => {
    const pco = { total_amount: 0 };
    const lineItems = [{ amount: 999 }];

    expect(resolvePromotedPccoTotalAmount(pco, lineItems)).toBe(0);
  });

  it("coerces numeric-string totals (Postgres numeric columns arrive as strings)", () => {
    const pco = { total_amount: "22270.00" };
    const lineItems = [{ amount: "20000.00" }];

    expect(resolvePromotedPccoTotalAmount(pco, lineItems)).toBe(22270);
  });

  it("falls back to line items when the stored total is not a finite number", () => {
    const pco = { total_amount: "not-a-number" };
    const lineItems = [{ amount: 4000 }];

    expect(resolvePromotedPccoTotalAmount(pco, lineItems)).toBe(4000);
  });
});

describe("sumPcoLineItemAmounts", () => {
  it("returns 0 for null / empty line items", () => {
    expect(sumPcoLineItemAmounts(null)).toBe(0);
    expect(sumPcoLineItemAmounts(undefined)).toBe(0);
    expect(sumPcoLineItemAmounts([])).toBe(0);
  });

  it("ignores non-numeric amounts", () => {
    expect(sumPcoLineItemAmounts([{ amount: 100 }, { amount: null }, { amount: "x" }])).toBe(100);
  });
});
