import { z } from "zod";

const numericString = z
  .string()
  .trim()
  .refine((val) => val === "" || !Number.isNaN(Number(val)), "Must be numeric");

const amountString = numericString.refine(
  (val) => val !== "" && Number(val) !== 0,
  "Amount must be non-zero",
);

const budgetLineAmountString = numericString.refine(
  (val) => val !== "",
  "Amount is required",
);

const optionalString = z
  .string()
  .trim()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional();

export const BudgetLineItemSchema = z.object({
  costCodeId: z.string().min(1, "Budget code required"),
  costType: z.string().min(1, "Cost type is required"),
  qty: numericString.optional(),
  uom: optionalString,
  unitCost: numericString.optional(),
  amount: budgetLineAmountString,
  allowZeroAmount: z.boolean().optional(),
  description: optionalString,
}).superRefine((value, ctx) => {
  if (Number(value.amount) === 0 && value.allowZeroAmount !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Amount must be non-zero unless allowZeroAmount is true",
      path: ["amount"],
    });
  }
});

export const BudgetLineItemsPayloadSchema = z.object({
  lineItems: z
    .array(BudgetLineItemSchema)
    .min(1, "At least one line item is required"),
});

const BudgetModificationTransferLineSchema = z.object({
  fromBudgetLineId: z.string().uuid("fromBudgetLineId must be a valid UUID"),
  toBudgetLineId: z.string().uuid("toBudgetLineId must be a valid UUID"),
  amount: amountString,
  notes: optionalString,
});

export const BudgetModificationPayloadSchema = z
  .object({
    budgetItemId: z.string().uuid("budgetItemId must be a valid UUID").optional(),
    amount: amountString.optional(),
    title: optionalString,
    description: optionalString,
    reason: optionalString,
    approver: optionalString,
    modificationType: z.enum(["addition", "deduction"]).optional().nullable(),
    changeEventId: z.string().uuid().optional().nullable(),
    transferLines: z.array(BudgetModificationTransferLineSchema).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.transferLines?.length) {
      for (const [index, line] of value.transferLines.entries()) {
        if (line.fromBudgetLineId === line.toBudgetLineId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "From and To budget line items must be different",
            path: ["transferLines", index, "toBudgetLineId"],
          });
        }
      }
      return;
    }

    if (!value.budgetItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "budgetItemId is required",
        path: ["budgetItemId"],
      });
    }

    if (!value.amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "amount is required",
        path: ["amount"],
      });
    }
  });

// Schema for modification status actions (submit, approve, reject, void)
export const BudgetModificationActionSchema = z.object({
  modificationId: z.string().uuid("modificationId must be a valid UUID"),
  action: z.enum(["submit", "approve", "reject", "void"]).optional(),
  status: z.enum(["draft", "pending", "approved", "void"]).optional(),
  voidedReason: z.string().min(1).max(1000).optional(),
}).superRefine((value, ctx) => {
  if (!value.action && !value.status) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either action or status is required",
      path: ["action"],
    });
  }
});

export type BudgetLineItemPayload = z.infer<
  typeof BudgetLineItemsPayloadSchema
>;
export type BudgetModificationPayload = z.infer<
  typeof BudgetModificationPayloadSchema
>;
export type BudgetModificationAction = z.infer<
  typeof BudgetModificationActionSchema
>;
