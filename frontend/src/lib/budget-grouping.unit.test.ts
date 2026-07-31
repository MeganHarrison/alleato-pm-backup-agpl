import {
  calculateGrandTotals,
  groupByDivision,
} from "./budget-grouping";
import type { BudgetLineItem } from "@/types/budget";

function makeLine(overrides: Partial<BudgetLineItem>): BudgetLineItem {
  return {
    id: "line-1",
    description: "Test line",
    costCode: "01-100",
    costCodeDescription: "General Conditions",
    costType: "L",
    division: "01",
    divisionTitle: "",
    subJob: "",
    originalBudgetAmount: 0,
    budgetModifications: 0,
    approvedCOs: 0,
    revisedBudget: 0,
    jobToDateCostDetail: 0,
    directCosts: 0,
    pendingChanges: 0,
    projectedBudget: 0,
    committedCosts: 0,
    pendingCostChanges: 0,
    projectedCosts: 0,
    forecastToComplete: 0,
    estimatedCostAtCompletion: 0,
    projectedOverUnder: 0,
    ...overrides,
  };
}

describe("budget grouping totals", () => {
  it("keeps financial grand totals signed", () => {
    const totals = calculateGrandTotals([
      makeLine({ budgetModifications: 100 }),
      makeLine({ id: "line-2", budgetModifications: -100 }),
    ]);

    expect(totals.budgetModifications).toBe(0);
  });

  it("keeps grouped budget-modification totals signed for export parity", () => {
    const totals = calculateGrandTotals([
      makeLine({
        id: "division-01",
        budgetModifications: -50,
        children: [
          makeLine({ id: "line-1", budgetModifications: 25 }),
          makeLine({ id: "line-2", budgetModifications: -75 }),
        ],
      }),
    ]);

    expect(totals.budgetModifications).toBe(-50);
  });
});

describe("division group titles", () => {
  it("uses the database division title carried on line items", () => {
    const groups = groupByDivision([
      makeLine({
        id: "line-50",
        costCode: "50-6500",
        divisionTitle: "50 Engineering",
      }),
    ]);

    expect(groups).toHaveLength(1);
    // Leading division code is stripped — the group row renders the code itself.
    expect(groups[0].description).toBe("Engineering");
  });

  it("falls back to the static CSI map when no database title exists", () => {
    const groups = groupByDivision([
      makeLine({ id: "line-03", costCode: "03-3000", divisionTitle: "" }),
    ]);

    expect(groups[0].description).toBe("Concrete");
  });
});
