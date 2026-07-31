import { z } from "zod"; // Enums matching database CHECK constraints
const normalizeEnumKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

function createNormalizedEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  aliases: Record<string, T[number]> = {},
) {
  const normalizedValueMap = new Map<string, T[number]>();
  values.forEach((value) => {
    normalizedValueMap.set(normalizeEnumKey(value), value);
  });
  Object.entries(aliases).forEach(([alias, value]) => {
    normalizedValueMap.set(normalizeEnumKey(alias), value);
  });

  return z.preprocess((input) => {
    if (typeof input !== "string") return input;
    const normalized = normalizeEnumKey(input);
    return normalizedValueMap.get(normalized) ?? input.trim();
  }, z.enum(values));
}

// Canonical Title Case values are the single source of truth for both the zod
// enums (PATCH/POST validation) and any UI that needs to offer these as options
// (e.g. inline-edit selects on the change-events table). Keep these arrays as the
// authoritative list — derive option lists from them, never re-type them.
export const CHANGE_EVENT_TYPE_VALUES = [
  "Owner Change",
  "Design Change",
  "Allowance",
  "Contingency",
  "Scope Gap",
  "TBD",
  "Transfer",
  "Unforeseen Condition",
  "Value Engineering",
  "Owner Requested",
  "Constructability Issue",
] as const;
export const CHANGE_EVENT_SCOPE_VALUES = [
  "TBD",
  "In Scope",
  "Out of Scope",
  "Allowance",
] as const;
export const CHANGE_EVENT_REASON_VALUES = [
  "Allowance",
  "Back Charge",
  "Client Request",
  "Design Development",
  "Existing Condition",
] as const;
export const CHANGE_EVENT_ORIGIN_VALUES = [
  "Internal",
  "RFI",
  "Field",
  "Emails",
  "Meetings",
  "RFI's",
] as const;

export const ChangeEventType = createNormalizedEnum(CHANGE_EVENT_TYPE_VALUES);
export const ChangeEventScope = createNormalizedEnum(CHANGE_EVENT_SCOPE_VALUES, {
  in_scope: "In Scope",
  out_of_scope: "Out of Scope",
});
// Procore-aligned status set — must match DB CHECK constraint on change_events.status.
// Valid DB values: 'Open', 'Pending Approval', 'Approved', 'Rejected', 'Closed', 'Converted'
export const ChangeEventStatus = createNormalizedEnum(
  [
    "Open",
    "Pending",
    "Pending Approval",
    "Approved",
    "Rejected",
    "Closed",
    "Void",
    "Converted",
  ],
  {
    pending: "Pending Approval",
    pending_approval: "Pending Approval",
    "pending approval": "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    converted: "Converted",
    close: "Closed",
    void: "Void",
  },
);
// Procore-aligned change reason set.
export const ChangeEventReason = createNormalizedEnum(
  CHANGE_EVENT_REASON_VALUES,
  {
    backcharge: "Back Charge",
    back_charge: "Back Charge",
  },
);
export const ChangeEventOrigin = createNormalizedEnum(
  CHANGE_EVENT_ORIGIN_VALUES,
  {
    rfis: "RFI's",
  },
);
export const LineItemRevenueSource = createNormalizedEnum([
  "Match Revenue to Latest Cost",
  "Enter manually",
  "Quantity x Unit Cost",
]);
export const LineItemRevenueSourceUpdate = LineItemRevenueSource.nullable().optional();
export const createChangeEventSchema = z.object({
  title: z.string().min(1).max(255, "Title must be less than 255 characters"),
  type: ChangeEventType,
  status: ChangeEventStatus.optional(),
  reason: ChangeEventReason.optional(),
  scope: ChangeEventScope,
  origin: ChangeEventOrigin.optional(),
  expectingRevenue: z.boolean().default(true),
  lineItemRevenueSource: LineItemRevenueSource.optional(),
  // Prime contract FK references prime_contracts.id (UUID).
  primeContractId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  description: z.string().optional(),
});

// Update Change Event Schema
export const updateChangeEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: ChangeEventType.nullable().optional(),
  reason: ChangeEventReason.nullable().optional(),
  scope: ChangeEventScope.nullable().optional(),
  origin: ChangeEventOrigin.nullable().optional(),
  expectingRevenue: z.boolean().optional(),
  lineItemRevenueSource: LineItemRevenueSourceUpdate,
  // Prime contract FK references prime_contracts.id (UUID).
  primeContractId: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().uuid().nullable().optional(),
  ),
  description: z.string().nullable().optional(),
  status: ChangeEventStatus.optional(), // Only admin can change status
}); // Create Line Item Schema
export const createLineItemSchema = z.object({
  budgetCodeId: z.string().uuid().optional(),
  description: z.string(),
  vendorId: z.string().uuid().optional(),
  // Contract FK references prime_contracts.id (UUID).
  contractId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  commitmentId: z.string().uuid().optional(),
  commitmentType: z.enum(["subcontract", "purchase_order"]).optional(),
  commitmentLineItemId: z.string().uuid().optional(),
  unitOfMeasure: z.string().max(50).optional(),
  quantity: z.number().positive().optional(),
  unitCost: z.number().nonnegative().optional(),
  revenueRom: z.number().nonnegative().optional(),
  costRom: z.number().nonnegative().optional(),
  nonCommittedCost: z.number().optional(), // can be negative when revenue > cost
  latestPrice: z.number().nonnegative().optional(),
  sortOrder: z.number().int().default(0),
}); // Update Line Item Schema
export const updateLineItemSchema = createLineItemSchema.partial(); // Query params schema
export const changeEventQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(25),
  status: ChangeEventStatus.optional(),
  type: ChangeEventType.optional(),
  scope: ChangeEventScope.optional(),
  search: z.string().optional(),
  sort: z
    .enum(["createdAt", "updatedAt", "number", "title"])
    .default("number"),
  order: z.enum(["asc", "desc"]).default("asc"),
  includeDeleted: z.coerce.boolean().default(false),
  tab: z.enum(["line_items", "no_line_items", "rfqs", "recycle_bin", "all"]).optional(),
}); // Attachment Schema
export const createAttachmentSchema = z.object({
  fileName: z.string().max(255),
  filePath: z.string(),
  fileSize: z.number().positive(),
  mimeType: z.string().max(100),
});

// Approval Status Enum (matches DB CHECK constraint)
export const ApprovalStatus = z.enum(["pending", "approved", "rejected"]);

// Change Event Approval Schema
export const changeEventApprovalSchema = z.object({
  approver_id: z.string().uuid(),
  approval_status: ApprovalStatus.default("pending"),
  comments: z.string().optional(),
});

// Update Approval Schema
export const updateApprovalSchema = z.object({
  approval_id: z.string().uuid(),
  approval_status: ApprovalStatus,
  comments: z.string().optional(),
});
