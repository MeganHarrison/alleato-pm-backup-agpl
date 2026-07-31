import {
  DEFAULT_LINE_ITEM_REVENUE_SOURCE,
  calculateChangeEventOverUnder,
  computeLineItemRevenueRom,
  resolveRevenueSource,
  toCurrencyNumber,
} from "../financial-summary";

describe("change event financial summary", () => {
  it("calculates over/under from numeric or API string totals", () => {
    expect(
      calculateChangeEventOverUnder({ revenueRom: "1250.50", costRom: "1000.25" }),
    ).toBe(250.25);

    expect(
      calculateChangeEventOverUnder({ revenueRom: 900, costRom: "1000" }),
    ).toBe(-100);
  });

  it("coerces unusable currency totals to zero", () => {
    expect(toCurrencyNumber("not-a-number")).toBe(0);
    expect(toCurrencyNumber(Number.NaN)).toBe(0);
    expect(toCurrencyNumber(null)).toBe(0);
  });
});

describe("resolveRevenueSource", () => {
  it("defaults an unset/empty source to Procore's match-cost default", () => {
    expect(resolveRevenueSource(null)).toBe(DEFAULT_LINE_ITEM_REVENUE_SOURCE);
    expect(resolveRevenueSource(undefined)).toBe(DEFAULT_LINE_ITEM_REVENUE_SOURCE);
    expect(resolveRevenueSource("   ")).toBe(DEFAULT_LINE_ITEM_REVENUE_SOURCE);
  });

  it("preserves an explicitly-chosen source", () => {
    expect(resolveRevenueSource("Enter manually")).toBe("Enter manually");
    expect(resolveRevenueSource("Quantity x Unit Cost")).toBe("Quantity x Unit Cost");
  });
});

describe("computeLineItemRevenueRom", () => {
  it("rolls up revenue = cost when no revenue source is set (the reported bug)", () => {
    // QA repro: cost $20,000, revenue_rom null, source unset, expecting revenue.
    expect(
      computeLineItemRevenueRom({
        expectingRevenue: true,
        revenueSource: null,
        costRom: 20000,
        revenueRom: null,
      }),
    ).toBe(20000);
  });

  it("mirrors cost for the explicit match-cost source", () => {
    for (const source of ["Match Revenue to Latest Cost"]) {
      expect(
        computeLineItemRevenueRom({
          expectingRevenue: true,
          revenueSource: source,
          costRom: "1500",
          revenueRom: 0,
        }),
      ).toBe(1500);
    }
  });

  it("uses the entered revenue for manual / quantity-based sources", () => {
    expect(
      computeLineItemRevenueRom({
        expectingRevenue: true,
        revenueSource: "Enter manually",
        costRom: 20000,
        revenueRom: 25000,
      }),
    ).toBe(25000);

    expect(
      computeLineItemRevenueRom({
        expectingRevenue: true,
        revenueSource: "Quantity x Unit Cost",
        costRom: 20000,
        revenueRom: "18000",
      }),
    ).toBe(18000);
  });

  it("yields zero when the change event is not expecting revenue", () => {
    expect(
      computeLineItemRevenueRom({
        expectingRevenue: false,
        revenueSource: null,
        costRom: 20000,
        revenueRom: 20000,
      }),
    ).toBe(0);
  });
});
