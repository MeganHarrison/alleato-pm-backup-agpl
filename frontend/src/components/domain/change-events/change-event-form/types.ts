export type ChangeEventStatus =
  | "Open"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Closed"
  | "Void"
  | "Converted"
  | string;
export type ChangeEventOrigin = "emails" | "meetings" | "rfis" | "Internal" | "Field";
export type ChangeEventType =
  | "Owner Change"
  | "Design Change"
  | "Allowance"
  | "Contingency"
  | "Scope Gap"
  | "TBD"
  | "Transfer"
  | "Unforeseen Condition"
  | "Value Engineering"
  | "Owner Requested"
  | "Constructability Issue"
  | string;
export type ChangeReason =
  | "allowance"
  | "backcharge"
  | "client_request"
  | "design_development"
  | "existing_condition";

export interface ChangeEventLineItem {
  id?: string;
  budgetCode: string;
  description: string;
  vendor: string;
  // Display name for the saved vendor (companies.name). Not persisted — used
  // only to seed the Vendor combobox on edit so a saved vendor whose commitment
  // is inactive still shows its name instead of an empty placeholder.
  vendorName?: string;
  contract: string;
  commitmentId?: string;
  commitmentLineItemId: string;
  revenueUnitOfMeasure: string;
  revenueQuantity: number;
  revenueUnitCost: number;
  revenueRom: number;
  costQuantity: number;
  costUnitCost: number;
  costRom: number;
  nonCommittedCost: number;
}

export interface ChangeEventFormData {
  number?: string;
  contractNumber: string;
  title: string;
  status: ChangeEventStatus | string;
  origin?: ChangeEventOrigin | string;
  originId?: string;
  type?: ChangeEventType | string;
  changeReason?: ChangeReason | string;
  scope?: string;
  expectingRevenue?: boolean;
  lineItemRevenueSource?: string;
  primeContractId?: string;
  description?: string;
  attachments: File[];
  lineItems: ChangeEventLineItem[];
}

export interface ChangeEventFormProps {
  initialData?: Partial<ChangeEventFormData>;
  onSubmit: (data: ChangeEventFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
  projectId: number;
}

export interface PrimeContractOption {
  value: string;
  label: string;
}

export interface VendorOption {
  id: string;
  vendor_name: string;
  company?: string;
}

export interface ContractOption {
  id: string;
  label: string;
  type: "purchase_order" | "subcontract";
  vendorId?: string | null;
  vendorName?: string | null;
  title?: string | null;
  status?: string | null;
}

export interface CommitmentSovLineItem {
  id: string;
  budget_code: string | null;
  project_budget_code_id?: string | null;
  description: string | null;
  line_number: number | null;
}

export interface BudgetCodeOption {
  id: string;
  code: string;
  costCodeId?: string | null;
  description: string;
  costType: string | null;
  costTypeId?: string | null;
  fullLabel: string;
}

export const createEmptyLineItem = (): ChangeEventLineItem => ({
  budgetCode: "",
  description: "",
  vendor: "",
  contract: "",
  commitmentId: undefined,
  commitmentLineItemId: "",
  revenueUnitOfMeasure: "",
  revenueQuantity: 1,
  revenueUnitCost: 0,
  revenueRom: 0,
  costQuantity: 1,
  costUnitCost: 0,
  costRom: 0,
  nonCommittedCost: 0,
});

export const UOM_OPTIONS = [
  "LOT",
  "EA",
  "LF",
  "SF",
  "CY",
  "SY",
  "TON",
  "GAL",
  "HR",
  "DAY",
  "WK",
  "MO",
  "LS",
];

export const STATUS_OPTIONS = [
  { value: "Open", label: "Open" },
  { value: "Pending Approval", label: "Pending Approval" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Closed", label: "Closed" },
  { value: "Void", label: "Void" },
];

export const ORIGIN_OPTIONS = [
  { value: "emails", label: "Emails" },
  { value: "meetings", label: "Meetings" },
  { value: "rfis", label: "RFI's" },
  { value: "Internal", label: "Internal" },
  { value: "Field", label: "Field" },
];

export const TYPE_OPTIONS = [
  { value: "Owner Change", label: "Owner Change" },
  { value: "Design Change", label: "Design Change" },
  { value: "Allowance", label: "Allowance" },
  { value: "Contingency", label: "Contingency" },
  { value: "Scope Gap", label: "Scope Gap" },
  { value: "TBD", label: "TBD" },
  { value: "Transfer", label: "Transfer" },
  { value: "Unforeseen Condition", label: "Unforeseen Condition" },
  { value: "Value Engineering", label: "Value Engineering" },
  { value: "Owner Requested", label: "Owner Requested" },
  { value: "Constructability Issue", label: "Constructability Issue" },
];

export const CHANGE_REASON_OPTIONS = [
  { value: "Allowance", label: "Allowance" },
  { value: "Back Charge", label: "Back Charge" },
  { value: "Client Request", label: "Client Request" },
  { value: "Design Development", label: "Design Development" },
  { value: "Existing Condition", label: "Existing Condition" },
];

export const SCOPE_OPTIONS = [
  { value: "In Scope", label: "In Scope" },
  { value: "Out of Scope", label: "Out of Scope" },
  { value: "TBD", label: "TBD" },
  { value: "Allowance", label: "Allowance" },
];

export const REVENUE_SOURCE_OPTIONS = [
  { value: "Match Revenue to Latest Cost", label: "Match Revenue to Latest Cost" },
  { value: "Enter manually", label: "Enter manually" },
  { value: "Quantity x Unit Cost", label: "Quantity x Unit Cost" },
];

/**
 * Revenue-source semantics for a change-event line item:
 *   - "Match Revenue to Latest Cost" → revenue mirrors cost; the revenue
 *     Qty / Unit Cost cells are READ-ONLY (auto-computed from cost).
 *   - "Enter manually" / "Quantity x Unit Cost" → the user types the revenue
 *     Qty + Unit Cost. (Revenue ROM is always computed, never directly edited.)
 *   - "" / unset → editable (no source chosen yet). NOTE: while the read-only
 *     gate treats unset as editable, the *effective* source of an unset field
 *     defaults to match-cost when rolling revenue up — see `resolveRevenueSource`
 *     / `computeLineItemRevenueRom` in `@/lib/change-events/financial-summary`.
 *
 * Canonical predicate lives in the shared financial-summary module so the form,
 * the detail API totals, and the list API rollup all agree.
 */
export {
  DEFAULT_LINE_ITEM_REVENUE_SOURCE,
  isMatchCostRevenueSource,
} from "@/lib/change-events/financial-summary";
