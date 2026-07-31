import { z } from "zod";

/**
 * Validation schemas for Contract Change Orders API endpoints
 */

export const createChangeOrderSchema = z.object({
  contract_id: z.string().uuid(),
  change_order_number: z.string().min(1).max(50),
  description: z.string().min(1).max(1000),
  amount: z.number(),
  status: z
    .enum(["pending", "approved", "rejected"])
    .optional()
    .default("pending"),
  requested_date: z.string().datetime().optional(),
});

export const updateChangeOrderSchema = z.object({
  change_order_number: z.string().min(1).max(50).optional(),
  description: z.string().min(1).max(1000).optional(),
  amount: z.number().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  approved_by: z.string().uuid().optional().nullable(),
  approved_date: z.string().datetime().optional().nullable(),
  rejection_reason: z.string().max(1000).optional().nullable(),
});

export const approveChangeOrderSchema = z.object({
  approved_by: z.string().uuid(),
});

export const rejectChangeOrderSchema = z.object({
  rejection_reason: z.string().min(1).max(1000),
});

export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>;
export type UpdateChangeOrderInput = z.infer<typeof updateChangeOrderSchema>;
export type ApproveChangeOrderInput = z.infer<typeof approveChangeOrderSchema>;
export type RejectChangeOrderInput = z.infer<typeof rejectChangeOrderSchema>;

/**
 * Validation schemas for Change Order Line Items
 */

export const createLineItemSchema = z.object({
  cost_code_id: z.string().uuid(),
  cost_type_id: z.string().uuid(),
  description: z.string().max(1000).optional(),
  amount: z.number().default(0),
  sub_job_id: z.string().uuid().optional().nullable(),
});

export const updateLineItemSchema = z.object({
  cost_code_id: z.string().uuid().optional(),
  cost_type_id: z.string().uuid().optional(),
  description: z.string().max(1000).optional().nullable(),
  amount: z.number().optional(),
  sub_job_id: z.string().uuid().optional().nullable(),
});

export type CreateLineItemInput = z.infer<typeof createLineItemSchema>;
export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;
