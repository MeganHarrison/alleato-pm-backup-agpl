export interface CostBreakdownSeries {
  groupKey: string;
  groupLabel: string;
  totalCost: number;
  billCount: number;
  monthlyCosts: Array<{ month: string; total: number }>;
}

export interface CostBreakdownSeriesResponse {
  byDivision: CostBreakdownSeries[];
  byAccount: CostBreakdownSeries[];
}

export type CostBreakdownDimension = "division" | "account";

export interface VisibleProjectRevenue {
  totalCollected: number;
  outstandingBalance: number;
}

export const EMPTY_COST_BREAKDOWN_SERIES: CostBreakdownSeriesResponse = {
  byDivision: [],
  byAccount: [],
};

export function normalizeCostBreakdownSeries(
  value: Partial<CostBreakdownSeriesResponse> | null | undefined,
): CostBreakdownSeriesResponse {
  return {
    byDivision: Array.isArray(value?.byDivision) ? value.byDivision : [],
    byAccount: Array.isArray(value?.byAccount) ? value.byAccount : [],
  };
}

export function getAvailableCostBreakdownDimension(
  breakdown: CostBreakdownSeriesResponse,
  preferred: CostBreakdownDimension = "division",
): CostBreakdownDimension | null {
  const preferredSeries =
    preferred === "division" ? breakdown.byDivision : breakdown.byAccount;
  if (preferredSeries.length > 0) return preferred;

  const fallback = preferred === "division" ? "account" : "division";
  const fallbackSeries =
    fallback === "division" ? breakdown.byDivision : breakdown.byAccount;
  return fallbackSeries.length > 0 ? fallback : null;
}

export function visibleProjectRevenueTotal(
  project: VisibleProjectRevenue,
): number {
  return project.totalCollected + project.outstandingBalance;
}

export function rankProjectsByVisibleRevenue<
  TProject extends VisibleProjectRevenue,
>(projects: TProject[]): TProject[] {
  return [...projects].sort(
    (left, right) =>
      visibleProjectRevenueTotal(right) - visibleProjectRevenueTotal(left),
  );
}
