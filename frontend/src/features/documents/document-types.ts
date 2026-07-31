// Canonical document types the documents page can filter/display/inline-edit.
// This MUST cover every manually-attachable type_key in the
// document_type_taxonomy registry — i.e. every type the DocumentPicker exposes
// when attaching to a commitment, change order, company, etc. When the picker
// stores a type (e.g. W-9, COI, executed contract) it writes it to
// document_metadata.document_type, and the documents page reads that column, so
// any taxonomy type missing here shows as a raw key and can't be filtered/set.
//
// Enforced by document-types.test.ts, which parses the taxonomy seed/insert
// migrations and fails if a manually-attachable (source_system-null) type_key
// is missing here. Auto-generated communication types (email/teams/transcript,
// which carry a source_system) are intentionally excluded — users never set
// them by hand. Do NOT re-open the "keep in sync by hand" drift: add the type
// here in the same PR that adds it to the taxonomy.

export const DOCUMENT_TYPE_OPTIONS = [
  // Classifier vocabulary (folder-derived construction document types)
  { value: "psr", label: "PSR" },
  { value: "schedule", label: "Schedule" },
  { value: "submittal", label: "Submittal" },
  { value: "pay_app", label: "Pay Application" },
  { value: "proposal", label: "Proposal" },
  { value: "estimate", label: "Estimate" },
  { value: "bid", label: "Bid" },
  { value: "drawing", label: "Drawing" },
  { value: "specification", label: "Specification" },
  { value: "permit", label: "Permit" },
  { value: "rfi", label: "RFI" },
  { value: "change_order", label: "Change Order" },
  { value: "subcontract", label: "Subcontract" },
  { value: "contract", label: "Contract / Owner" },
  { value: "invoice", label: "Invoice" },
  { value: "meeting_minutes", label: "Meeting Minutes" },
  { value: "oac_meeting_minutes", label: "OAC Meeting Minutes" },
  { value: "safety", label: "Safety" },
  { value: "closeout", label: "Closeout" },
  { value: "design", label: "Design" },
  { value: "photo", label: "Photo" },
  // Contract types the DocumentPicker attaches to commitments / prime contracts
  { value: "executed_contract", label: "Executed Contract" },
  { value: "contract_proposal", label: "Contract Proposal" },
  { value: "change_order_executed", label: "Executed Change Order" },
  // Compliance types (W-9, COI, lien waivers) — attached to commitments/company
  { value: "insurance_certificate", label: "Insurance Certificate (COI)" },
  { value: "w9", label: "W-9" },
  { value: "lien_waiver_progress", label: "Progress Lien Waiver" },
  { value: "lien_waiver_final", label: "Final Lien Waiver" },
  // Closeout package types
  { value: "closeout_manual", label: "Closeout O&M Manual" },
  { value: "closeout_warranty", label: "Closeout Warranty" },
  { value: "closeout_asbuilt", label: "As-Built Drawings" },
  // Field / permit / financial taxonomy types
  { value: "permit_inspection", label: "Permit Inspection Report" },
  { value: "drawing_revision", label: "Drawing Revision" },
  { value: "progress_photo", label: "Progress Photo" },
  { value: "invoice_document", label: "Invoice Document" },
  { value: "rfi_response", label: "RFI Response" },
  { value: "daily_report", label: "Daily Report" },
  { value: "other", label: "Other" },
] as const;

const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export function documentTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return DOCUMENT_TYPE_LABELS[value] ?? value;
}
