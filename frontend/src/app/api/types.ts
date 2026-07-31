// Types for API error handling and responses
export interface APIError extends Error {
  message: string;
  status?: number;
  response?: {
    status: number;
  };
}

// Types for Zod validation errors
export interface ZodError extends Error {
  name: "ZodError";
  errors: Array<{
    path: string[];
    message: string;
  }>;
}

// Database schema types for AI SQL route
export interface DatabaseColumn {
  name: string;
  data_type: string;
  ordinal_position: number;
  is_nullable: boolean;
  column_default?: string;
}

export interface DatabaseTable {
  name: string;
  schema: string;
  columns: DatabaseColumn[];
}

export interface DatabaseQueryResponse {
  result?: DatabaseTable[];
  error?: string;
}

// Commitment types with relations
export interface Company {
  id: string;
  name: string;
  type: "vendor" | "subcontractor" | "supplier" | "owner";
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  tax_id?: string;
  license_number?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export interface CommitmentLineItem {
  id: string;
  commitment_id: string;
  description: string;
  amount: number;
  quantity?: number;
  unit?: string;
}

export interface ChangeOrder {
  id: string;
  commitment_id: string;
  change_event_id: string;
  number: string;
  title: string;
  description?: string;
  status: "draft" | "pending" | "approved" | "executed" | "void";
  amount: number;
  executed_date?: string;
}

export interface Invoice {
  id: string;
  commitment_id: string;
  number: string;
  billing_period_start: string;
  billing_period_end: string;
  invoice_date: string;
  due_date?: string;
  status: "draft" | "submitted" | "approved" | "paid" | "void";
  notes?: string;
}

// Commitment represents data from the commitments_unified view
// which combines subcontracts and purchase_orders
export interface Commitment {
  id: string;
  project_id: number;
  number: string;
  contract_company_id: string | null;
  title: string | null;
  status: string;
  executed: boolean;
  type: "subcontract" | "purchase_order";
  retention_percentage: number | null;
  start_date: string | null;
  executed_date: string | null;
  description: string | null;
  created_at: string;
  created_by_name?: string | null;
  updated_at: string;
  original_amount: number;
  approved_change_orders: number;
  revised_contract_amount: number;
  billed_to_date: number;
  balance_to_finish: number;
  // Phase 5 enhancements - ERP and status fields
  erp_status: string | null;
  ssov_status: string | null;
  // Phase 5 enhancements - Change order aggregations
  change_order_count?: number;
  pending_change_orders: number;
  draft_change_orders: number;
  // Phase 5 enhancements - Invoice/payment aggregations
  invoiced_amount: number;
  payments_issued: number;
  percent_paid: number;
  remaining_balance: number;
  cost_codes: string[];
  trade_names: string[];
  scope_summary: string | null;
  is_private: boolean;
  // Relations (optional - may be joined)
  contract_company?: Company | null;
  assignee?: User;
}

// Response types
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  error: string;
  message?: string;
  issues?: Array<{
    path: string[];
    message: string;
  }>;
}
