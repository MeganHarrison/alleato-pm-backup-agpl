export type ChangeEventStatus =
  | "Open"
  | "Pending"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Closed"
  | "Converted"
  | string;

export interface ChangeEvent {
  id: string | number;
  project_id: number;
  number: string | null;
  title: string;
  type: string;
  reason: string | null;
  scope: string;
  status: ChangeEventStatus | null;
  origin: string | null;
  origin_id?: string | null;
  description: string | null;
  expecting_revenue: boolean;
  line_item_revenue_source: string | null;
  prime_contract_id: number | null;
  created_at: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  // List parity fields used by the Change Events table view
  prime_pco?: string | null;
  prime_pco_title?: string | null;
  cost_rom?: number | null;
  rfq_title?: string | null;
  /** Committed-cost dollar amount (numeric string), not the contract number. */
  commitment?: string | null;
  commitment_id?: string | null;
  commitment_title?: string | null;
  sent_to_prime_pco?: boolean | null;
  sent_to_commitment_pco?: boolean | null;
  workflow_stage?: string | null;
  // Enrichment fields from API
  lineItemsCount?: number;
  rom?: string | number | null;
  total?: string | number | null;
}

export interface ChangeEventLineItem {
  id: string;
  change_event_id: string;
  budget_code_id: string | null;
  vendor_id: string | null;
  contract_id: string | null;
  description: string | null;
  unit_of_measure: string | null;
  quantity: number | null;
  unit_cost: number | null;
  revenue_rom: number | null;
  cost_rom: number | null;
  non_committed_cost: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChangeEventRfq {
  id: string;
  project_id: number;
  change_event_id: string;
  rfq_number: string;
  title: string;
  status: string;
  assigned_company_id?: string | null;
  assigned_contact_id?: string | null;
  include_attachments: boolean;
  due_date: string;
  sent_at?: string | null;
  response_received_at?: string | null;
  estimated_total_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string | null;
}

export interface ChangeEventRfqResponse {
  id: string;
  rfq_id: string;
  line_item_id?: string | null;
  responder_company_id?: string | null;
  responder_contact_id?: string | null;
  unit_price: number;
  extended_amount: number;
  notes?: string | null;
  status: string;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ChangeEventRfqAttachment {
  id: string;
  rfq_id?: string | null;
  rfq_response_id?: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

/* ── Detail page types ─────────────────────────────────────────────── */

/** Enriched line item returned by the detail API (camelCase) */
export interface ChangeEventDetailLineItem {
  id: string;
  description: string | null;
  unitOfMeasure: string | null;
  quantity: number | null;
  unitCost: number | null;
  costRom: number | null;
  revenueRom: number | null;
  nonCommittedCost: number | null;
  rfqCost?: number | null;
  latestPrice?: number | null;
  changeEventId: string;
  extendedAmount: number;
  sortOrder: number;
  contractId?: number | string | null;
  contract?: {
    id: string | number;
    contract_number?: string | null;
    title?: string | null;
    company_name?: string | null;
    display_name?: string | null;
  } | null;
  vendorId?: string | null;
  formVendorId?: string | null;
  vendor?: { id: string; name: string } | null;
  budgetCodeId?: string | null;
  projectBudgetCodeId?: string | null;
  budgetLine?: {
    id: string;
    description: string | null;
    cost_code?: {
      id: string;
      title: string | null;
      division_id?: string | null;
      division_title?: string | null;
    } | null;
  } | null;
  commitmentId?: string | null;
  commitmentType?: string | null;
  commitmentLineItemId?: string | null;
  commitment?: {
    id: string;
    contract_number?: string | null;
    title?: string | null;
    contract_company_id?: string | null;
    company_name?: string | null;
    display_name?: string | null;
  } | null;
}

export interface ChangeEventAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: unknown;
  downloadUrl: string;
}

export interface ChangeEventHistoryEntry {
  id: string;
  changeEventId?: string;
  action: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string | { id: string; email: string } | null;
  changedAt: string;
  description?: string;
}

export interface ChangeEventRelatedItem {
  id: string;
  relatedType: string;
  relatedId: string;
  relatedNumber: string | null;
  relatedTitle: string;
  relatedStatus: string | null;
  relatedUrl: string;
  createdAt: string;
}

export interface ChangeEventRelatedItemOption {
  id: string;
  relatedNumber: string | null;
  relatedTitle: string;
  relatedStatus: string | null;
}

/** Enriched change event returned by the detail API (mixed casing from API) */
export interface ChangeEventDetail extends ChangeEvent {
  lineItems?: ChangeEventDetailLineItem[];
  attachments?: ChangeEventAttachment[];
  history?: Array<Record<string, unknown>>;
  totals?: {
    revenueRom: string | number;
    costRom: string | number;
    nonCommittedCost: string | number;
  };
  expectingRevenue?: boolean;
  originId?: string | null;
  lineItemRevenueSource?: string | null;
  primeContractId?: number | string | null;
  primeContract?: {
    contract_number?: string | null;
    title?: string | null;
    company_name?: string | null;
    display_name?: string | null;
  } | null;
}
