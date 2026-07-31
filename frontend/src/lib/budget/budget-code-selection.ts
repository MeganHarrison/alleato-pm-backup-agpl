import type { BudgetCodeOption } from "@/components/domain/change-events/change-event-form/types";
import { findBudgetCode } from "@/lib/change-events/budget-code-match";

export interface PrimeCoBudgetCodeResolution {
  selectorValue: string;
  displayCode: string;
  displayLabel: string;
  storedCode: string | null;
  isMapped: boolean;
}

export function budgetCodeTextValue(
  code: Pick<BudgetCodeOption, "code" | "costType">,
): string {
  return code.costType ? `${code.code}.${code.costType}` : code.code;
}

export function resolvePrimeCoBudgetCode(
  costCode: string | null | undefined,
  budgetCodes: BudgetCodeOption[],
): PrimeCoBudgetCodeResolution {
  const trimmed = costCode?.trim() || "";
  const match = findBudgetCode(trimmed, budgetCodes);

  if (match) {
    return {
      selectorValue: match.id,
      displayCode: match.code,
      displayLabel: match.fullLabel,
      storedCode: budgetCodeTextValue(match),
      isMapped: true,
    };
  }

  return {
    selectorValue: "",
    displayCode: trimmed || "Unmapped",
    displayLabel: trimmed
      ? `Unmapped budget code: ${trimmed}`
      : "No budget code selected",
    storedCode: trimmed || null,
    isMapped: false,
  };
}

export function normalizeBudgetCodesForSelector(
  codes: Array<Partial<BudgetCodeOption> & { id: string; code: string }>,
): BudgetCodeOption[] {
  return codes.map((code) => ({
    id: code.id,
    code: code.code,
    costCodeId: code.costCodeId || null,
    description: code.description || "",
    costType: code.costType || null,
    costTypeId: code.costTypeId || null,
    fullLabel:
      code.fullLabel ||
      `${code.code}${code.description ? ` - ${code.description}` : ""}`,
  }));
}

export function resolveBudgetCodeByCostFields(
  costCodeId: string | null | undefined,
  costTypeId: string | null | undefined,
  budgetCodes: BudgetCodeOption[],
): BudgetCodeOption | undefined {
  if (!costCodeId) return undefined;

  const exact = budgetCodes.find(
    (code) => code.code === costCodeId && code.costTypeId === costTypeId,
  );
  if (exact) return exact;

  return findBudgetCode(costCodeId, budgetCodes);
}

export function resolveBudgetCodeByCodeAndCostType(
  costCode: string | null | undefined,
  costType: string | null | undefined,
  budgetCodes: BudgetCodeOption[],
): BudgetCodeOption | undefined {
  if (!costCode) return undefined;

  if (costType) {
    const typedBudgetCodes = budgetCodes.filter(
      (code) => code.costType === costType || code.costTypeId === costType,
    );
    const typedMatch = findBudgetCode(costCode, typedBudgetCodes);
    if (typedMatch) return typedMatch;
  }

  return findBudgetCode(costCode, budgetCodes);
}
