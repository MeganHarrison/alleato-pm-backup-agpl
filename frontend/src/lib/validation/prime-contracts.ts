import { z } from "zod";

const clientSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const primeContractSchema = z
  .object({
    id: z.string(),
    project_id: z.number(),
    contract_number: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    client_id: z.string().nullable().optional(),
    vendor_id: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    status: z
      .enum([
        "draft",
        "out_for_signature",
        "approved",
        "complete",
        "terminated",
      ])
      .nullable()
      .optional(),
    erp_status: z
      .enum(["unsynced", "synced", "error"])
      .optional()
      .default("unsynced"),
    executed: z.boolean().nullable().optional(),
    executed_at: z.string().nullable().optional(),
    original_contract_value: z.number().nullable().optional(),
    revised_contract_value: z.number().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    retention_percentage: z.number().nullable().optional(),
    payment_terms: z.string().nullable().optional(),
    billing_schedule: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    client: clientSchema,
    approved_change_orders: z.number().nullable().optional(),
    pending_change_orders: z.number().nullable().optional(),
    draft_change_orders: z.number().nullable().optional(),
    invoiced_amount: z.number().nullable().optional(),
    payments_received: z.number().nullable().optional(),
    remaining_balance: z.number().nullable().optional(),
    is_private: z.boolean().nullable().optional(),
    percent_paid: z.number().nullable().optional(),
    attachment_count: z.number().optional().default(0),
  })
  .passthrough();

export const primeContractsSchema = z.array(primeContractSchema);

export type PrimeContract = z.infer<typeof primeContractSchema>;
