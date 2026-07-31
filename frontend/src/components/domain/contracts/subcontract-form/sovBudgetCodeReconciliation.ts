import type { SovLineItem } from "@/lib/schemas/create-subcontract-schema";
import type { BudgetCode } from "./types";

// Subcontract SOV stores budget codes as TEXT (no FK constraint), but the
// SOV form's BudgetCodeSelector dropdown options are keyed on
// project_budget_codes.id. These helpers bridge the two so an existing SOV
// row's stored text is reconciled to a real dropdown option on edit, and a
// stale stored code (no longer in project_budget_codes) still renders rather
// than collapsing the dropdown to its empty placeholder.

function normalizeLookup(value: string | null | undefined): string {
  return (value || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function findBudgetCode(storedCode: string, budgetCodes: BudgetCode[]) {
  const textKey = normalizeText(storedCode);
  const lookupKey = normalizeLookup(storedCode);
  return budgetCodes.find(
    (code) =>
      code.id === storedCode ||
      normalizeText(code.code) === textKey ||
      normalizeText(code.costCodeId) === textKey ||
      normalizeText(code.fullLabel) === textKey ||
      normalizeLookup(code.code) === lookupKey ||
      normalizeLookup(code.costCodeId) === lookupKey ||
      normalizeText(code.description) === textKey ||
      normalizeText(code.fullLabel).startsWith(textKey),
  );
}

export function reconcileSovBudgetCodes(
  lines: SovLineItem[],
  budgetCodes: BudgetCode[],
): { lines: SovLineItem[]; changed: boolean } {
  if (budgetCodes.length === 0) return { lines, changed: false };
  let changed = false;
  const next = lines.map((line) => {
    if (line.isGroup || (line.budgetCodeId && line.budgetCodeLabel)) return line;
    const storedCode = `${line.budgetCode ?? ""}`.trim();
    if (!storedCode) return line;
    const matched = findBudgetCode(storedCode, budgetCodes);
    if (!matched) return line;
    changed = true;
    return {
      ...line,
      budgetCodeId: matched.id,
      budgetCode: matched.code,
      budgetCodeLabel: matched.fullLabel,
    };
  });
  return { lines: changed ? next : lines, changed };
}

export function synthesizeMissingBudgetCodes(
  lines: SovLineItem[],
  budgetCodes: BudgetCode[],
): BudgetCode[] {
  const existing = new Set<string>();
  budgetCodes.forEach((code) => {
    [code.id, code.code, code.costCodeId, code.fullLabel].forEach((value) => {
      if (!value) return;
      existing.add(normalizeText(value));
      existing.add(normalizeLookup(value));
    });
  });
  const synthetic: BudgetCode[] = [];
  for (const line of lines) {
    if (line.isGroup) continue;
    const code = `${line.budgetCode ?? ""}`.trim();
    if (!code) continue;
    const textKey = normalizeText(code);
    const lookupKey = normalizeLookup(code);
    if (existing.has(textKey) || existing.has(lookupKey)) continue;
    existing.add(textKey);
    existing.add(lookupKey);
    synthetic.push({
      id: code,
      code,
      costType: null,
      description: "",
      fullLabel: code,
    });
  }
  return synthetic;
}
