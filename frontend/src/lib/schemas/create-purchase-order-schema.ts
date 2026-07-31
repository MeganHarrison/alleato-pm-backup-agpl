import { z } from "zod";
import {
  optionalNumber,
  optionalPercent,
  optionalPositiveNumber,
  requiredNumber,
} from "./common";
import { normalizeCommitmentContractNumber } from "@/lib/commitments/contract-number";

// SOV Line Item for Purchase Orders (Unit/Quantity-based)
export const PurchaseOrderSovLineItemSchema = z.object({
  lineNumber: requiredNumber,
  changeEventLineItem: z.string().optional(),
  budgetCode: z.string().optional(),
  budgetCodeId: z.string().optional(),
  projectBudgetCodeId: z.string().optional(),
  budgetCodeLabel: z.string().optional(),
  description: z.string().optional(),
  quantity: optionalNumber,
  uom: z.string().optional(), // Unit of Measure: EA, LF, SF, etc.
  unitCost: optionalNumber,
  amount: requiredNumber,
  billedToDate: optionalPositiveNumber,
});

export type PurchaseOrderSovLineItem = z.infer<
  typeof PurchaseOrderSovLineItemSchema
>;

// Contract Dates
const ContractDatesSchema = z.object({
  contractDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  signedPoReceivedDate: z.string().optional(),
  issuedOnDate: z.string().optional(),
});

// Privacy Settings
const PrivacySchema = z.object({
  isPrivate: z.boolean(),
  nonAdminUserIds: z.array(z.string()).optional(),
  allowNonAdminViewSovItems: z.boolean(),
});

// Main Purchase Order Schema
export const CreatePurchaseOrderSchema = z.object({
  // General Information
  contractNumber: z
    .string()
    .min(1, "Contract number is required")
    .transform((value) => normalizeCommitmentContractNumber(value, "PO-")),
  contractCompanyId: z.string().optional(),
  companyLicenseNumber: z.string().trim().max(50, "License number must be 50 characters or less").optional(),
  title: z.string().min(1, "Title is required"),
  status: z.enum([
    "Draft",
    "Out for Bid",
    "Out for Signature",
    "Approved",
    "Complete",
    "Terminated",
  ]),
  executed: z.boolean(),
  defaultRetainagePercent: optionalPercent,
  assignedTo: z.string().optional(), // User ID

  // Billing & Shipping
  // Legacy free-text fields — retained for backward compatibility with older
  // records; new POs populate the structured fields below.
  billTo: z.string().optional(),
  shipTo: z.string().optional(),
  paymentTerms: z.string().optional(),
  shipVia: z.string().optional(),

  // Bill To (structured): company is the source of the auto-filled address;
  // address fields remain manually editable.
  billToCompanyId: z.string().optional(),
  billToContactId: z.string().optional(),
  billToAddress: z.string().optional(),
  billToAddressLine2: z.string().optional(),
  billToCity: z.string().optional(),
  billToState: z.string().optional(),
  billToZip: z.string().optional(),

  // Ship To (structured): contact is an employee of the ship-to company.
  shipToCompanyId: z.string().optional(),
  shipToContactId: z.string().optional(),
  shipToAddress: z.string().optional(),
  shipToAddressLine2: z.string().optional(),
  shipToCity: z.string().optional(),
  shipToState: z.string().optional(),
  shipToZip: z.string().optional(),

  // Description
  description: z.string().optional(),

  // Schedule of Values (Unit/Quantity-based)
  sov: z.array(PurchaseOrderSovLineItemSchema),
  accountingMethod: z.enum(["unit-quantity", "amount"]),

  // Contract Dates
  dates: ContractDatesSchema.optional(),

  // Privacy & Access
  privacy: PrivacySchema.optional(),

  // Invoice Contacts
  invoiceContactIds: z.array(z.string()).optional(),
});

export type CreatePurchaseOrderInput = z.infer<
  typeof CreatePurchaseOrderSchema
>;
