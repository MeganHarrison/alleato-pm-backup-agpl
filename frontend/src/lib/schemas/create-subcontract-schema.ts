import { z } from "zod";
import {
  optionalNumber,
  optionalPercent,
  optionalPositiveNumber,
} from "./common";
import { normalizeCommitmentContractNumber } from "@/lib/commitments/contract-number";

/**
 * Commitment Status enum values matching the subcontracts.status DB constraint.
 */
export const CommitmentStatusValues = [
  "Draft",
  "Out for Bid",
  "Out for Signature",
  "Approved",
  "Complete",
  "Terminated",
] as const;

export type CommitmentStatus = (typeof CommitmentStatusValues)[number];

/**
 * Accounting Method options
 */
export const AccountingMethodValues = ["amount_based", "unit_quantity"] as const;
export type AccountingMethod = (typeof AccountingMethodValues)[number];

/**
 * Date validation - accepts Date objects or ISO strings
 */
const optionalDate = z
  .union([z.date(), z.string().datetime().optional(), z.string().optional()])
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    if (typeof val === "string" && val.trim() === "") return undefined;
    return val;
  });

/**
 * SOV Line Item schema for Subcontracts
 */
export const SovLineItemSchema = z.object({
  lineNumber: optionalNumber, // maps to '#'
  changeEventLineItem: z.string().trim().optional(),
  budgetCode: z.string().trim().optional(),
  budgetCodeId: z.string().trim().optional(), // FK to project_budget_codes
  projectBudgetCodeId: z.string().trim().optional(),
  budgetCodeLabel: z.string().trim().optional(), // display label
  description: z.string().trim().optional(),
  amount: optionalPositiveNumber,
  quantity: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  unitOfMeasure: z.string().trim().optional(),
  billedToDate: optionalPositiveNumber,
  isGroup: z.boolean().optional(), // true for group header rows
  // Amount Remaining is displayed as a column but is typically computed:
  // amountRemaining = amount - billedToDate
});

/**
 * Privacy settings schema
 */
export const PrivacySettingsSchema = z.object({
  isPrivate: z.boolean(),
  nonAdminUserIds: z.array(z.string()).optional(),
  allowNonAdminViewSovItems: z.boolean(),
});

/**
 * Contract dates schema
 */
export const ContractDatesSchema = z.object({
  startDate: optionalDate,
  estimatedCompletionDate: optionalDate,
  actualCompletionDate: optionalDate,
  contractDate: optionalDate,
  signedContractReceivedDate: optionalDate,
  issuedOnDate: optionalDate,
});

/**
 * Main Create Subcontract schema with enhanced validation
 */
export const CreateSubcontractSchema = z.object({
  // Required fields
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be 255 characters or less"),
  status: z.enum(CommitmentStatusValues),
  contractCompanyId: z.string().min(1, "Please select a vendor"),
  companyLicenseNumber: z.string().trim().max(50, "License number must be 50 characters or less").optional(),

  // Auto-generated but editable
  contractNumber: z
    .string()
    .min(1, "Contract number is required")
    .max(50, "Contract number must be 50 characters or less")
    .transform((value) => normalizeCommitmentContractNumber(value, "SC-")),

  // Optional fields with validation
  executed: z.boolean(),
  defaultRetainagePercent: optionalPercent,
  accountingMethod: z.enum(AccountingMethodValues),

  // Rich text fields (stored as HTML)
  description: z.string().optional(),
  inclusions: z.string().optional(),
  exclusions: z.string().optional(),

  // Attachments
  attachments: z
    .array(
      z.object({
        name: z.string(),
        size: z.number().optional(),
        type: z.string().optional(),
      }),
    )
    .optional(),

  // Schedule of Values
  sov: z.array(SovLineItemSchema).optional(),

  // Contract dates
  dates: ContractDatesSchema.optional(),

  // Privacy & access control
  privacy: PrivacySettingsSchema.optional(),

  // Invoice contacts (only valid after company selection)
  invoiceContactIds: z.array(z.string()).optional(),
});

/**
 * Edit Subcontract schema - all fields optional except id
 */
export const EditSubcontractSchema = CreateSubcontractSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateSubcontractInput = z.infer<typeof CreateSubcontractSchema>;
export type EditSubcontractInput = z.infer<typeof EditSubcontractSchema>;
export type SovLineItem = z.infer<typeof SovLineItemSchema>;
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;
export type ContractDates = z.infer<typeof ContractDatesSchema>;
