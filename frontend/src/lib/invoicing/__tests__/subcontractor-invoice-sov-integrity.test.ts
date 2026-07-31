import {
  enrichInvoiceScheduleLines,
  type InvoiceScheduleLine,
} from "../subcontractor-invoice-sov-integrity";

describe("subcontractor invoice SOV integrity", () => {
  it("never invents a change order from a stale base schedule value", () => {
    const lines: InvoiceScheduleLine[] = [
      {
        scheduled_value: 21_000,
        sort_order: 1,
        line_item_type: "SOV",
        commitment_value: null,
        change_value: null,
      },
    ];

    expect(
      enrichInvoiceScheduleLines(lines, [
        {
          id: "sov-1",
          sort_order: 1,
          amount: 15_200,
          budget_code: "02-4119.S",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        commitment_value: 15_200,
        change_value: 0,
        scheduled_value: 21_000,
      }),
    ]);
  });

  it("uses stored approved change-order values only on linked change lines", () => {
    expect(
      enrichInvoiceScheduleLines(
        [
          {
            source_change_order_id: "co-1",
            scheduled_value: 5_800,
            sort_order: 2,
            line_item_type: "Change Order",
            commitment_value: 0,
            change_value: 5_800,
          },
        ],
        [],
      ),
    ).toEqual([
      expect.objectContaining({
        commitment_value: 0,
        change_value: 5_800,
      }),
    ]);
  });
});
