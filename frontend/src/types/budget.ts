export type ForecastMethod =
  | "automatic"
  | "manual"
  | "lump_sum"
  | "monitored_resources";

export interface BudgetLineItem {
  id: string;
  costCode: string;
  /** Human-readable cost code label, e.g. "01-3245" */
  costCodeDescription?: string;
  /** Cost type letter code, e.g. "X", "L", "M" */
  costType?: string;
  /** Division title resolved from cost_code_divisions, e.g. "50 Engineering" */
  divisionTitle?: string;
  description: string;
  originalBudgetAmount: number;
  unitQty?: number;
  uom?: string;
  unitCost?: number;
  budgetModifications: number;
  approvedCOs: number;
  revisedBudget: number;
  jobToDateCostDetail: number;
  directCosts: number;
  pendingChanges: number;
  projectedBudget: number;
  committedCosts: number;
  pendingCostChanges: number;
  projectedCosts: number;
  forecastToComplete: number;
  estimatedCostAtCompletion: number;
  projectedOverUnder: number;
  forecastMethod?: ForecastMethod;
  forecastNotes?: string | null;
  forecastStartDate?: string | null;
  forecastEndDate?: string | null;
  children?: BudgetLineItem[];
  expanded?: boolean;
}

export interface BudgetView {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface BudgetSnapshot {
  id: string;
  name: string;
  date?: Date;
  isCurrent?: boolean;
}

export interface BudgetGroup {
  id: string;
  name: string;
}

export interface BudgetFilter {
  id: string;
  field: string;
  operator: "equals" | "contains" | "greaterThan" | "lessThan";
  value: string | number;
}

export interface BudgetSyncStatus {
  isSynced: boolean;
  lastJobCostUpdate?: string;
  lastDirectCostUpdate?: string;
  erpSystem?: string;
}

export interface BudgetGrandTotals {
  originalBudgetAmount: number;
  budgetModifications: number;
  approvedCOs: number;
  revisedBudget: number;
  jobToDateCostDetail: number;
  directCosts: number;
  pendingChanges: number;
  projectedBudget: number;
  committedCosts: number;
  pendingCostChanges: number;
  projectedCosts: number;
  forecastToComplete: number;
  estimatedCostAtCompletion: number;
  projectedOverUnder: number;
}
