/**
 * Database Type Extensions
 *
 * This file contains type extensions for columns that may exist in the database
 * but are not present in the auto-generated database.types.ts file.
 *
 * WHY THIS EXISTS:
 * - The generated types only include columns present at generation time
 * - Some columns may be added via migrations but types not regenerated
 * - Some API responses include computed/joined fields not in the base table
 *
 * HOW TO USE:
 * 1. Import the base type from database.types.ts
 * 2. Extend it with the additional fields here
 * 3. Use the extended type in your components
 *
 * MAINTENANCE:
 * - When you regenerate database types, review this file
 * - Remove extensions for columns that are now in the generated types
 * - Add new extensions as needed for new columns
 */

import type { Database, Json } from "./database.types";

// =============================================================================
// Base Table Types (re-exported for convenience)
// =============================================================================

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export type Contract = Database["public"]["Tables"]["prime_contracts"]["Row"];
export type Subcontract = Database["public"]["Tables"]["subcontracts"]["Row"];
export type PurchaseOrder =
  Database["public"]["Tables"]["purchase_orders"]["Row"];
export type RFI = Database["public"]["Tables"]["rfis"]["Row"] & {
  source_system?: string | null;
  source_project_document_id?: number | null;
  response_project_document_id?: number | null;
  source_document_metadata_id?: string | null;
  response_document_metadata_id?: string | null;
  source_metadata?: Json | null;
};
export type AdminFeedbackItem =
  Database["public"]["Tables"]["admin_feedback_items"]["Row"];

// Commitment is now a derived interface from the commitments_unified view
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
  updated_at: string;
  original_amount: number;
  approved_change_orders: number;
  revised_contract_amount: number;
  billed_to_date: number;
  balance_to_finish: number;
}
export type ChangeOrder = Database["public"]["Tables"]["prime_contract_change_orders"]["Row"];
export type DailyLog = Database["public"]["Tables"]["daily_logs"]["Row"];
export type BudgetLine = Database["public"]["Tables"]["budget_lines"]["Row"];

// =============================================================================
// Extended Types (for columns not in generated types)
// =============================================================================

/**
 * Extended meeting segment type.
 * The `opportunities` field may exist in newer schema versions.
 */
export type MeetingSegment =
  Database["public"]["Tables"]["meeting_segments"]["Row"];

export type MeetingSegmentExtended = MeetingSegment & {
  opportunities?: unknown[];
};

/**
 * Extended document metadata type.
 * The `duration` field may exist for meeting recordings.
 */
export type DocumentMetadata =
  Database["public"]["Tables"]["document_metadata"]["Row"];

export type DocumentMetadataExtended = DocumentMetadata & {
  duration?: number;
};

// AIInsight type removed when ai_insights table was dropped on 2026-05-15
// in favor of Pipeline B's insight_cards. Use
// Database["public"]["Tables"]["insight_cards"]["Row"] for the row type.

// =============================================================================
// Joined/Computed Types
// =============================================================================

/**
 * Project with related counts (from joins)
 */
export type ProjectWithCounts = Project & {
  task_count?: number;
  commitment_count?: number;
  contract_count?: number;
  open_rfi_count?: number;
};

/**
 * Task with assignee details
 * Note: The unified `tasks` table already has assignee_name and assignee_email
 * columns, so this extension is no longer needed for most use cases.
 */
export type TaskWithAssignee = Task;

/**
 * Meeting with segment summaries
 */
export type MeetingWithSummary = DocumentMetadataExtended & {
  segment_count?: number;
  total_tasks?: number;
  total_risks?: number;
  total_decisions?: number;
};

// =============================================================================
// Form Data Types
// =============================================================================

/**
 * Type for task creation form (matches `tasks` table CHECK constraints)
 */
export type TaskFormData = {
  description: string;
  assignee_name?: string;
  status: "open" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string;
  project_ids?: number[];
};

/**
 * Type for project creation form
 */
export type ProjectFormData = {
  name: string;
  client?: string;
  project_number?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  start_date?: string;
  end_date?: string;
  contract_amount?: number;
};

// =============================================================================
// Status Types (enums as union types)
// =============================================================================

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type RfiStatus = "draft" | "open" | "pending" | "closed" | "void";
export type ChangeOrderStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "void";
export type DocumentType =
  | "meeting"
  | "document"
  | "drawing"
  | "photo"
  | "email";

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Makes specified keys required in a type
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes all keys optional except specified ones
 */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> &
  Pick<T, K>;

/**
 * Extracts the row type from a table name
 */
export type TableRow<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
