import { getCostTypeLabel } from "@/constants/budget";
import type { BudgetCode, ContractLineItem } from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";

function normalizeLookup(value: string | null | undefined) {
  return (value || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normalizeDescription(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export interface BudgetCodeResolution {
  budgetCode?: BudgetCode;
  budgetCodeId: string;
  displayCode: string;
  displayDescription: string;
  displayCostType: string;
  isMapped: boolean;
}

export function resolveContractLineBudgetCode(
  item: Pick<ContractLineItem, "budget_code_id" | "cost_code_id" | "cost_code" | "description">,
  budgetCodes: BudgetCode[],
): BudgetCodeResolution {
  const directMatch = item.budget_code_id
    ? budgetCodes.find((code) => code.id === item.budget_code_id)
    : undefined;

  const costCodeCandidates = [
    item.cost_code_id,
    item.cost_code?.id,
    item.cost_code?.code,
  ];
  const normalizedCostCodeCandidates = new Set(
    costCodeCandidates.map(normalizeLookup).filter(Boolean),
  );

  const costCodeMatch =
    directMatch ||
    budgetCodes.find((code) => {
      const normalizedCostCodeId = normalizeLookup(code.costCodeId);
      const normalizedCode = normalizeLookup(code.code);
      return (
        normalizedCostCodeCandidates.has(normalizedCostCodeId) ||
        normalizedCostCodeCandidates.has(normalizedCode)
      );
    });

  const descriptionMatch =
    costCodeMatch ||
    budgetCodes.find(
      (code) =>
        normalizeDescription(code.description) !== "" &&
        normalizeDescription(code.description) === normalizeDescription(item.description),
    );

  const budgetCode = descriptionMatch;
  const displayCode =
    budgetCode?.code ||
    item.cost_code?.code ||
    item.cost_code_id ||
    "Unmapped";
  const displayDescription =
    budgetCode?.description ||
    item.cost_code?.name ||
    (!budgetCode ? "Budget code not linked" : "");
  const displayCostType = budgetCode?.costType
    ? getCostTypeLabel(budgetCode.costType)
    : "";

  return {
    budgetCode,
    budgetCodeId: budgetCode?.id || "",
    displayCode,
    displayDescription,
    displayCostType,
    isMapped: Boolean(budgetCode || item.cost_code_id || item.cost_code?.code),
  };
}

export function resolveBudgetCodeIdForLineItem(
  item: Pick<ContractLineItem, "budget_code_id" | "cost_code_id" | "cost_code" | "description">,
  budgetCodes: BudgetCode[],
) {
  return resolveContractLineBudgetCode(item, budgetCodes).budgetCodeId;
}
