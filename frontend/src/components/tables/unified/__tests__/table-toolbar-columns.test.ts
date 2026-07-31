import {
  orderColumnsForToggle,
  reorderColumnIds,
  visibleColumnsInOrder,
  type ColumnConfig,
} from "../table-toolbar";

const columns: ColumnConfig[] = [
  { id: "number", label: "Number", alwaysVisible: true },
  { id: "company", label: "Company", defaultVisible: true },
  { id: "cost_code", label: "Cost Code", defaultVisible: false },
  { id: "amount", label: "Amount", defaultVisible: true },
];

describe("table toolbar column ordering", () => {
  it("orders dropdown rows by the current column order and keeps hidden columns available", () => {
    expect(
      orderColumnsForToggle(
        columns,
        ["company", "number"],
        ["company", "number"],
      ).map((column) => column.id),
    ).toEqual(["company", "number", "cost_code", "amount"]);
  });

  it("moves a dragged column id within the ordered dropdown list", () => {
    expect(
      reorderColumnIds(
        ["number", "company", "cost_code", "amount"],
        "amount",
        "company",
      ),
    ).toEqual(["number", "amount", "company", "cost_code"]);
  });

  it("persists the visible subset in the reordered list order", () => {
    expect(
      visibleColumnsInOrder(
        ["number", "amount", "company", "cost_code"],
        ["number", "company", "amount"],
      ),
    ).toEqual(["number", "amount", "company"]);
  });
});
