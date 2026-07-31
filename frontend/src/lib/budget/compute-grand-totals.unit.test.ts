import {
  aggregateApprovedBudgetModificationTotals,
  buildBudgetLineRollupKey,
  EMPTY_GRAND_TOTALS,
  consumeCostAggregationOnce,
  extractBudgetLineEditFields,
  mergeBudgetRowsWithEditableFields,
  normalizeBudgetCode,
  normalizeBudgetCodeLookupKey,
  reduceGrandTotals,
  resolveBudgetModificationTotal,
  resolveSovBudgetCodeToCostCodeId,
  type BudgetLineItem,
  type GrandTotals,
} from "./compute-grand-totals";

function makeLine(overrides: Partial<BudgetLineItem>): BudgetLineItem {
  return {
    id: "line-1",
    description: "Test line",
    costCode: "01-100",
    costCodeDescription: "General Conditions",
    costType: "L",
    division: "01",
    divisionTitle: "",
    subJob: "",
    originalBudgetAmount: 0,
    budgetModifications: 0,
    approvedCOs: 0,
    revisedBudget: 0,
    jobToDateCostDetail: 0,
    directCosts: 0,
    pendingChanges: 0,
    projectedBudget: 0,
    committedCosts: 0,
    pendingCostChanges: 0,
    projectedCosts: 0,
    forecastToComplete: 0,
    estimatedCostAtCompletion: 0,
    projectedOverUnder: 0,
    ...overrides,
  };
}

describe("normalizeBudgetCode", () => {
  it("returns the code unchanged when there is no dot", () => {
    expect(normalizeBudgetCode("03 00 00")).toBe("03 00 00");
  });

  it("strips the cost-type suffix added by the import route", () => {
    expect(normalizeBudgetCode("03 00 00.L")).toBe("03 00 00");
    expect(normalizeBudgetCode("01 00 00.M")).toBe("01 00 00");
    expect(normalizeBudgetCode("16 00 00.E")).toBe("16 00 00");
  });

  it("trims whitespace from the result", () => {
    expect(normalizeBudgetCode("03 00 00 .L")).toBe("03 00 00");
  });

  it("handles codes that are only a suffix (edge case)", () => {
    expect(normalizeBudgetCode(".L")).toBe("");
  });
});

describe("normalizeBudgetCodeLookupKey", () => {
  it("matches formatted Alleato budget codes to unformatted imported commitment codes", () => {
    expect(normalizeBudgetCodeLookupKey("09-9723")).toBe("099723");
    expect(normalizeBudgetCodeLookupKey("099723")).toBe("099723");
  });

  it("ignores cost-type suffixes while building comparison keys", () => {
    expect(normalizeBudgetCodeLookupKey("03 00 00.L")).toBe("030000");
    expect(normalizeBudgetCodeLookupKey("03-00-00")).toBe("030000");
  });
});

describe("resolveSovBudgetCodeToCostCodeId", () => {
  const pccToCostCodeId = {
    "project-budget-code-1": "04-2200",
    "legacy-project-budget-code": "01-3126",
  };
  const costCodeIdByLookupKey = new Map([
    ["099723", "09-9723"],
    ["033000", "03-3000"],
  ]);

  it("prefers project_budget_code_id over stale legacy text", () => {
    expect(
      resolveSovBudgetCodeToCostCodeId({
        projectBudgetCodeId: "project-budget-code-1",
        budgetCode: "99-9999",
        pccToCostCodeId,
        costCodeIdByLookupKey,
      }),
    ).toBe("04-2200");
  });

  it("falls back to legacy project-budget-code IDs stored in budget_code", () => {
    expect(
      resolveSovBudgetCodeToCostCodeId({
        projectBudgetCodeId: null,
        budgetCode: "legacy-project-budget-code",
        pccToCostCodeId,
        costCodeIdByLookupKey,
      }),
    ).toBe("01-3126");
  });

  it("falls back to normalized text matching for legacy rows", () => {
    expect(
      resolveSovBudgetCodeToCostCodeId({
        projectBudgetCodeId: null,
        budgetCode: "099723",
        pccToCostCodeId,
        costCodeIdByLookupKey,
      }),
    ).toBe("09-9723");
  });

  it("returns null when neither FK nor text exists", () => {
    expect(
      resolveSovBudgetCodeToCostCodeId({
        projectBudgetCodeId: null,
        budgetCode: null,
        pccToCostCodeId,
        costCodeIdByLookupKey,
      }),
    ).toBeNull();
  });
});

