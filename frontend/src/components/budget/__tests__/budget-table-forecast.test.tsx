/**
 * @jest-environment jsdom
 *
 * Guardrail for feedback #560: division / rollup (parent) rows must NOT show a
 * Forecast to Complete value. Forecast to Complete is a leaf-level cost
 * projection, so parent rows render blank — matching Procore, where only detail
 * rows carry a forecast. Before this fix, parent rows displayed an aggregated
 * forecast value the user could not act on.
 */

import { render, screen } from "@testing-library/react";
import { BudgetTable } from "../budget-table";
import type { BudgetLineItem, BudgetGrandTotals } from "@/types/budget";

function makeLine(overrides: Partial<BudgetLineItem>): BudgetLineItem {
  return {
    id: "line",
    costCode: "00-0000",
    description: "Line",
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

const grandTotals: BudgetGrandTotals = {
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
  forecastToComplete: 5000,
  estimatedCostAtCompletion: 0,
  projectedOverUnder: 0,
};

describe("BudgetTable — Forecast to Complete on division rows (feedback #560)", () => {
  it("blanks the forecast on a division/parent row but keeps it on a leaf row", () => {
    const division = makeLine({
      id: "division-1",
      costCode: "50-0000",
      description: "50 Engineering",
      // A distinctive aggregated forecast value that must NOT be rendered.
      forecastToComplete: 77777,
      children: [
        makeLine({
          id: "leaf-1",
          costCode: "50-1000",
          description: "Design",
          forecastToComplete: 5000,
        }),
      ],
    });

    const leaf = makeLine({
      id: "leaf-standalone",
      costCode: "60-1000",
      description: "Standalone",
      forecastToComplete: 4200,
    });

    render(<BudgetTable data={[division, leaf]} grandTotals={grandTotals} />);

    // The parent/division row renders a blank forecast cell...
    expect(screen.getAllByTestId("forecast-blank").length).toBeGreaterThan(0);
    // ...and never surfaces its aggregated forecast value.
    expect(screen.queryByText("$77,777.00")).not.toBeInTheDocument();

    // A standalone leaf row still shows its own forecast value.
    expect(screen.getByText("$4,200.00")).toBeInTheDocument();
  });
});
