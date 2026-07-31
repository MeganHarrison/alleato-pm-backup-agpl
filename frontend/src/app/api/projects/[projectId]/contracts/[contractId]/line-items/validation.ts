import { z } from "zod";

/**
 * Validation schemas for Contract Line Items API endpoints
 *
 * NOTE: cost_code_id is a TEXT column in Supabase (matches cost_codes.id which
 * is also text). It is NOT an integer despite some legacy code treating it that way.
 * budget_code_id is a UUID FK to project_budget_codes.
 */

const MARKUP_TYPES = ['insurance', 'fee', 'overhead', 'profit', 'bond', 'tax', 'other', 'custom'] as const;

export const createLineItemSchema = z.object({
  contract_id: z.string().uuid(),
  line_number: z.number().int().positive(),
  description: z.string().min(1).max(500),
  cost_code_id: z.string().optional().nullable(),
  budget_code_id: z.string().uuid().optional().nullable(),
  quantity: z.number().min(0).optional().default(0),
  unit_of_measure: z.string().max(50).optional().nullable(),
  unit_cost: z.number().min(0).optional().default(0),
  markup_type: z.enum(MARKUP_TYPES).optional().nullable(),
});

export const updateLineItemSchema = z.object({
  line_number: z.number().int().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  cost_code_id: z.string().optional().nullable(),
  budget_code_id: z.string().uuid().optional().nullable(),
  quantity: z.number().min(0).optional(),
  unit_of_measure: z.string().max(50).optional().nullable(),
  unit_cost: z.number().min(0).optional(),
  markup_type: z.enum(MARKUP_TYPES).optional().nullable(),
});

export type CreateLineItemInput = z.infer<typeof createLineItemSchema>;
export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;
