import {
  formatBudgetChangeLineLabel,
  getBudgetChangeSearchText,
  getBudgetChangeStatusOptions,
  getBudgetChangeTransferAmount,
  getBulkActionSelectionCounts,
  type BudgetChangeRecord,
} from "../budget-changes-utils";

function makeChange(
  overrides: Partial<BudgetChangeRecord>,
): BudgetChangeRecord {
  return {
    id: "mod-1",
    number: "BM-0001",
    title: "Budget Transfer",
    reason: "Move funds to cover field work",
    amount: 0,
    status: "draft",
    effectiveDate: null,
    createdAt: "2026-07-03T12:00:00.000Z",
    updatedAt: "2026-07-03T12:00:00.000Z",
    createdBy: null,
    editableStatuses: ["draft", "pending"],
    allowedActions: ["submit"],
    canDelete: true,
    lines: [
      {
        id: "line-1",
        costCodeId: "01-3120",
        costTypeId: "labor",
        costTypeCode: "L",
        subJobId: null,
        amount: -123,
        description: "Reduce VP line",
        costCodeTitle: "Vice President",
      },
      {
        id: "line-2",
        costCodeId: "01-3126",
        costTypeId: "labor",
        costTypeCode: "L",
        subJobId: null,
        amount: 123,
        description: "Increase pre-construction",
        costCodeTitle: "Pre-construction",
      },
    ],
    ...overrides,
  };
}

describe("budget changes utils", () => {
  it("returns the allowed inline status options for draft and pending changes", () => {
    expect(getBudgetChangeStatusOptions("draft", ["draft", "pending"])).toEqual([
      { value: "draft", label: "Draft" },
      {
        value: "pending",
        label: "Submit for approval",
        action: "submit",
      },
    ]);

    expect(
      getBudgetChangeStatusOptions("pending", ["pending", "approved", "draft"]),
    ).toEqual([
      { value: "pending", label: "Pending approval" },
      { value: "approved", label: "Approve", action: "approve" },
      { value: "draft", label: "Return to draft", action: "reject" },
    ]);
  });

  it("builds searchable text from modification and line details", () => {
    const searchText = getBudgetChangeSearchText(makeChange({}));
    expect(searchText).toContain("bm-0001");
    expect(searchText).toContain("vice president");
    expect(searchText).toContain("move funds to cover field work");
  });

  it("formats a line label with cost code, type, and title", () => {
    const change = makeChange({});
    expect(formatBudgetChangeLineLabel(change.lines[0])).toBe(
      "01-3120.L - Vice President",
    );
  });

  it("uses the moved amount instead of the net transfer total", () => {
    expect(getBudgetChangeTransferAmount(makeChange({ amount: 0 }))).toBe(123);
  });

  it("counts eligible bulk actions by selected row status", () => {
    const changes = [
      makeChange({
        id: "draft-1",
        status: "draft",
        editableStatuses: ["draft", "pending"],
        allowedActions: ["submit"],
      }),
      makeChange({
        id: "pending-1",
        status: "pending",
        editableStatuses: ["pending", "approved", "draft"],
        allowedActions: ["approve", "reject"],
      }),
      makeChange({
        id: "pending-2",
        status: "pending",
        editableStatuses: ["pending", "approved"],
        allowedActions: ["approve"],
      }),
      makeChange({
        id: "approved-1",
        status: "approved",
        editableStatuses: ["approved", "void"],
        allowedActions: ["void"],
      }),
    ];

    expect(
      getBulkActionSelectionCounts(changes, [
        "draft-1",
        "pending-1",
        "pending-2",
        "approved-1",
      ]),
    ).toEqual({
      submit: 1,
      approve: 2,
      reject: 1,
      void: 1,
    });
  });
});
