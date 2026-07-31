import {
  budgetCodeTextValue,
  normalizeBudgetCodesForSelector,
  resolveBudgetCodeByCodeAndCostType,
  resolveBudgetCodeByCostFields,
  resolvePrimeCoBudgetCode,
} from "@/lib/budget/budget-code-selection";
import type { BudgetCodeOption } from "@/components/domain/change-events/change-event-form/types";

const budgetCodes: BudgetCodeOption[] = [
  {
    id: "project-budget-code-042200",
    code: "04-2200",
    costCodeId: "04-2200",
    description: "Concrete Unit Masonry-Block",
    costType: "S",
    costTypeId: "cost-type-subcontract",
    fullLabel: "04-2200.S - Concrete Unit Masonry-Block",
  },
  {
    id: "project-budget-code-042200-material",
    code: "04-2200",
    costCodeId: "04-2200",
    description: "Concrete Unit Masonry-Block",
    costType: "M",
    costTypeId: "cost-type-material",
    fullLabel: "04-2200.M - Concrete Unit Masonry-Block",
  },
  {
    id: "project-budget-code-013126",
    code: "01-3126",
    costCodeId: "01-3126",
    description: "Project Management",
    costType: "S",
    costTypeId: "cost-type-subcontract",
    fullLabel: "01-3126.S - Project Management",
  },
];

describe("budget-code selection", () => {
  it("maps stored legacy text to the selector value and canonical stored code", () => {
    expect(resolvePrimeCoBudgetCode("042200", budgetCodes)).toEqual({
      selectorValue: "project-budget-code-042200",
      displayCode: "04-2200",
      displayLabel: "04-2200.S - Concrete Unit Masonry-Block",
      storedCode: "04-2200.S",
      isMapped: true,
    });
  });

  it("stores typed text for legacy text-backed SOV columns", () => {
    expect(budgetCodeTextValue(budgetCodes[0])).toBe("04-2200.S");
  });

  it("keeps an unmapped value visible and marked as unmapped", () => {
    expect(resolvePrimeCoBudgetCode("99-9999", budgetCodes)).toEqual({
      selectorValue: "",
      displayCode: "99-9999",
      displayLabel: "Unmapped budget code: 99-9999",
      storedCode: "99-9999",
      isMapped: false,
    });
  });

  it("fails loudly for blank values instead of rendering a placeholder dash", () => {
    expect(resolvePrimeCoBudgetCode(null, budgetCodes)).toEqual({
      selectorValue: "",
      displayCode: "Unmapped",
      displayLabel: "No budget code selected",
      storedCode: null,
      isMapped: false,
    });
  });

  it("normalizes API payloads for the shared selector", () => {
    expect(
      normalizeBudgetCodesForSelector([
        {
          id: "project-budget-code-013126",
          code: "01-3126",
          description: "Project Management",
        },
      ]),
    ).toEqual([
      {
        id: "project-budget-code-013126",
        code: "01-3126",
        costCodeId: null,
        description: "Project Management",
        costType: null,
        costTypeId: null,
        fullLabel: "01-3126 - Project Management",
      },
    ]);
  });

  it("resolves split commitment change-order cost fields to one project budget code", () => {
    expect(
      resolveBudgetCodeByCostFields(
        "04-2200",
        "cost-type-subcontract",
        budgetCodes,
      )?.id,
    ).toBe("project-budget-code-042200");
  });

  it("prefers cost-type-specific matches for estimate import rows", () => {
    expect(
      resolveBudgetCodeByCodeAndCostType("042200", "M", budgetCodes)?.id,
    ).toBe("project-budget-code-042200-material");
  });
});
