/**
 * Budget-related constants for cost types and units of measure
 */

export const COST_TYPES = [
  {
    code: "R",
    label: "Contract Revenue",
    description: "Revenue from contracts",
  },
  { code: "E", label: "Equipment", description: "Equipment costs" },
  { code: "X", label: "Expense", description: "General expenses" },
  { code: "L", label: "Labor", description: "Labor costs" },
  { code: "M", label: "Material", description: "Material costs" },
  { code: "S", label: "Subcontract", description: "Subcontractor costs" },
] as const;

export type CostTypeCode = (typeof COST_TYPES)[number]["code"];

export const COST_TYPE_MAP: Record<CostTypeCode, string> = {
  R: "Contract Revenue",
  E: "Equipment",
  X: "Expense",
  L: "Labor",
  M: "Material",
  S: "Subcontract",
};

export const UNITS_OF_MEASURE = [
  { code: "EA", label: "Each" },
  { code: "SF", label: "Square Foot" },
  { code: "LF", label: "Linear Foot" },
  { code: "SY", label: "Square Yard" },
  { code: "CY", label: "Cubic Yard" },
  { code: "TON", label: "Ton" },
  { code: "HR", label: "Hour" },
  { code: "DAY", label: "Day" },
  { code: "LS", label: "Lump Sum" },
  { code: "LB", label: "Pound" },
  { code: "GAL", label: "Gallon" },
  { code: "CF", label: "Cubic Foot" },
  { code: "BF", label: "Board Foot" },
  { code: "MSF", label: "Thousand Square Feet" },
] as const;

export type UnitOfMeasureCode = (typeof UNITS_OF_MEASURE)[number]["code"];

/**
 * Get the label for a cost type code
 */
export function getCostTypeLabel(code: string): string {
  return COST_TYPE_MAP[code as CostTypeCode] || code;
}

/**
 * Get the label for a unit of measure code
 */
export function getUomLabel(code: string): string {
  const uom = UNITS_OF_MEASURE.find((u) => u.code === code);
  return uom ? uom.label : code;
}

/**
 * Resolve a stored unit-of-measure string to its canonical (UPPERCASE) code.
 *
 * Canonical codes are stored uppercase. An edit form whose `<Select>` options
 * use a different casing than the stored value renders a blank placeholder on
 * edit (the value never matches an option) and can silently drop the value on
 * save — the same symptom as a FK id mismatch. Always normalize a stored UOM
 * through this helper before seeding a select. Case-insensitive match falls
 * back to the trimmed raw value so unknown/custom codes are preserved.
 */
export function normalizeUomCode(raw?: string | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const match = UNITS_OF_MEASURE.find(
    (u) => u.code.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ? match.code : trimmed;
}
