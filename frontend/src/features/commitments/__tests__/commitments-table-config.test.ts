import * as React from "react";

import {
  buildCommitmentTableColumns,
  commitmentColumns,
  commitmentDefaultVisibleColumns,
} from "../commitments-table-config";
import type { CommitmentListItem } from "@/lib/validation/commitments";

describe("commitments table configuration", () => {
  it("keeps secondary metadata columns hidden by default", () => {
    const hiddenByDefault = [
      "cost_codes",
      "trade_names",
      "scope_summary",
      "type",
      "is_private",
      "erp_status",
    ];

    expect(commitmentDefaultVisibleColumns).not.toEqual(
      expect.arrayContaining(hiddenByDefault),
    );

    for (const columnId of hiddenByDefault) {
      expect(
        commitmentColumns.find((column) => column.id === columnId),
      ).toMatchObject({
        defaultVisible: false,
      });
    }
  });

  it("keeps creation metadata visible by default", () => {
    expect(commitmentDefaultVisibleColumns).toEqual(
      expect.arrayContaining(["created_at", "created_by_name"]),
    );
  });

  it("left-aligns cost codes because they are identifiers, not amounts", () => {
    expect(
      buildCommitmentTableColumns("25125").find(
        (column) => column.id === "cost_codes",
      ),
    ).toMatchObject({
      align: "left",
    });
  });

  it("right-aligns every currency column", () => {
    const columns = buildCommitmentTableColumns("25125");

    for (const columnId of [
      "original_amount",
      "approved_change_orders",
      "revised_contract_amount",
      "pending_change_orders",
      "draft_change_orders",
      "invoiced_amount",
      "payments_issued",
      "remaining_balance",
    ]) {
      expect(columns.find((column) => column.id === columnId)).toMatchObject({
        align: "right",
      });
    }
  });

  it("keeps the commitment money columns in the requested scan order after original amount", () => {
    const columnIds = commitmentColumns.map((column) => column.id);
    const originalAmountIndex = columnIds.indexOf("original_amount");

    expect(
      columnIds.slice(originalAmountIndex + 1, originalAmountIndex + 10),
    ).toEqual([
      "approved_change_orders",
      "revised_contract_amount",
      "pending_change_orders",
      "draft_change_orders",
      "invoiced_amount",
      "payments_issued",
      "percent_paid",
      "remaining_balance",
      "is_private",
    ]);

    expect(
      commitmentColumns
        .filter((column) =>
          [
            "revised_contract_amount",
            "draft_change_orders",
            "invoiced_amount",
            "payments_issued",
            "percent_paid",
            "remaining_balance",
          ].includes(column.id),
        )
        .map((column) => [column.id, column.label]),
    ).toEqual([
      ["revised_contract_amount", "Revised Contract Amount"],
      ["draft_change_orders", "Draft COs"],
      ["invoiced_amount", "Invoiced"],
      ["payments_issued", "Payments Issued"],
      ["percent_paid", "% Paid"],
      ["remaining_balance", "Remaining Balance"],
    ]);
  });

  it("renders title cells through the shared link primitive without injecting primary color", () => {
    const titleColumn = buildCommitmentTableColumns("25125").find(
      (column) => column.id === "title",
    );
    const rendered = titleColumn?.render({
      id: "commitment-1",
      title: "Ceiling Demo",
    } as CommitmentListItem);

    expect(rendered?.props.className).toContain("font-medium");
    expect(rendered?.props.className).not.toContain("text-primary");
    expect(rendered?.props.href).toBe("/25125/commitments/commitment-1");
  });

  it("hides the expand chevron when a commitment has no change orders", () => {
    const toggleExpand = jest.fn();
    const numberColumn = buildCommitmentTableColumns(
      "25125",
      new Set<string>(),
      toggleExpand,
    ).find((column) => column.id === "number");

    const rendered = numberColumn?.render({
      id: "commitment-1",
      number: "SC-1001",
      change_order_count: 0,
      approved_change_orders: 0,
      pending_change_orders: 0,
      draft_change_orders: 0,
    } as CommitmentListItem);

    expect(React.Children.toArray(rendered?.props.children)).toHaveLength(1);
  });

  it("shows the expand chevron when a commitment has change orders", () => {
    const toggleExpand = jest.fn();
    const numberColumn = buildCommitmentTableColumns(
      "25125",
      new Set<string>(),
      toggleExpand,
    ).find((column) => column.id === "number");

    const rendered = numberColumn?.render({
      id: "commitment-1",
      number: "SC-1001",
      change_order_count: 2,
      approved_change_orders: 0,
      pending_change_orders: 0,
      draft_change_orders: 0,
    } as CommitmentListItem);

    expect(React.Children.toArray(rendered?.props.children)).toHaveLength(2);
  });
});