describe("reduceGrandTotals", () => {
  it("returns all zeros for an empty line-item array", () => {
    expect(reduceGrandTotals([])).toEqual(EMPTY_GRAND_TOTALS);
  });

  it("sums every numeric field across multiple lines", () => {
    const lines: BudgetLineItem[] = [
      makeLine({
        originalBudgetAmount: 100,
        budgetModifications: 10,
        approvedCOs: 5,
        revisedBudget: 115,
        jobToDateCostDetail: 40,
        directCosts: 30,
        pendingChanges: 2,
        projectedBudget: 117,
        committedCosts: 60,
        pendingCostChanges: 3,
        projectedCosts: 93,
        forecastToComplete: 24,
        estimatedCostAtCompletion: 117,
        projectedOverUnder: 0,
      }),
      makeLine({
        originalBudgetAmount: 200,
        budgetModifications: 20,
        approvedCOs: 10,
        revisedBudget: 230,
        jobToDateCostDetail: 80,
        directCosts: 70,
        pendingChanges: 5,
        projectedBudget: 235,
        committedCosts: 120,
        pendingCostChanges: 7,
        projectedCosts: 197,
        forecastToComplete: 38,
        estimatedCostAtCompletion: 235,
        projectedOverUnder: 0,
      }),
    ];

    const totals = reduceGrandTotals(lines);

    const expected: GrandTotals = {
      originalBudgetAmount: 300,
      budgetModifications: 30,
      approvedCOs: 15,
      revisedBudget: 345,
      jobToDateCostDetail: 120,
      directCosts: 100,
      pendingChanges: 7,
      projectedBudget: 352,
      committedCosts: 180,
      pendingCostChanges: 10,
      projectedCosts: 290,
      forecastToComplete: 62,
      estimatedCostAtCompletion: 352,
      projectedOverUnder: 0,
    };

    expect(totals).toEqual(expected);
  });

  it("does not mutate the EMPTY_GRAND_TOTALS constant between calls", () => {
    const snapshot = { ...EMPTY_GRAND_TOTALS };
    reduceGrandTotals([makeLine({ revisedBudget: 999, projectedCosts: 500 })]);
    expect(EMPTY_GRAND_TOTALS).toEqual(snapshot);
  });

  it("handles a line that produces a projectedOverUnder", () => {
    const totals = reduceGrandTotals([
      makeLine({
        revisedBudget: 100,
        projectedBudget: 100,
        projectedCosts: 120,
        forecastToComplete: 0,
        estimatedCostAtCompletion: 120,
        projectedOverUnder: -20,
      }),
    ]);

    expect(totals.projectedOverUnder).toBe(-20);
    expect(totals.revisedBudget).toBe(100);
    expect(totals.projectedCosts).toBe(120);
  });
});

describe("consumeCostAggregationOnce", () => {
  it("returns cost-code rollups only once for duplicate budget rows", () => {
    const consumed = new Set<string>();
    const costsByCode = {
      "09-9123": {
        jobToDateCostDetail: 100,
        directCosts: 25,
        pendingCostChanges: 50,
        committedCosts: 200,
        approvedBudgetChanges: 10,
        pendingBudgetChanges: 5,
      },
    };

    expect(
      consumeCostAggregationOnce("09-9123", costsByCode, consumed),
    ).toEqual(costsByCode["09-9123"]);
    expect(
      consumeCostAggregationOnce("09-9123", costsByCode, consumed),
    ).toEqual({
      jobToDateCostDetail: 0,
      directCosts: 0,
      pendingCostChanges: 0,
      committedCosts: 0,
      approvedBudgetChanges: 0,
      pendingBudgetChanges: 0,
    });
  });
});

describe("aggregateApprovedBudgetModificationTotals", () => {
  it("keeps approved budget modification totals isolated by cost code, type, and sub job", () => {
    const totals = aggregateApprovedBudgetModificationTotals([
      {
        cost_code_id: "01-3120",
        cost_type_id: "type-a",
        sub_job_id: null,
        amount: -123.45,
      },
      {
        cost_code_id: "01-3120",
        cost_type_id: "type-a",
        sub_job_id: null,
        amount: 23.45,
      },
      {
        cost_code_id: "01-3120",
        cost_type_id: "type-b",
        sub_job_id: null,
        amount: 50,
      },
      {
        cost_code_id: "01-3120",
        cost_type_id: "type-a",
        sub_job_id: "sub-1",
        amount: 75,
      },
    ]);

    expect(
      totals.get(buildBudgetLineRollupKey("01-3120", "type-a", null)!),
    ).toBe(-100);
    expect(
      totals.get(buildBudgetLineRollupKey("01-3120", "type-b", null)!),
    ).toBe(50);
    expect(
      totals.get(buildBudgetLineRollupKey("01-3120", "type-a", "sub-1")!),
    ).toBe(75);
  });
});

describe("resolveBudgetModificationTotal", () => {
  it("prefers directly aggregated approved budget modification totals over a stale view value", () => {
    const key = buildBudgetLineRollupKey("01-3120", "type-a", null)!;
    const totals = new Map([[key, 123.45]]);

    expect(resolveBudgetModificationTotal(key, totals, 0)).toBe(123.45);
  });

  it("falls back to the view value when no direct approved budget modification total exists", () => {
    const totals = new Map<string, number>();

    expect(resolveBudgetModificationTotal("missing", totals, "45.67")).toBe(45.67);
  });
});

describe("extractBudgetLineEditFields", () => {
  it("preserves saved qty, unit cost, and UOM for edit-form prefill", () => {
    expect(
      extractBudgetLineEditFields({
        quantity: "3.0000",
        unit_of_measure: "ea",
        unit_cost: "3921.0000",
      }),
    ).toEqual({
      unitQty: 3,
      uom: "ea",
      unitCost: 3921,
    });
  });

  it("returns undefined fields when the raw budget row does not have edit metadata", () => {
    expect(extractBudgetLineEditFields({})).toEqual({
      unitQty: undefined,
      uom: undefined,
      unitCost: undefined,
    });
  });
});

describe("mergeBudgetRowsWithEditableFields", () => {
  it("hydrates view-backed budget rows with quantity, unit cost, and UOM from budget_lines", () => {
    expect(
      mergeBudgetRowsWithEditableFields(
        [
          { id: "line-1", description: "Line 1" },
          { id: "line-2", description: "Line 2" },
        ],
        [
          {
            id: "line-1",
            quantity: 3,
            unit_cost: 3921,
            unit_of_measure: "ea",
          },
        ],
      ),
    ).toEqual([
      {
        id: "line-1",
        description: "Line 1",
        quantity: 3,
        unit_cost: 3921,
        unit_of_measure: "ea",
      },
      {
        id: "line-2",
        description: "Line 2",
      },
    ]);
  });
});
