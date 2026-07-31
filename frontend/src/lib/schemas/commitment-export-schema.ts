/**
 * =============================================================================
 * COMMITMENT EXPORT VALIDATION SCHEMAS
 * =============================================================================
 *
 * TypeScript types and Zod validation schemas for Commitment Export feature
 * Based on the patterns established in direct-costs.ts
 */

import { z } from 'zod';

// =============================================================================
// EXPORT SCHEMAS
// =============================================================================

export const CommitmentExportSchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']),
  columns: z.array(z.string()).optional(), // If not provided, export all visible columns
  filters: z.object({
    type: z.enum(['subcontract', 'purchase_order', 'all']).optional(),
    status: z.string().optional(),
    companyId: z.string().optional(),
    search: z.string().optional(),
    ids: z.array(z.string()).optional(),
  }).optional(),
  include_sov_items: z.boolean().default(false),
  template: z.enum(['standard', 'financial', 'summary']).default('standard'),
  // For PDF export of individual commitment
  commitmentId: z.string().optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CommitmentExport = z.infer<typeof CommitmentExportSchema>;

// =============================================================================
// COMMITMENT WITH DETAILS TYPE FOR EXPORT
// =============================================================================

export interface CommitmentExportRow {
  id: string;
  number: string;
  title: string | null;
  type: 'subcontract' | 'purchase_order';
  status: string;
  executed: boolean;
  contract_company_name: string | null;
  description: string | null;
  start_date: string | null;
  executed_date: string | null;
  original_amount: number;
  approved_change_orders: number;
  revised_contract_amount: number;
  billed_to_date: number;
  balance_to_finish: number;
  invoiced_amount: number;
  payments_issued: number;
  percent_paid: number;
  remaining_balance: number;
  erp_status: string | null;
  ssov_status: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommitmentDetailForPDF extends CommitmentExportRow {
  project_name: string | null;
  retention_percentage: number | null;
  // SOV line items for detailed PDF
  sov_items?: Array<{
    id: string;
    line_number: string;
    description: string | null;
    cost_code: string | null;
    scheduled_value: number;
    work_completed_previous: number;
    work_completed_this_period: number;
    materials_stored: number;
    total_completed: number;
    percent_complete: number;
    balance_to_finish: number;
    retainage: number;
  }>;
  // Change orders summary
  change_orders_summary?: {
    approved_count: number;
    approved_amount: number;
    pending_count: number;
    pending_amount: number;
    draft_count: number;
    draft_amount: number;
  };
  // Invoices summary
  invoices_summary?: {
    paid_count: number;
    paid_amount: number;
    outstanding_count: number;
    outstanding_amount: number;
  };
}
