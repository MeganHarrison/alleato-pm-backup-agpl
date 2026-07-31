/**
 * =============================================================================
 * DIRECT COSTS VALIDATION SCHEMAS
 * =============================================================================
 *
 * TypeScript types and Zod validation schemas for Direct Costs feature
 * Based on the specification and existing patterns in the codebase
 *
 * Follows the patterns established in:
 * - /frontend/src/lib/schemas/budget.ts
 * - /frontend/src/lib/schemas/contact-schema.ts
 */

import { z } from 'zod';
import { Database } from '@/types/database.types';

// =============================================================================
// CONSTANTS & ENUMS
// =============================================================================

export const CostTypes = ['Expense', 'Invoice', 'Subcontractor Invoice'] as const;
export type CostType = (typeof CostTypes)[number];

export const CostStatuses = ['Draft', 'Pending', 'Revise and Resubmit', 'Approved'] as const;
export type DirectCostStatus = (typeof CostStatuses)[number];

export const DbDirectCostStatuses = ['Draft', 'Approved', 'Rejected', 'Paid'] as const;
export type DbDirectCostStatus = (typeof DbDirectCostStatuses)[number];

const DIRECT_COST_STATUS_TO_DB: Record<string, DbDirectCostStatus> = {
  draft: 'Draft',
  pending: 'Draft',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  revise_and_resubmit: 'Rejected',
  'revise and resubmit': 'Rejected',
};

export function normalizeDirectCostStatus(status: string | null | undefined): DbDirectCostStatus {
  const normalized = (status ?? '').trim().toLowerCase();
  if (!normalized) return 'Draft';
  return DIRECT_COST_STATUS_TO_DB[normalized] ?? 'Draft';
}

export const UnitTypes = [
  'LOT',
  'HOUR',
  'DAY',
  'SQFT',
  'LF',
  'EA',
  'CY',
  'SF',
  'TON',
  'LB',
] as const;
export type UnitType = (typeof UnitTypes)[number];

// =============================================================================
// HELPER SCHEMAS
// =============================================================================

// Numeric validation - accepts both strings and numbers from form inputs
const positiveNumber = z.coerce
  .number()
  .positive('Must be a positive number');

const nonNegativeNumber = z.coerce
  .number()
  .min(0, 'Must be zero or positive');

// Optional string transformation following existing pattern
const optionalString = z
  .string()
  .trim()
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

// UUID validation
const uuidSchema = z.string().uuid('Must be a valid UUID');
const optionalUuidSchema = z
  .string()
  .uuid('Must be a valid UUID')
  .nullable()
  .optional();
const requiredUuidOrEmptySchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : ''),
  z.string().min(1, 'Budget code is required').uuid('Budget code is required')
);

// =============================================================================
// LINE ITEM SCHEMA
// =============================================================================

export const DirectCostLineItemSchema = z.object({
  id: uuidSchema.optional(), // Optional for new items
  budget_code_id: requiredUuidOrEmptySchema,
  description: optionalString,
  quantity: positiveNumber,
  uom: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.enum(UnitTypes, {
      message: 'UOM is required',
    })
  ),
  unit_cost: nonNegativeNumber,
  line_order: z.number().int().positive().optional(),
});

export const DirectCostLineItemUpdateSchema = DirectCostLineItemSchema.extend({
  id: uuidSchema, // Required for updates
});

// =============================================================================
// DIRECT COST SCHEMA
// =============================================================================

// Base schema without refinement (can be extended)
const DirectCostBaseSchema = z.object({
  // Required fields
  cost_type: z.enum(CostTypes),
  date: z.coerce.date(),
  line_items: z
    .array(DirectCostLineItemSchema)
    .min(1, 'At least one line item is required'),

  // Optional fields
  vendor_id: optionalUuidSchema,
  employee_id: optionalUuidSchema,
  invoice_number: z.string().trim().max(255).optional().nullable(),
  status: z.enum(CostStatuses).default('Draft'),
  description: z.string().trim().max(1000).optional().nullable(),
  terms: z.string().trim().max(255).optional().nullable(),
  received_date: z.coerce.date().optional().nullable(),
  paid_date: z.coerce.date().optional().nullable(),
});

export const DirectCostCreateSchema = DirectCostBaseSchema;

// Update schema - extend the base (without refinement), then add refinement
const DirectCostUpdateBaseSchema = DirectCostBaseSchema.extend({
  id: uuidSchema,
  line_items: z
    .array(DirectCostLineItemUpdateSchema)
    .min(1, 'At least one line item is required'),
})
  .partial()
  .extend({
    // ID is always required for updates
    id: uuidSchema,
    // Line items are required if provided
    line_items: z
      .array(DirectCostLineItemUpdateSchema)
      .min(1, 'At least one line item is required')
      .optional(),
  });

export const DirectCostUpdateSchema = DirectCostUpdateBaseSchema;

// =============================================================================
// STATUS WORKFLOW SCHEMAS
// =============================================================================

export const DirectCostStatusChangeSchema = z.object({
  id: uuidSchema,
  status: z.enum(CostStatuses),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const DirectCostApprovalSchema = z.object({
  id: uuidSchema,
  action: z.enum(['approve', 'revise']),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required for approval actions')
    .max(500),
  notes: z.string().trim().max(1000).optional(),
});

export const DirectCostPaymentSchema = z.object({
  id: uuidSchema,
  paid_date: z.coerce.date(),
  payment_method: z.string().trim().max(100).optional(),
  payment_reference: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(1000).optional(),
});

// =============================================================================
// BULK OPERATIONS SCHEMAS
// =============================================================================

export const DirectCostBulkStatusUpdateSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one direct cost must be selected'),
  status: z.enum(CostStatuses),
  reason: z.string().trim().max(500).optional(),
});

export const DirectCostBulkDeleteSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one direct cost must be selected'),
  reason: z.string().trim().max(500).optional(),
});

// =============================================================================
// FILTER & SEARCH SCHEMAS
// =============================================================================

export const DirectCostFilterSchema = z
  .object({
    status: z.enum([...CostStatuses, 'all']).optional(),
    cost_type: z.enum([...CostTypes, 'all']).optional(),
    vendor_id: optionalUuidSchema,
    employee_id: optionalUuidSchema,
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
    amount_min: z.number().nonnegative().optional(),
    amount_max: z.number().nonnegative().optional(),
    search: z.string().trim().max(255).optional(),
  })
  .refine(
    (data) => {
      // Ensure date_from is before date_to if both are provided
      if (data.date_from && data.date_to) {
        return data.date_from <= data.date_to;
      }
      return true;
    },
    {
      message: 'Start date must be before or equal to end date',
      path: ['date_to'],
    }
  )
  .refine(
    (data) => {
      // Ensure amount_min is less than amount_max if both are provided
      if (data.amount_min !== undefined && data.amount_max !== undefined) {
        return data.amount_min <= data.amount_max;
      }
      return true;
    },
    {
      message: 'Minimum amount must be less than or equal to maximum amount',
      path: ['amount_max'],
    }
  );

// =============================================================================
// PAGINATION & SORTING SCHEMAS
// =============================================================================

export const DirectCostListParamsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    sort: z
      .enum(['date', 'amount', 'status', 'vendor', 'cost_type', 'created_at'])
      .default('date'),
    order: z.enum(['asc', 'desc']).default('desc'),
    view: z.enum(['summary', 'summary-by-cost-code']).default('summary'),
  })
  .merge(DirectCostFilterSchema);

// =============================================================================
// EXPORT SCHEMAS
// =============================================================================

export const DirectCostExportSchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']),
  columns: z.array(z.string()).optional(), // If not provided, export all visible columns
  filters: DirectCostFilterSchema.optional(),
  include_line_items: z.boolean().default(true),
  template: z.enum(['standard', 'accounting', 'summary']).default('standard'),
});

// =============================================================================
// ATTACHMENT SCHEMAS
// =============================================================================

export const DirectCostAttachmentSchema = z.object({
  direct_cost_id: uuidSchema,
  file_name: z.string().trim().min(1, 'File name is required').max(255),
  file_size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // 10MB limit
  mime_type: z
    .string()
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/,
      'Invalid MIME type'
    ),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Database Row types
export type DirectCostRow = Database['public']['Tables']['direct_costs']['Row'];
export type DirectCostLineItemRow =
  Database['public']['Tables']['direct_cost_line_items']['Row'];

export type DirectCostLineItem = z.infer<typeof DirectCostLineItemSchema>;
export type DirectCostLineItemUpdate = z.infer<
  typeof DirectCostLineItemUpdateSchema
>;

export type DirectCostCreate = z.infer<typeof DirectCostCreateSchema>;
export type DirectCostUpdate = z.infer<typeof DirectCostUpdateSchema>;

export type DirectCostStatusChange = z.infer<
  typeof DirectCostStatusChangeSchema
>;
export type DirectCostApproval = z.infer<typeof DirectCostApprovalSchema>;
export type DirectCostPayment = z.infer<typeof DirectCostPaymentSchema>;

export type DirectCostBulkStatusUpdate = z.infer<
  typeof DirectCostBulkStatusUpdateSchema
>;
export type DirectCostBulkDelete = z.infer<typeof DirectCostBulkDeleteSchema>;

export type DirectCostFilter = z.infer<typeof DirectCostFilterSchema>;
export type DirectCostListParams = z.infer<typeof DirectCostListParamsSchema>;

export type DirectCostExport = z.infer<typeof DirectCostExportSchema>;
export type DirectCostAttachment = z.infer<typeof DirectCostAttachmentSchema>;

// =============================================================================
// SUMMARY & AGGREGATE TYPES
// =============================================================================

// These are TypeScript-only types for API responses, not Zod schemas
export interface DirectCostSummary {
  total_amount: number;
  approved_amount: number;
  paid_amount: number;
  draft_amount: number;
  rejected_amount: number;
  count_by_status: Record<string, number>;
  count_by_cost_type: Record<string, number>;
  recent_activity: DirectCostWithLineItems[];
  monthly_trend: Array<{
    month: string;
    total: number;
    approved: number;
    paid: number;
  }>;
}

export interface DirectCostWithLineItems extends DirectCostCreate {
  id: string;
  project_id: number;
  created_at: string;
  updated_at: string;
  total_amount: number;
  line_items: (DirectCostLineItem & {
    id: string;
    line_total: number;
    budget_code?: {
      code: string;
      description: string;
    };
  })[];
  vendor?: {
    id: string;
    vendor_name: string;
  };
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface DirectCostSummaryByCostCode {
  budget_code_id: string;
  budget_code: string;
  budget_description: string;
  total_amount: number;
  item_count: number;
  cost_types: {
    cost_type: CostType;
    amount: number;
    count: number;
  }[];
}

// Alias for backward compatibility with service layer
export type CostCodeSummary = DirectCostSummaryByCostCode & {
  percentage_of_total?: number;
};
