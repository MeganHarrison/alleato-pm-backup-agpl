/**
 * Estimates & Quantity Takeoff Validation Schemas
 */

import { z } from "zod";
import { Database } from "@/types/database.types";

// =============================================================================
// CONSTANTS
// =============================================================================

export const EstimateStatuses = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
] as const;
export type EstimateStatus = (typeof EstimateStatuses)[number];

export const EstimateTypes = ["asrs", "design_build"] as const;
export type EstimateType = (typeof EstimateTypes)[number];

export const EstimateTypeLabels: Record<EstimateType, string> = {
  asrs: "ASRS",
  design_build: "Construction Design Build",
};

export const EstimateTypeDescriptions: Record<EstimateType, string> = {
  asrs: "Automated Storage & Retrieval Systems — Sprinkler Design",
  design_build: "Construction Design Build Projects",
};

// Slug ↔ DB value mapping (URL slugs use hyphens, DB uses underscores)
export const EstimateTypeSlugMap: Record<string, EstimateType> = {
  asrs: "asrs",
  "design-build": "design_build",
};

export const EstimateTypeToSlug: Record<EstimateType, string> = {
  asrs: "asrs",
  design_build: "design-build",
};

export const EstimateStatusLabels: Record<EstimateStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

export const UnitTypes = [
  "EA",
  "SF",
  "LF",
  "LOT",
  "LS",
  "CY",
  "TON",
  "WK",
  "MO",
  "HR",
  "DAY",
  "GAL",
  "LB",
] as const;
export type UnitType = (typeof UnitTypes)[number];

export const CommentTypes = [
  "plug_number",
  "vendor",
  "included_in",
  "internal",
  "allowance",
  "swag",
  "excluded",
] as const;
export type CommentType = (typeof CommentTypes)[number];

export const CommentTypeLabels: Record<CommentType, string> = {
  plug_number: "Plug Number",
  vendor: "Vendor",
  included_in: "Included In",
  internal: "Internal",
  allowance: "Allowance",
  swag: "SWAG",
  excluded: "Excluded",
};

export const AlternateTypes = ["add", "deduct"] as const;
export type AlternateType = (typeof AlternateTypes)[number];

export const ScopeTypes = [
  "material_and_labor",
  "material_only",
  "labor_only",
] as const;
export type ScopeType = (typeof ScopeTypes)[number];

// =============================================================================
// HELPERS
// =============================================================================

const optionalString = z
  .string()
  .trim()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional();

const optionalNumber = z.coerce.number().nullable().optional();

const nonNegativeNumber = z.coerce.number().min(0).default(0);

// =============================================================================
// LINE ITEM SCHEMA
// =============================================================================

export const EstimateLineItemSchema = z.object({
  line_item_id: z.number().int().optional(),
  line_number: z.number().int().optional(),
  division_code: z.string().min(1, "Division is required"),
  description: optionalString,

  // Dimensions
  length: optionalNumber,
  width: optionalNumber,
  depth: optionalNumber,
  number_of_each: optionalNumber,
  quantity: optionalNumber,
  unit: optionalString,

  // Material
  material_unit_price: nonNegativeNumber,
  material_cost: nonNegativeNumber,

  // Labor
  labor_crew_size: optionalNumber,
  labor_hours: optionalNumber,
  labor_man_hours: nonNegativeNumber,
  labor_rate: optionalNumber,
  labor_cost: nonNegativeNumber,

  // Equipment
  equipment_duration: optionalNumber,
  equipment_unit: optionalString,
  equipment_rate: optionalNumber,
  equipment_cost: nonNegativeNumber,

  // Subcontract
  subcontract_unit_price: nonNegativeNumber,
  subcontract_cost: nonNegativeNumber,

  // Total
  total_cost: nonNegativeNumber,

  // Metadata
  comments: optionalString,
  comment_type: z.enum(CommentTypes).nullable().optional(),
  vendor_name: optionalString,
  gc_cost_code: optionalString,
  sort_order: z.number().int().default(0),
});

// =============================================================================
// ESTIMATE SCHEMAS
// =============================================================================

export const EstimateCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  estimate_number: optionalString,
  revision: z.coerce.number().int().min(1).default(1),
  status: z.enum(EstimateStatuses).default("draft"),
  estimate_type: z.enum(EstimateTypes).nullable().optional(),
  estimate_date: z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.coerce.date().nullable().optional()
  ),
  location: optionalString,
  estimator: optionalString,
  project_duration_weeks: z.preprocess(
    (val) => (val === "" || val === 0 || (typeof val === "number" && Number.isNaN(val)) ? null : val),
    z.coerce.number().positive().nullable().optional()
  ),
  project_duration_months: z.preprocess(
    (val) => (val === "" || val === 0 || (typeof val === "number" && Number.isNaN(val)) ? null : val),
    z.coerce.number().positive().nullable().optional()
  ),
  contingency_amount: nonNegativeNumber,
  insurance_rate: z.coerce.number().min(0).max(1).default(0.0125),
  fee_rate: z.coerce.number().min(0).max(1).default(0.1),
  notes: optionalString,
});

