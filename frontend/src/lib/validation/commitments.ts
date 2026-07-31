import { z } from "zod";

export const commitmentListItemSchema = z
  .object({
    id: z.string(),
    project_id: z.number(),
    number: z.string(),
    title: z.string().nullable(),
    type: z.string(),
    status: z.string(),
    executed: z.boolean(),
    original_amount: z.number(),
    revised_contract_amount: z.number(),
    billed_to_date: z.number(),
    balance_to_finish: z.number(),
    contract_company_id: z.string().nullable(),
    contract_company: z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string().optional(),
      })
      .nullable(),
    description: z.string().nullable(),
    start_date: z.string().nullable(),
    executed_date: z.string().nullable(),
    retention_percentage: z.number().nullable(),
    created_at: z.string(),
    created_by_name: z.string().nullable().optional(),
    updated_at: z.string(),
    erp_status: z.string().nullable(),
    ssov_status: z.string().nullable(),
    approved_change_orders: z.number(),
    change_order_count: z.number().int().nonnegative().optional(),
    pending_change_orders: z.number(),
    draft_change_orders: z.number(),
    invoiced_amount: z.number(),
    payments_issued: z.number(),
    percent_paid: z.number(),
    remaining_balance: z.number(),
    cost_codes: z.array(z.string()),
    trade_names: z.array(z.string()),
    scope_summary: z.string().nullable(),
    is_private: z.boolean(),
  })
  .passthrough();

export const commitmentListResponseSchema = z.object({
  data: z.array(commitmentListItemSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export const commitmentScopeLookupItemSchema = z.object({
  id: z.string(),
  commitment_type: z.enum(["subcontract", "purchase_order"]),
  contract_company_id: z.string().nullable(),
  contract_company_name: z.string().nullable(),
  contract_number: z.string().nullable(),
  title: z.string().nullable(),
  trade_names: z.array(z.string()),
  scope_summary: z.string().nullable(),
  inclusion_summary: z.string().nullable(),
  exclusion_summary: z.string().nullable(),
  match_reason: z.string().nullable(),
  matched_text: z.string().nullable(),
  score: z.number(),
});

export const commitmentScopeLookupResponseSchema = z.object({
  data: z.array(commitmentScopeLookupItemSchema),
});

export type CommitmentListItem = z.infer<typeof commitmentListItemSchema>;
export type CommitmentListResponse = z.infer<typeof commitmentListResponseSchema>;
export type CommitmentScopeLookupItem = z.infer<typeof commitmentScopeLookupItemSchema>;
export type CommitmentScopeLookupResponse = z.infer<typeof commitmentScopeLookupResponseSchema>;
