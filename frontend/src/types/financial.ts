import type { ChangeEvent as ChangeEventRecord } from "./change-events";

export interface Company {
  id: string;
  name: string;
  type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  license_number?: string | null;
  title?: string | null;
  notes?: string | null;
  currency_code?: string | null;
  currency_symbol?: string | null;
  contact_email?: string;
  contact_phone?: string;
  tax_id?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "project_manager" | "accountant" | "viewer";
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: "active" | "on_hold" | "completed" | "archived";
  start_date: string;
  end_date?: string;
  budget_total: number;
  created_at: string;
  updated_at: string;
}

export interface Commitment {
  id: string;
  number: string;
  contract_company_id: string;
  contract_company?: Company;
  title: string;
  description?: string;
  status:
    | "draft"
    | "sent"
    | "pending"
    | "approved"
    | "executed"
    | "closed"
    | "void";
  original_amount: number;
  approved_change_orders: number;
  revised_contract_amount: number;
  billed_to_date: number;
  balance_to_finish: number;
  executed_date?: string;
  start_date?: string;
  substantial_completion_date?: string;
  accounting_method: "amount" | "unit" | "percent";
  retention_percentage?: number;
  vendor_invoice_number?: string;
  signed_received_date?: string;
  assignee_id?: string;
  assignee?: User;
  private: boolean;
  deleted_at?: string | null;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommitmentLineItem {
  id: string;
  commitment_id: string;
  cost_code: string;
  line_item_type: string;
  description: string;
  quantity?: number;
  unit?: string;
  unit_cost?: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export type ChangeEvent = ChangeEventRecord;

export interface ChangeOrder {
  id: string;
  change_event_id: string;
  change_event?: ChangeEvent;
  number: string;
  title: string;
  description?: string;
  status: "draft" | "pending" | "approved" | "executed" | "void";
  commitment_id: string;
  commitment?: Commitment;
  amount: number;
  executed_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PrimeContract {
  id: string;
  number: string;
  title: string;
  description?: string;
  owner_id: string;
  owner?: Company;
  status: "draft" | "sent" | "pending" | "approved" | "executed" | "closed";
  contract_date?: string;
  start_date?: string;
  substantial_completion_date?: string;
  original_amount: number;
  approved_change_orders: number;
  revised_contract_amount: number;
  billed_to_date: number;
  retention_percentage?: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  commitment_id: string;
  commitment?: Commitment;
  number: string;
  billing_period_start: string;
  billing_period_end: string;
  status: "draft" | "submitted" | "approved" | "paid" | "void";
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  retention_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  commitment_line_item_id: string;
  commitment_line_item?: CommitmentLineItem;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  previously_billed: number;
  this_period: number;
  completed_to_date: number;
  percent_complete: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: string;
  cost_code: string;
  description: string;
  original_budget: number;
  budget_modifications: number;
  revised_budget: number;
  committed_costs: number;
  direct_costs: number;
  forecast_to_complete: number;
  estimated_cost_at_completion: number;
  variance: number;
  created_at: string;
  updated_at: string;
}
