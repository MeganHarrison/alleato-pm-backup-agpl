/**
 * Typed database operations for subcontracts.
 *
 * This file uses the generated Supabase types directly to prevent
 * schema mismatches. All column names match the database exactly.
 */

import type { Database } from "@/types/database.types";
import { normalizeCommitmentContractNumber } from "@/lib/commitments/contract-number";

// Use the generated types - these are the source of truth
type SubcontractRow = Database["public"]["Tables"]["subcontracts"]["Row"];
type SubcontractInsert = Database["public"]["Tables"]["subcontracts"]["Insert"];

const DB_SUBCONTRACT_STATUSES = [
  "Draft",
  "Out for Bid",
  "Out for Signature",
  "Approved",
  "Complete",
  "Terminated",
] as const;

const LEGACY_TO_DB_STATUS: Record<string, (typeof DB_SUBCONTRACT_STATUSES)[number]> = {
  draft: "Draft",
  sent: "Out for Bid",
  "out for bid": "Out for Bid",
  out_for_bid: "Out for Bid",
  pending: "Out for Signature",
  "out for signature": "Out for Signature",
  out_for_signature: "Out for Signature",
  approved: "Approved",
  executed: "Approved",
  complete: "Complete",
  completed: "Complete",
  closed: "Complete",
  terminated: "Terminated",
  void: "Terminated",
};

function isDbSubcontractStatus(
  value: string,
): value is (typeof DB_SUBCONTRACT_STATUSES)[number] {
  return (DB_SUBCONTRACT_STATUSES as readonly string[]).includes(value);
}

export function normalizeSubcontractStatus(
  rawStatus: string | null | undefined,
): (typeof DB_SUBCONTRACT_STATUSES)[number] {
  if (!rawStatus) return "Draft";
  const normalized = rawStatus.trim();
  if (!normalized) return "Draft";
  if (isDbSubcontractStatus(normalized)) return normalized;
  const mapped = LEGACY_TO_DB_STATUS[normalized.toLowerCase()];
  return mapped ?? "Draft";
}

/**
 * Form data uses camelCase (JavaScript convention).
 * This type defines what the form submits.
 */
export interface SubcontractFormData {
  contractNumber?: string;
  contractCompanyId?: string | null;
  title?: string | null;
  status?: string;
  executed?: boolean;
  defaultRetainagePercent?: number | null;
  accountingMethod?: string | null;
  description?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  dates?: {
    startDate?: string | Date;
    estimatedCompletionDate?: string | Date;
    actualCompletionDate?: string | Date;
    contractDate?: string | Date;
    signedContractReceivedDate?: string | Date;
    issuedOnDate?: string | Date;
  };
  // Legacy/top-level fallbacks used by older form payloads and API callers
  startDate?: string | Date;
  estimatedCompletionDate?: string | Date;
  actualCompletionDate?: string | Date;
  contractDate?: string | Date;
  signedContractReceivedDate?: string | Date;
  issuedOnDate?: string | Date;
  start_date?: string | Date;
  estimated_completion_date?: string | Date;
  actual_completion_date?: string | Date;
  contract_date?: string | Date;
  signed_contract_received_date?: string | Date;
  issued_on_date?: string | Date;
  privacy?: {
    isPrivate?: boolean;
    nonAdminUserIds?: string[];
    allowNonAdminViewSovItems?: boolean;
  };
  invoiceContactIds?: string[];
  sov?: Array<{
    lineNumber?: number;
    changeEventLineItem?: string;
    budgetCode?: string;
    description?: string;
    amount?: number;
    billedToDate?: number;
  }>;
}

/**
 * Convert date value to ISO date string (yyyy-mm-dd) for database.
 * Accepts: Date object, mm/dd/yyyy string, ISO string, or undefined.
 * Returns null if the input is empty or invalid.
 */
function parseFormDate(dateValue: string | Date | undefined): string | null {
  if (!dateValue) return null;

  // Handle Date objects
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return null;
    return dateValue.toISOString().split("T")[0];
  }

  const dateStr = dateValue.trim();
  if (!dateStr) return null;

  // Handle mm/dd/yyyy format
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month}-${day}`;
  }

  // Already ISO format or other valid date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}

/**
 * Maps form data (camelCase) to database insert payload (snake_case).
 *
 * This is the ONLY place where the mapping happens.
 * If you get a schema mismatch error, fix it HERE.
 */
export function mapFormToInsert(
  formData: SubcontractFormData,
  projectId: number,
  userId: string,
): SubcontractInsert {
  const resolveDate = (
    nested: string | Date | undefined,
    camel: string | Date | undefined,
    snake: string | Date | undefined,
  ) => parseFormDate(nested ?? camel ?? snake);

  return {
    // Required fields
    project_id: projectId,
    contract_number: normalizeCommitmentContractNumber(
      formData.contractNumber,
      "SC-",
    ),
    status: normalizeSubcontractStatus(formData.status),
    executed: formData.executed ?? false,

    // Optional fields - map camelCase to snake_case
    contract_company_id: formData.contractCompanyId || null,
    title: formData.title || null,
    default_retainage_percent: formData.defaultRetainagePercent ?? null,
    description: formData.description || null,
    inclusions: formData.inclusions || null,
    exclusions: formData.exclusions || null,

    // Date fields - convert mm/dd/yyyy to ISO
    start_date: resolveDate(
      formData.dates?.startDate,
      formData.startDate,
      formData.start_date,
    ),
    estimated_completion_date: resolveDate(
      formData.dates?.estimatedCompletionDate,
      formData.estimatedCompletionDate,
      formData.estimated_completion_date,
    ),
    actual_completion_date: resolveDate(
      formData.dates?.actualCompletionDate,
      formData.actualCompletionDate,
      formData.actual_completion_date,
    ),
    contract_date: resolveDate(
      formData.dates?.contractDate,
      formData.contractDate,
      formData.contract_date,
    ),
    signed_contract_received_date: resolveDate(
      formData.dates?.signedContractReceivedDate,
      formData.signedContractReceivedDate,
      formData.signed_contract_received_date,
    ),
    issued_on_date: resolveDate(
      formData.dates?.issuedOnDate,
      formData.issuedOnDate,
      formData.issued_on_date,
    ),

    // Privacy fields
    is_private: formData.privacy?.isPrivate ?? true,
    non_admin_user_ids: formData.privacy?.nonAdminUserIds || [],
    allow_non_admin_view_sov_items:
      formData.privacy?.allowNonAdminViewSovItems ?? false,

    // Other fields
    invoice_contact_ids: formData.invoiceContactIds || [],
    created_by: userId,
  };
}

/**
 * Maps database row (snake_case) to frontend format (camelCase).
 * Use this when displaying data from the database.
 */
export function mapRowToDisplay(row: SubcontractRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    contractNumber: row.contract_number,
    contractCompanyId: row.contract_company_id,
    title: row.title,
    status: row.status,
    executed: row.executed,
    defaultRetainagePercent: row.default_retainage_percent,
    description: row.description,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    startDate: row.start_date,
    estimatedCompletionDate: row.estimated_completion_date,
    actualCompletionDate: row.actual_completion_date,
    contractDate: row.contract_date,
    signedContractReceivedDate: row.signed_contract_received_date,
    issuedOnDate: row.issued_on_date,
    isPrivate: row.is_private,
    nonAdminUserIds: row.non_admin_user_ids,
    allowNonAdminViewSovItems: row.allow_non_admin_view_sov_items,
    invoiceContactIds: row.invoice_contact_ids,
    // Subcontracts do not persist accounting_method on the linked schema.
    accountingMethod: "amount_based" as const,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}
