import {
  resolveBudgetCodeIdForLineItem,
  resolveContractLineBudgetCode,
} from "../budget-code-resolution";
import type { BudgetCode, ContractLineItem } from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";

const budgetCodes: BudgetCode[] = [
  {
    id: "budget-code-042200-subcontract",
    code: "04-2200",
    costCodeId: "04-2200",
    description: "Concrete Unit Masonry-Block",
    costType: "S",
    costTypeId: "cost-type-subcontract",
    fullLabel: "04-2200.S - Concrete Unit Masonry-Block",
  },
  {
    id: "budget-code-013126-subcontract",
    code: "01-3126",
    costCodeId: "01-3126",
    description: "Project Management",
    costType: "S",
    costTypeId: "cost-type-subcontract",
    fullLabel: "01-3126.S - Project Management",
  },
];

function lineItem(overrides: Partial<ContractLineItem>): ContractLineItem {
  return {
    id: "line-1",
    contract_id: "contract-1",
    line_number: 1,
    description: "Concrete Unit Masonry-Block",
    cost_code_id: null,
    budget_code_id: null,
    quantity: 1,
    unit_of_measure: null,
    unit_cost: 100,
    total_cost: 100,
    created_at: "2026-06-15T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("prime contract budget-code resolution", () => {
  it("resolves undashed legacy cost codes against dashed project budget codes", () => {
    const resolution = resolveContractLineBudgetCode(
      lineItem({
        description: "Imported masonry row",
        cost_code_id: "042200",
      }),
      budgetCodes,
    );

    expect(resolution.budgetCodeId).toBe("budget-code-042200-subcontract");
    expect(resolution.displayCode).toBe("04-2200");
    expect(resolution.displayDescription).toBe("Concrete Unit Masonry-Block");
    expect(resolution.displayCostType).toBe("Subcontract");
  });

  it("resolves null budget_code_id rows by exact SOV description", () => {
    const resolution = resolveContractLineBudgetCode(
      lineItem({
        budget_code_id: null,
        cost_code_id: null,
        cost_code: undefined,
      }),
      budgetCodes,
    );

    expect(resolution.budgetCodeId).toBe("budget-code-042200-subcontract");
    expect(resolveBudgetCodeIdForLineItem(lineItem({ cost_code_id: "04.2200" }), budgetCodes)).toBe(
      "budget-code-042200-subcontract",
    );
  });

  it("fails loudly for truly unmapped rows instead of rendering placeholder dashes", () => {
    const resolution = resolveContractLineBudgetCode(
      lineItem({
        description: "Unlisted scope",
        cost_code_id: null,
        cost_code: undefined,
      }),
      budgetCodes,
    );

    expect(resolution.budgetCodeId).toBe("");
    expect(resolution.displayCode).toBe("Unmapped");
    expect(resolution.displayDescription).toBe("Budget code not linked");
    expect(resolution.displayCostType).toBe("");
  });
});
