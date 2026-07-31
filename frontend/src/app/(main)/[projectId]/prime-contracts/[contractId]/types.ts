import type { ContractLineItemWithCostCode } from "@/types/contract-line-items";

export interface PrimeContractCO {
  id: string;
  contract_id: string;
  change_order_number: string;
  description: string;
  title: string | null;
  amount: number;
  status: string;
  revision: number | null;
  executed: boolean | null;
  requested_by: string | null;
  requested_date: string;
  due_date: string | null;
  review_date: string | null;
  designated_reviewer: string | null;
  approved_by: string | null;
  approved_date: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Raw row shape returned by
 * GET /api/projects/[projectId]/prime-contract-change-orders
 * (a straight `select *` from the `prime_contract_change_orders` table).
 *
 * The API column names differ from the UI-facing {@link PrimeContractCO}
 * shape the detail-page tab consumes (e.g. `pcco_number` vs
 * `change_order_number`, `total_amount` vs `amount`), and a promoted PCCO
 * only carries `prime_contract_id` — never `contract_id`. Normalize with
 * {@link mapPrimeContractChangeOrders} so both filtering and display work.
 */
export interface RawPrimeContractCoRow {
  id: number | string;
  contract_id: string | null;
  prime_contract_id: string | null;
  pcco_number: string | null;
  title: string | null;
  description: string | null;
  total_amount: number | null;
  status: string | null;
  revision: number | null;
  executed: boolean | null;
  due_date: string | null;
  review_date: string | null;
  designated_reviewer: string | null;
  request_received_from: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string | null;
}

/**
 * Normalize raw PCCO rows into the {@link PrimeContractCO} shape the prime
 * contract detail page's Change Orders tab renders, scoped to a single
 * prime contract.
 *
 * A change order belongs to this prime contract when its `prime_contract_id`
 * matches (the canonical FK, set by both manual creation and PCO promotion).
 * `contract_id` is retained only as a legacy fallback for older manually
 * created rows — promoted PCCOs never set it, which is exactly the bug this
 * function guards against.
 */
export function mapPrimeContractChangeOrders(
  rows: RawPrimeContractCoRow[],
  contractId: string,
): PrimeContractCO[] {
  return rows
    .filter((row) => {
      const primeContractId = String(row.prime_contract_id ?? "");
      const legacyContractId = String(row.contract_id ?? "");
      return primeContractId === contractId || legacyContractId === contractId;
    })
    .map((row) => ({
      id: String(row.id),
      contract_id: String(row.prime_contract_id ?? row.contract_id ?? ""),
      change_order_number: row.pcco_number ?? "",
      description: row.description ?? "",
      title: row.title,
      amount: Number(row.total_amount ?? 0),
      status: row.status ?? "pending",
      revision: row.revision,
      executed: row.executed,
      requested_by: row.request_received_from ?? null,
      requested_date: row.created_at ?? "",
      due_date: row.due_date,
      review_date: row.review_date,
      designated_reviewer: row.designated_reviewer,
      approved_by: row.reviewed_by ?? null,
      approved_date: row.approved_at,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at ?? "",
      updated_at: row.created_at ?? "",
    }));
}

export interface PaymentApplication {
  id: string;
  contract_id: string;
  project_id: number;
  application_number: string;
  status: "draft" | "under_review" | "revise_and_resubmit" | "approved";
  billing_period_id: string | null;
  billing_date: string | null;
  billing_period?: {
    id: string;
    start_date: string;
    end_date: string;
    name: string | null;
    period_number: number;
  } | null;
  amount: number;
  retention_amount: number;
  net_amount: number;
  period_from: string | null;
  period_to: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  can_edit_retainage?: boolean;
  can_release_retainage?: boolean;
  retainage_edit_block_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerInvoiceSummary {
  id: number;
  prime_contract_id: string;
  payment_application_id: string | null;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  billing_date: string | null;
  due_date: string | null;
  status: string;
  gross_amount: number | null;
  retention_amount?: number | null;
  net_amount: number | null;
  paid_amount: number | null;
  percent_complete: number | null;
  total_amount?: number | null;
  previous_changes?: number | null;
  current_changes?: number | null;
  total_contract_amount?: number | null;
  acumatica_ref_nbr: string | null;
  acumatica_doc_type?: string | null;
  acumatica_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentApplicationLineItem {
  id: string;
  payment_application_id: string;
  sov_item_id: number | null;
  change_order_id: string | null;
  item_number: string;
  budget_code: string | null;
  description: string;
  scheduled_value: number;
  work_completed_previous: number;
  work_completed_this_period: number;
  materials_stored: number;
  total_completed: number;
  percent_complete: number;
  balance_to_finish: number;
  retainage_previous_work: number;
  retainage_previous_materials: number;
  retainage_this_period_work_pct: number;
  retainage_this_period_work: number;
  retainage_this_period_materials_pct: number;
  retainage_this_period_materials: number;
  retainage_released_work: number;
  retainage_released_materials: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  contract_id: string;
  project_id: number;
  payment_application_id: string | null;
  payment_number: string | null;
  amount: number;
  payment_date: string;
  method: string | null;
  reference_number: string | null;
  notes: string | null;
  acumatica_ref_nbr: string | null;
  acumatica_doc_type: string | null;
  acumatica_sync_at: string | null;
  created_at: string;
  updated_at: string;
  payment_application?: {
    id: string;
    application_number: string;
    amount: number;
    status: string;
  } | null;
}

export interface VerticalMarkup {
  id: string;
  markup_type: string;
  percentage: number;
  calculation_order: number;
  compound: boolean;
  project_id: number;
  maps_to_budget_code_id?: string | null;
}

export interface MarkupCalculationResult {
  markup_type: string;
  percentage: number;
  compound: boolean;
  baseAmount: number;
  markupAmount: number;
  runningTotal: number;
}

export interface MarkupCalculationResponse {
  baseAmount: number;
  calculations: MarkupCalculationResult[];
  totalMarkup: number;
  finalAmount: number;
}

export interface Contract {
  id: string;
  contract_number: string | null;
  title: string;
  status:
    | "draft"
    | "out_for_signature"
    | "approved"
    | "complete"
    | "terminated";
  executed: boolean;
  executed_at: string | null;
  original_contract_value: number;
  revised_contract_value: number;
  start_date: string | null;
  end_date: string | null;
  substantial_completion_date: string | null;
  actual_completion_date: string | null;
  signed_contract_received_date: string | null;
  contract_termination_date: string | null;
  retention_percentage: number;
  payment_terms: string | null;
  billing_schedule: string | null;
  description: string | null;
  inclusions: string | null;
  exclusions: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  vendor_id: string | null;
  client_id: number | null;
  contract_company_id: string | null;
  contractor_id?: string | null;
  architect_engineer_id?: string | null;
  project_id: number;
  vendor?: { id: string; name: string } | null;
  client?: { id: number; name: string } | null;
  contract_company?: { id: string; name: string } | null;
  contractor?: { id: string; name: string } | null;
  architect_engineer?: { id: string; name: string } | null;
  approved_change_orders: number;
  pending_change_orders: number;
  draft_change_orders: number;
  pending_revised_contract_amount: number;
  invoiced_amount: number;
  payments_received: number;
  remaining_balance: number;
  percent_paid: number;
  estimate_id?: number | null;
  estimate_version?: number | null;
  last_synced_from_estimate_at?: string | null;
}

export interface BudgetCode {
  id: string;
  code: string;
  costCodeId?: string | null;
  description: string;
  costType: string | null;
  fullLabel: string;
  costTypeId?: string | null;
}

export interface ContractAttachment {
  id: string;
  fileName: string;
  url: string | null;
  downloadUrl?: string;
  uploadedBy: { id: string; email: string } | null;
  uploadedAt: string;
}

export interface InvoiceFormState {
  application_number: string;
  amount: string;
  retention_amount: string;
  period_from: string;
  period_to: string;
  notes: string;
}

export interface PaymentFormState {
  amount: string;
  payment_date: string;
  payment_application_id: string;
  payment_number: string;
  method: string;
  reference_number: string;
  notes: string;
}

export interface LineItemFormState {
  lineNumber: string;
  description: string;
  quantity: string;
  unitCost: string;
  unitOfMeasure: string;
  budgetCodeId: string;
}

export interface ChangeOrderFormState {
  change_order_number: string;
  description: string;
  amount: string;
}

export type ContractTab =
  | "overview"
  | "schedule-of-values"
  | "change-orders"
  | "change-events"
  | "invoices"
  | "payments"
  | "related-items"
  | "emails"
  | "history"
  | "financial-markup"
  | "advanced-settings";

export type ContractLineItem = ContractLineItemWithCostCode;