export const EstimateUpdateSchema = EstimateCreateSchema.partial().extend({
  estimate_id: z.number().int(),
});

export const EstimateListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z
    .enum([
      "title",
      "estimate_date",
      "status",
      "estimator",
      "revision",
      "created_at",
      "updated_at",
    ])
    .default("updated_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum([...EstimateStatuses, "all"]).optional(),
  search: z.string().trim().max(255).optional(),
});

// =============================================================================
// ALTERNATE & ALLOWANCE SCHEMAS
// =============================================================================

export const EstimateAlternateSchema = z.object({
  alternate_id: z.number().int().optional(),
  alternate_number: z.coerce.number().int().min(1),
  description: z.string().trim().min(1, "Description is required"),
  amount: z.coerce.number(),
  alternate_type: z.enum(AlternateTypes).default("add"),
  sort_order: z.number().int().default(0),
});

export const EstimateAllowanceSchema = z.object({
  allowance_id: z.number().int().optional(),
  allowance_number: z.coerce.number().int().min(1),
  description: z.string().trim().min(1, "Description is required"),
  amount: nonNegativeNumber,
  scope_type: z.enum(ScopeTypes).nullable().optional(),
  sort_order: z.number().int().default(0),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
export type EstimateLineItemRow =
  Database["public"]["Tables"]["estimate_line_items"]["Row"];
export type EstimateAlternateRow =
  Database["public"]["Tables"]["estimate_alternates"]["Row"];
export type EstimateAllowanceRow =
  Database["public"]["Tables"]["estimate_allowances"]["Row"];

export type EstimateCreate = z.infer<typeof EstimateCreateSchema>;
export type EstimateUpdate = z.infer<typeof EstimateUpdateSchema>;
export type EstimateListParams = z.infer<typeof EstimateListParamsSchema>;
export type EstimateLineItem = z.infer<typeof EstimateLineItemSchema>;
export type EstimateAlternate = z.infer<typeof EstimateAlternateSchema>;
export type EstimateAllowance = z.infer<typeof EstimateAllowanceSchema>;

// Company-level estimate row — includes joined project info
export interface CompanyEstimateRow {
  estimate_id: number;
  project_id: number;
  estimate_type: string | null;
  title: string;
  estimate_number: string | null;
  revision: number;
  status: string;
  estimate_date: string | null;
  location: string | null;
  estimator: string | null;
  updated_at: string;
  created_at: string;
  project_name: string | null;
  project_number: string | null;
}

// Stats for hub tiles
export interface EstimateTypeStat {
  type: EstimateType | null;
  total: number;
  pending_review: number;
  draft: number;
  approved: number;
  rejected: number;
}

export interface EstimateWithLineItems extends EstimateRow {
  line_items: EstimateLineItemRow[];
  alternates: EstimateAlternateRow[];
  allowances: EstimateAllowanceRow[];
  division_totals: DivisionTotal[];
}

export interface DivisionTotal {
  division_code: string;
  division_name: string;
  material_total: number;
  labor_total: number;
  equipment_total: number;
  subcontract_total: number;
  division_total: number;
  line_count: number;
}

export interface EstimateSummary {
  subtotal: number;
  contingency: number;
  insurance: number;
  fee: number;
  grand_total: number;
}

// =============================================================================
// CALCULATION HELPERS
// =============================================================================

export function calculateLineItemCosts(item: Partial<EstimateLineItem>) {
  const qty = item.quantity ?? 0;
  const materialCost = (item.material_unit_price ?? 0) * qty;
  const laborManHours =
    (item.labor_crew_size ?? 0) * (item.labor_hours ?? 0) * qty;
  const laborCost = (item.labor_rate ?? 0) * laborManHours;
  const equipmentCost =
    (item.equipment_rate ?? 0) * (item.equipment_duration ?? 0);
  const subcontractCost = (item.subcontract_unit_price ?? 0) * qty;
  const totalCost = materialCost + laborCost + equipmentCost + subcontractCost;

  return {
    material_cost: Math.round(materialCost * 100) / 100,
    labor_man_hours: Math.round(laborManHours * 100) / 100,
    labor_cost: Math.round(laborCost * 100) / 100,
    equipment_cost: Math.round(equipmentCost * 100) / 100,
    subcontract_cost: Math.round(subcontractCost * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
  };
}

export function calculateEstimateSummary(
  divisionTotals: DivisionTotal[],
  estimate: Pick<
    EstimateRow,
    "contingency_amount" | "insurance_rate" | "fee_rate"
  >
): EstimateSummary {
  const subtotal = divisionTotals.reduce(
    (sum, d) => sum + (d.division_total ?? 0),
    0
  );
  const contingency = estimate.contingency_amount ?? 0;
  const insurance = Math.round(subtotal * (estimate.insurance_rate ?? 0) * 100) / 100;
  const fee =
    Math.round(
      (subtotal + insurance) * (estimate.fee_rate ?? 0) * 100
    ) / 100;
  const grand_total = subtotal + contingency + insurance + fee;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    contingency: Math.round(contingency * 100) / 100,
    insurance,
    fee,
    grand_total: Math.round(grand_total * 100) / 100,
  };
}
