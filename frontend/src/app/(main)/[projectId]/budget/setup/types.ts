/**
 * Types for the Budget Setup page components
 */

export interface ProjectCostCode {
  id: string;
  cost_code_id: string;
  cost_type_id: string | null;
  is_active: boolean | null;
  cost_codes: {
    id: string;
    title: string | null;
    division_title: string | null;
  } | null;
  cost_code_types: {
    id: string;
    code: string;
    description: string;
  } | null;
}

export interface BudgetLineItem {
  id: string;
  projectCostCodeId: string;
  costCodeLabel: string;
  qty: string;
  uom: string;
  unitCost: string;
  amount: string;
}

export interface AvailableCostCode {
  id: string;
  title: string | null;
  status: string | null;
  division_title: string | null;
}

export interface NewBudgetCodeData {
  costCodeId: string;
  costType: string;
}

export function createEmptyLineItem(): BudgetLineItem {
  return {
    id: crypto.randomUUID(),
    projectCostCodeId: "",
    costCodeLabel: "",
    qty: "",
    uom: "",
    unitCost: "",
    amount: "",
  };
}

export function formatCostCodeLabel(costCode: ProjectCostCode): string {
  const costCodeTitle = costCode.cost_codes?.title || "";
  return `${costCode.cost_code_id} – ${costCodeTitle}`;
}
