import {
  commitmentSovBudgetCodeDisplay,
  resolveCommitmentSovBudgetCodeFromLookup,
} from "../sov-budget-code-resolution.server";

const budgetCodes = [
  {
    id: "project-budget-code-1",
    cost_code_id: "04-2200",
    cost_type_id: "cost-type-1",
    cost_code_types: { code: "S", description: "Subcontract" },
  },
  {
    id: "project-budget-code-2",
    cost_code_id: "04-2200",
    cost_type_id: "cost-type-2",
    cost_code_types: { code: "M", description: "Material" },
  },
];

describe("commitment SOV budget-code resolution", () => {
  it("formats legacy display text from project budget code rows", () => {
    expect(commitmentSovBudgetCodeDisplay(budgetCodes[0])).toBe("04-2200.S");
  });

  it("uses an explicit project budget code id when supplied", () => {
    expect(
      resolveCommitmentSovBudgetCodeFromLookup({
        budgetCodes,
        lineNumber: 1,
        where: "test",
        submittedProjectBudgetCodeId: "project-budget-code-1",
      }),
    ).toEqual({
      projectBudgetCodeId: "project-budget-code-1",
      displayBudgetCode: "04-2200.S",
    });
  });

  it("resolves typed legacy text to exactly one project budget code", () => {
    expect(
      resolveCommitmentSovBudgetCodeFromLookup({
        budgetCodes,
        lineNumber: 1,
        where: "test",
        submittedBudgetCode: "04-2200.M",
      }),
    ).toEqual({
      projectBudgetCodeId: "project-budget-code-2",
      displayBudgetCode: "04-2200.M",
    });
  });

  it("rejects ambiguous cost-code-only text", () => {
    expect(() =>
      resolveCommitmentSovBudgetCodeFromLookup({
        budgetCodes,
        lineNumber: 1,
        where: "test",
        submittedBudgetCode: "04-2200",
      }),
    ).toThrow(
      'Line 1: budget code "04-2200" is ambiguous for this project. Select the specific budget code before saving.',
    );
  });

  it("rejects unresolved legacy text", () => {
    expect(() =>
      resolveCommitmentSovBudgetCodeFromLookup({
        budgetCodes,
        lineNumber: 2,
        where: "test",
        submittedBudgetCode: "99-9999",
      }),
    ).toThrow('Line 2: budget code "99-9999" is not active for this project.');
  });
});
