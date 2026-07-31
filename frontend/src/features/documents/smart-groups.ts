import type { DocumentFilterState } from "@/features/documents/documents-table-definition";

export interface SmartGroup {
  id: string;
  label: string;
  icon: string;
  filter: Partial<DocumentFilterState>;
  /**
   * Free-text term matched against title/summary/overview/participants — used for
   * groups that have no clean category/type (e.g. Commitments, which are stored as
   * Contract-category docs whose titles contain "commitment"). Mutually used with
   * `filter`. Search-based groups are never drop targets (reclassifyTo: null).
   */
  search?: string;
  reclassifyTo: string | null;
}

export type SmartGroupCounts = Record<string, number>;

// Smart groups filter on `category` (the populated human classification — e.g.
// "Drawing", "Contract", "Specification") and `type` (email / meeting). NOTE:
// `document_type` is intentionally NOT used — it is sparsely populated with a
// pipeline-stage vocabulary (email_message, drawing_revision, ...) that does not
// match these labels. `reclassifyTo` is the `category` value written on
// drag-drop; groups that filter by `type` (Meetings, Emails) are not drop targets.
export const SMART_GROUPS: SmartGroup[] = [
  { id: "all", label: "All", icon: "files", filter: {}, reclassifyTo: null },
  { id: "drawings", label: "Drawings", icon: "blueprints", filter: { category: "Drawing" }, reclassifyTo: "Drawing" },
  { id: "specs", label: "Specs", icon: "file-description", filter: { category: "Specification" }, reclassifyTo: "Specification" },
  { id: "contracts", label: "Contracts", icon: "file-text", filter: { category: "Contract" }, reclassifyTo: "Contract" },
  { id: "commitments", label: "Commitments", icon: "file-stack", filter: {}, search: "commitment", reclassifyTo: null },
  { id: "invoices", label: "Invoices", icon: "file-diff", filter: { category: "Invoice" }, reclassifyTo: "Invoice" },
  { id: "proposals", label: "Proposals", icon: "file-check", filter: { category: "Proposal" }, reclassifyTo: "Proposal" },
  { id: "meetings", label: "Meetings", icon: "calendar", filter: { type: "meeting" }, reclassifyTo: null },
  { id: "emails", label: "Emails", icon: "mail", filter: { type: "email" }, reclassifyTo: null },
];
