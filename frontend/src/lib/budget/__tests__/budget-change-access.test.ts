import {
  canDeleteBudgetChange,
  getBudgetChangeAllowedActions,
  getBudgetChangeSelectableStatuses,
} from "../budget-change-access";

describe("budget change access", () => {
  it("lets admins select any status from any current state", () => {
    expect(
      getBudgetChangeSelectableStatuses("approved", {
        isAdmin: true,
        canManageBudgetChanges: false,
        canApproveBudgetChanges: false,
      }),
    ).toEqual(["draft", "pending", "approved", "void"]);
  });

  it("limits non-admin draft changes to submit when they only have manage permission", () => {
    expect(
      getBudgetChangeSelectableStatuses("draft", {
        isAdmin: false,
        canManageBudgetChanges: true,
        canApproveBudgetChanges: false,
      }),
    ).toEqual(["draft", "pending"]);

    expect(
      getBudgetChangeAllowedActions("draft", {
        isAdmin: false,
        canManageBudgetChanges: true,
        canApproveBudgetChanges: false,
      }),
    ).toEqual(["submit"]);
  });

  it("allows non-admin approvers to approve and void but not delete approved changes", () => {
    expect(
      getBudgetChangeSelectableStatuses("approved", {
        isAdmin: false,
        canManageBudgetChanges: false,
        canApproveBudgetChanges: true,
      }),
    ).toEqual(["approved", "void"]);

    expect(
      getBudgetChangeAllowedActions("approved", {
        isAdmin: false,
        canManageBudgetChanges: false,
        canApproveBudgetChanges: true,
      }),
    ).toEqual(["void"]);

    expect(
      canDeleteBudgetChange("approved", {
        isAdmin: false,
        canManageBudgetChanges: true,
        canApproveBudgetChanges: true,
      }),
    ).toBe(false);
  });
});
