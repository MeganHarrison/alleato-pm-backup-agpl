// Budget Views Configuration Types
// Corresponds to the budget_views and budget_view_columns tables

export interface BudgetViewColumn {
  id: string;
  view_id: string;
  column_key: string;
  display_name: string | null;
  display_order: number;
  width: number | null;
  is_visible: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetViewDefinition {
  id: string;
  project_id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  columns?: BudgetViewColumn[];
}

export interface CreateBudgetViewRequest {
  name: string;
  description?: string;
  is_default?: boolean;
  columns: Array<{
    column_key: string;
    display_name?: string;
    display_order: number;
    width?: number;
    is_visible?: boolean;
    is_locked?: boolean;
  }>;
}

export interface UpdateBudgetViewRequest {
  name?: string;
  description?: string;
  is_default?: boolean;
  columns?: Array<{
    id?: string;
    column_key: string;
    display_name?: string;
    display_order: number;
    width?: number;
    is_visible?: boolean;
    is_locked?: boolean;
  }>;
}

export interface CloneBudgetViewRequest {
  source_view_id: string;
  new_name: string;
  new_description?: string;
}

// Available budget table columns
export const AVAILABLE_BUDGET_COLUMNS = [
  { key: "costCode", label: "Cost Code", locked: true, defaultVisible: true },
  {
    key: "description",
    label: "Description",
    locked: true,
    defaultVisible: true,
  },
  {
    key: "originalBudgetAmount",
    label: "Original Budget",
    locked: false,
    defaultVisible: true,
  },
  { key: "unitQty", label: "Unit Qty", locked: false, defaultVisible: false },
  { key: "uom", label: "UOM", locked: false, defaultVisible: false },
  { key: "unitCost", label: "Unit Cost", locked: false, defaultVisible: false },
  {
    key: "budgetModifications",
    label: "Budget Modifications",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "approvedCOs",
    label: "Approved COs",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "revisedBudget",
    label: "Revised Budget",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "jobToDateCostDetail",
    label: "Job-to-Date Cost",
    locked: false,
    defaultVisible: false,
  },
  {
    key: "directCosts",
    label: "Direct Costs",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "pendingChanges",
    label: "Pending Changes",
    locked: false,
    defaultVisible: false,
  },
  {
    key: "projectedBudget",
    label: "Projected Budget",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "committedCosts",
    label: "Committed Costs",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "pendingCostChanges",
    label: "Pending Cost Changes",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "projectedCosts",
    label: "Projected Costs",
    locked: false,
    defaultVisible: true,
  },
  {
    key: "forecastToComplete",
    label: "Forecast to Complete",
    locked: false,
    defaultVisible: false,
  },
  {
    key: "estimatedCostAtCompletion",
    label: "Est. Cost at Completion",
    locked: false,
    defaultVisible: false,
  },
  {
    key: "projectedOverUnder",
    label: "Projected Over/Under",
    locked: false,
    defaultVisible: true,
  },
] as const;

export type BudgetColumnKey = (typeof AVAILABLE_BUDGET_COLUMNS)[number]["key"];
