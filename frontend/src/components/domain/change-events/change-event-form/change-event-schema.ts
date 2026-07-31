import { z } from "zod";

import type { ChangeEventFormData } from "./types";
import { createEmptyLineItem, DEFAULT_LINE_ITEM_REVENUE_SOURCE } from "./types";

/**
 * Zod schema for the Change Event form.
 *
 * The inferred output type is intentionally identical to `ChangeEventFormData`
 * (same field names, same shapes) so the create/edit pages' POST/PATCH payload
 * builders keep receiving the exact same object they always have. Required
 * fields mirror the previous imperative `validate()` (title, status, type);
 * everything else stays optional exactly as before.
 *
 * Line-item numeric fields are strict `z.number()` on purpose: a blank money
 * cell surfaces a loud validation error rather than silently becoming 0 — the
 * default empty row created by `createEmptyLineItem()` already holds numbers
 * (0 / 1), so it never trips the validator.
 */
const lineItemSchema = z.object({
  id: z.string().optional(),
  budgetCode: z.string(),
  description: z.string(),
  vendor: z.string(),
  contract: z.string(),
  commitmentId: z.string().optional(),
  commitmentLineItemId: z.string(),
  revenueUnitOfMeasure: z.string(),
  revenueQuantity: z.number(),
  revenueUnitCost: z.number(),
  revenueRom: z.number(),
  costQuantity: z.number(),
  costUnitCost: z.number(),
  costRom: z.number(),
  nonCommittedCost: z.number(),
});

export const changeEventFormSchema = z
  .object({
    number: z.string().optional(),
    contractNumber: z.string(),
    title: z
      .string()
      .min(1, "Title is required")
      .max(255, "Title must be 255 characters or fewer"),
    status: z.string().min(1, "Status is required"),
    origin: z.string().optional(),
    originId: z.string().optional(),
    // Kept optional so the inferred type matches ChangeEventFormData (`type?:`);
    // required-ness is enforced in the superRefine below (mirrors the previous
    // imperative validate()).
    type: z.string().optional(),
    changeReason: z.string().optional(),
    scope: z.string().optional(),
    expectingRevenue: z.boolean().optional(),
    lineItemRevenueSource: z.string().optional(),
    primeContractId: z.string().optional(),
    description: z.string().optional(),
    attachments: z.array(z.instanceof(File)),
    lineItems: z.array(lineItemSchema),
  })
  .superRefine((values, ctx) => {
    if (!values.type || !values.type.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "Type is required",
      });
    }
  });

/**
 * Build RHF default values from (possibly partial) initial data. Mirrors the
 * old `useState` initializer in `useChangeEventFormData` exactly — including
 * `contractNumber` falling back to `number`, and seeding one empty line item
 * when none are provided.
 */
export function buildChangeEventDefaults(
  initialData?: Partial<ChangeEventFormData>,
): ChangeEventFormData {
  const expectingRevenue = initialData?.expectingRevenue ?? true;
  return {
    number: initialData?.number,
    contractNumber: initialData?.contractNumber || initialData?.number || "",
    title: initialData?.title || "",
    status: initialData?.status || "Open",
    origin: initialData?.origin,
    originId: initialData?.originId,
    type: initialData?.type || "",
    changeReason: initialData?.changeReason,
    scope: initialData?.scope || "",
    expectingRevenue,
    // Default to Procore's revenue source ("Match Revenue to Latest Cost") when
    // revenue is expected and none was chosen, so revenue mirrors cost and the
    // revenue Qty/Unit-Cost cells auto-populate + roll up (instead of $0).
    lineItemRevenueSource:
      initialData?.lineItemRevenueSource ||
      (expectingRevenue === false ? "" : DEFAULT_LINE_ITEM_REVENUE_SOURCE),
    primeContractId: initialData?.primeContractId || "",
    description: initialData?.description || "",
    attachments: initialData?.attachments || [],
    lineItems:
      initialData?.lineItems && initialData.lineItems.length > 0
        ? initialData.lineItems
        : [createEmptyLineItem()],
  };
}
