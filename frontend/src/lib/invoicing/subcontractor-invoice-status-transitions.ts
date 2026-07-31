/**
 * Subcontractor invoice status workflow — single source of truth for which
 * transitions are reachable from each status, and which endpoint each maps to.
 *
 * Status is NOT a free-form field: every transition has side effects (submit
 * emails the PM, approve / approve-as-noted run the financial calc, revise
 * resets the invoice). The inline status control on the invoices table and the
 * detail page both drive the invoice through these dedicated endpoints so a
 * change from the list behaves identically to a change from the detail page.
 *
 * Statuses NOT present in the map are terminal-in-app and render read-only:
 * `approved` / `approved_as_noted` / `paid` (payments sync from Acumatica;
 * mark-paid is disabled), `void`, and `not_invited` (must be invited from the
 * detail page before it can move).
 */

export type SubcontractorInvoiceWorkflowAction =
  | "submit"
  | "approve"
  | "approve-as-noted"
  | "pending-owner-approval"
  | "revise";

export interface SubcontractorInvoiceTransition {
  action: SubcontractorInvoiceWorkflowAction;
  label: string;
}

const STATUS_TRANSITIONS: Record<string, SubcontractorInvoiceTransition[]> = {
  draft: [{ action: "submit", label: "Submit for Review" }],
  invited: [{ action: "submit", label: "Submit for Review" }],
  revise_and_resubmit: [{ action: "submit", label: "Submit for Review" }],
  under_review: [
    { action: "approve", label: "Approve" },
    { action: "approve-as-noted", label: "Approve as Noted" },
    { action: "pending-owner-approval", label: "Send for Owner Approval" },
    { action: "revise", label: "Revise and Resubmit" },
  ],
  pending_owner_approval: [{ action: "approve", label: "Record Owner Approval" }],
};

/**
 * Returns the valid inline transitions for a given invoice status. An empty
 * array means the status is read-only from the table (no inline change).
 */
export function getSubcontractorInvoiceStatusTransitions(
  status: string | null | undefined,
): SubcontractorInvoiceTransition[] {
  if (!status) return [];
  return STATUS_TRANSITIONS[status] ?? [];
}
