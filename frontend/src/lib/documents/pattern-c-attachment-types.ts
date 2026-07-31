export const PATTERN_C_ENTITY_TYPES = [
  "project",
  "subcontract",
  "purchase_order",
  "prime_contract",
  "change_order",
  "commitment_change_order",
  "prime_contract_change_order",
  "prime_contract_pco",
  "change_event",
  "invoice",
  "subcontractor_invoice",
  "submittal",
  "rfi",
  "company",
  "meeting",
  "meeting_item",
] as const;

export type PatternCEntityType = (typeof PATTERN_C_ENTITY_TYPES)[number];

const PATTERN_C_ENTITY_TYPE_SET = new Set<string>(PATTERN_C_ENTITY_TYPES);

export function isPatternCEntityType(value: string): value is PatternCEntityType {
  return PATTERN_C_ENTITY_TYPE_SET.has(value);
}
