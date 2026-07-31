import {
  reconcileSovBudgetCodes,
  synthesizeMissingBudgetCodes,
} from "../sovBudgetCodeReconciliation";
import type { BudgetCode } from "../types";
import type { SovLineItem } from "@/lib/schemas/create-subcontract-schema";

const code = (over: Partial<BudgetCode>): BudgetCode => ({
  id: "uuid-1",
  code: "01-100",
  costCodeId: "01-100",
  costType: "S",
  costTypeId: "cost-type-subcontract",
  description: "Sitework",
  fullLabel: "01-100.S",
  ...over,
});

const line = (over: Partial<SovLineItem>): SovLineItem =>
  ({
    description: "Line",
    amount: 0,
    billedToDate: 0,
    ...over,
  }) as SovLineItem;

describe("reconcileSovBudgetCodes", () => {
  it("matches stored code text against the dropdown's id", () => {
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "uuid-1" })];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(true);
    expect(result.lines[0]).toMatchObject({
      budgetCodeId: "uuid-1",
      budgetCode: "01-100",
      budgetCodeLabel: "01-100.S",
    });
  });

  it("matches stored code text against the dropdown's code", () => {
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "01-100" })];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(true);
    expect(result.lines[0].budgetCodeId).toBe("uuid-1");
  });

  it("matches stored code text against the dropdown's fullLabel", () => {
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "01-100.S" })];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(true);
    expect(result.lines[0].budgetCodeId).toBe("uuid-1");
  });

  it("matches stored legacy cost-code text with different formatting", () => {
    const codes = [
      code({
        id: "uuid-1",
        code: "04-2200",
        costCodeId: "04-2200",
        description: "Concrete Unit Masonry-Block",
        fullLabel: "04-2200.S - Concrete Unit Masonry-Block",
      }),
    ];
    const lines = [line({ budgetCode: "042200" })];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(true);
    expect(result.lines[0]).toMatchObject({
      budgetCodeId: "uuid-1",
      budgetCode: "04-2200",
      budgetCodeLabel: "04-2200.S - Concrete Unit Masonry-Block",
    });
  });

  it("matches stored description text when the budget-code text was lost", () => {
    const codes = [
      code({
        id: "uuid-1",
        code: "04-2200",
        description: "Concrete Unit Masonry-Block",
        fullLabel: "04-2200.S - Concrete Unit Masonry-Block",
      }),
    ];
    const lines = [line({ budgetCode: "concrete unit masonry-block" })];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(true);
    expect(result.lines[0].budgetCodeId).toBe("uuid-1");
  });

  it("leaves a line unchanged when the stored code matches no dropdown option", () => {
    // Regression: this is the scenario the fk-audit flagged. A subcontract
    // SOV row stored "OBSOLETE-99" before that code was deleted from
    // project_budget_codes. The reconciliation MUST NOT clobber the stored
    // text; the synthesizer below is responsible for keeping the value
    // visible in the dropdown.
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "OBSOLETE-99" })];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(false);
    expect(result.lines[0].budgetCode).toBe("OBSOLETE-99");
    expect(result.lines[0].budgetCodeId).toBeUndefined();
  });

  it("preserves an already-resolved line that has both id and label", () => {
    const codes = [code({ id: "uuid-1" })];
    const lines = [
      line({
        budgetCode: "01-100",
        budgetCodeId: "uuid-1",
        budgetCodeLabel: "01-100.S",
      }),
    ];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(false);
    expect(result.lines).toBe(lines);
  });

  it("skips group rows", () => {
    const codes = [code({ id: "uuid-1", code: "01-100" })];
    const lines = [line({ isGroup: true, description: "Header", budgetCode: "01-100" })];
    const result = reconcileSovBudgetCodes(lines, codes);
    expect(result.changed).toBe(false);
  });

  it("returns unchanged when the budget code list is empty (still loading)", () => {
    const lines = [line({ budgetCode: "01-100" })];
    const result = reconcileSovBudgetCodes(lines, []);
    expect(result.changed).toBe(false);
    expect(result.lines).toBe(lines);
  });
});

describe("synthesizeMissingBudgetCodes", () => {
  it("returns a synthetic option for a stale stored code so the dropdown can display it", () => {
    // Regression: protects against the empty-dropdown-on-edit bug for
    // subcontracts whose stored budget_code text no longer exists in
    // project_budget_codes.
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "OBSOLETE-99" })];
    const synthetic = synthesizeMissingBudgetCodes(lines, codes);
    expect(synthetic).toHaveLength(1);
    expect(synthetic[0]).toMatchObject({
      id: "OBSOLETE-99",
      code: "OBSOLETE-99",
      fullLabel: "OBSOLETE-99",
    });
  });

  it("does not synthesize when the stored code already matches an existing option's id", () => {
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "uuid-1" })];
    expect(synthesizeMissingBudgetCodes(lines, codes)).toHaveLength(0);
  });

  it("does not synthesize when the stored code already matches an existing option's code", () => {
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "01-100" })];
    expect(synthesizeMissingBudgetCodes(lines, codes)).toHaveLength(0);
  });

  it("does not synthesize when the stored code already matches an existing option's fullLabel", () => {
    const codes = [code({ id: "uuid-1", code: "01-100", fullLabel: "01-100.S" })];
    const lines = [line({ budgetCode: "01-100.S" })];
    expect(synthesizeMissingBudgetCodes(lines, codes)).toHaveLength(0);
  });

  it("does not synthesize when the stored code is a formatting variant of an existing option", () => {
    const codes = [code({ id: "uuid-1", code: "04-2200", costCodeId: "04-2200" })];
    const lines = [line({ budgetCode: "04 2200" })];
    expect(synthesizeMissingBudgetCodes(lines, codes)).toHaveLength(0);
  });

  it("deduplicates a stale code that appears across multiple SOV lines", () => {
    const codes: BudgetCode[] = [];
    const lines = [
      line({ budgetCode: "OBSOLETE-99" }),
      line({ budgetCode: "OBSOLETE-99" }),
    ];
    expect(synthesizeMissingBudgetCodes(lines, codes)).toHaveLength(1);
  });

  it("ignores group rows", () => {
    const lines = [
      line({ isGroup: true, description: "Header", budgetCode: "OBSOLETE-99" }),
    ];
    expect(synthesizeMissingBudgetCodes(lines, [])).toHaveLength(0);
  });

  it("ignores empty/null stored codes", () => {
    const lines = [
      line({ budgetCode: "" }),
      line({ budgetCode: undefined as unknown as string }),
    ];
    expect(synthesizeMissingBudgetCodes(lines, [])).toHaveLength(0);
  });
});
