export interface InvoiceScheduleLine extends Record<string, unknown> {
  source_sov_item_id?: string | null;
  source_change_order_id?: string | null;
  scheduled_value: number;
  sort_order: number;
  line_item_type?: string | null;
  commitment_value?: number | null;
  change_value?: number | null;
}

export interface CommitmentSovSource {
  id: string;
  sort_order: number;
  amount: number | null;
  budget_code?: string | null;
}

/**
 * Presentation values must describe persisted sources. An unexplained
 * difference between a stale invoice snapshot and the current commitment is
 * never an approved change order.
 */
export function enrichInvoiceScheduleLines<
  TLine extends InvoiceScheduleLine,
  TSov extends CommitmentSovSource,
>(lineItems: TLine[], sovItems: TSov[]): Array<TLine & {
  commitment_value: number | null;
  change_value: number | null;
}> {
  const sovById = new Map(sovItems.map((item) => [item.id, item]));
  const sovBySort = new Map(sovItems.map((item) => [item.sort_order, item]));

  return lineItems.map((line) => {
    const isChangeOrderLine =
      Boolean(line.source_change_order_id) ||
      (line.line_item_type?.toLowerCase().includes("change") ?? false);
    const sovMatch =
      (line.source_sov_item_id
        ? sovById.get(line.source_sov_item_id)
        : undefined) ?? sovBySort.get(Number(line.sort_order) || 0);

    if (isChangeOrderLine) {
      return {
        ...line,
        commitment_value: 0,
        change_value:
          Number(line.change_value ?? line.scheduled_value) || 0,
      };
    }

    return {
      ...line,
      commitment_value: sovMatch ? Number(sovMatch.amount) || 0 : null,
      change_value: 0,
    };
  });
}
