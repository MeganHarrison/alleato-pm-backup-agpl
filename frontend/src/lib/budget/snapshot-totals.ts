/**
 * Budget-snapshot summary projection.
 */

/**
 * Shape of the `grand_totals` JSON column on `budget_snapshots`.
 * The payload uses the canonical Procore-parity GrandTotals shape.
 */
export interface SnapshotGrandTotalsJson {
  snapshot_date?: string;
  originalBudgetAmount?: number;
  budgetModifications?: number;
  approvedCOs?: number;
  revisedBudget?: number;
  jobToDateCostDetail?: number;
  directCosts?: number;
  pendingChanges?: number;
  projectedBudget?: number;
  committedCosts?: number;
  pendingCostChanges?: number;
  projectedCosts?: number;
  forecastToComplete?: number;
  estimatedCostAtCompletion?: number;
  projectedOverUnder?: number;
}

export interface FlatSnapshotTotals {
  snapshot_date: string;
  total_budget: number;
  total_costs: number;
  variance: number;
}

/**
 * Project the canonical totals payload into the list view's summary fields.
 */
export function flattenSnapshotTotals(
  grandTotals: SnapshotGrandTotalsJson | null | undefined,
  fallbackDate: string,
): FlatSnapshotTotals {
  const t = grandTotals ?? {};

  const total_budget = Number(t.revisedBudget ?? 0);
  const total_costs = Number(t.projectedCosts ?? 0);
  return {
    snapshot_date: t.snapshot_date ?? fallbackDate,
    total_budget,
    total_costs,
    variance: total_budget - total_costs,
  };
}
