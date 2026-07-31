/**
 * Contract Line Items Type Definitions
 *
 * NOTE: cost_code_id is TEXT in the database (references cost_codes.id which is also text).
 * budget_code_id is a UUID FK to project_budget_codes.
 */

export interface ContractLineItem {
  id: string;
  contract_id: string;
  line_number: number;
  description: string;
  cost_code_id: string | null;
  budget_code_id?: string | null;
  quantity: number;
  unit_of_measure: string | null;
  unit_cost: number;
  total_cost: number; // Auto-calculated: quantity * unit_cost
  /** Non-null for auto-computed markup rows (e.g. 'insurance', 'fee'). Read-only in the SOV UI. */
  markup_type?: string | null;
  created_at: string;
  updated_at: string;
  // UI-only fields for SOV grouping (not persisted to DB)
  is_group_header?: boolean;
  group_name?: string;
}

export interface CreateContractLineItemInput {
  contract_id: string;
  line_number: number;
  description: string;
  cost_code_id?: string | null;
  budget_code_id?: string | null;
  quantity?: number;
  unit_of_measure?: string;
  unit_cost?: number;
}

export interface UpdateContractLineItemInput {
  line_number?: number;
  description?: string;
  cost_code_id?: string | null;
  budget_code_id?: string | null;
  quantity?: number;
  unit_of_measure?: string | null;
  unit_cost?: number;
}

export interface ContractLineItemWithCostCode extends ContractLineItem {
  cost_code?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ContractLineItemSummary {
  contract_id: string;
  total_line_items: number;
  total_quantity: number;
  total_cost: number;
}
