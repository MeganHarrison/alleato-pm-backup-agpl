import {
  EMPTY_COST_BREAKDOWN_SERIES,
  getAvailableCostBreakdownDimension,
  normalizeCostBreakdownSeries,
  rankProjectsByVisibleRevenue,
} from "./dashboard-contract";

describe("accounting dashboard contract", () => {
  it("normalizes a legacy response without cost breakdown data", () => {
    expect(normalizeCostBreakdownSeries(undefined)).toEqual(
      EMPTY_COST_BREAKDOWN_SERIES,
    );
  });

  it("preserves valid breakdown arrays", () => {
    const byDivision = [
      {
        groupKey: "01",
        groupLabel: "General Requirements",
        totalCost: 12,
        billCount: 1,
        monthlyCosts: [{ month: "2026-07", total: 12 }],
      },
    ];

    expect(normalizeCostBreakdownSeries({ byDivision })).toEqual({
      byDivision,
      byAccount: [],
    });
  });

  it("falls back to the available cost dimension", () => {
    const group = {
      groupKey: "5000",
      groupLabel: "Direct cost",
      totalCost: 12,
      billCount: 1,
      monthlyCosts: [{ month: "2026-07", total: 12 }],
    };

    expect(
      getAvailableCostBreakdownDimension({
        byDivision: [],
        byAccount: [group],
      }),
    ).toBe("account");
    expect(
      getAvailableCostBreakdownDimension({
        byDivision: [group],
        byAccount: [],
      }),
    ).toBe("division");
    expect(
      getAvailableCostBreakdownDimension(EMPTY_COST_BREAKDOWN_SERIES),
    ).toBeNull();
  });

  it("ranks project revenue by the collected-plus-open measure", () => {
    const ranked = rankProjectsByVisibleRevenue([
      {
        project: "highest invoiced but lower visible position",
        totalInvoiced: 1_000,
        totalCollected: 100,
        outstandingBalance: 50,
      },
      {
        project: "highest visible position",
        totalInvoiced: 200,
        totalCollected: 175,
        outstandingBalance: 75,
      },
    ]);

    expect(ranked.map((project) => project.project)).toEqual([
      "highest visible position",
      "highest invoiced but lower visible position",
    ]);
  });
});
