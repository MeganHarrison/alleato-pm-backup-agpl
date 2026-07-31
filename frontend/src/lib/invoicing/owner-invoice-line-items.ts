export interface OwnerInvoiceLineItemDisplayFields {
  approved_amount: number | null;
  scheduled_value: number | null;
  work_completed_previous: number | null;
  work_completed_period: number | null;
  materials_stored: number | null;
  total_completed_stored: number | null;
  work_completed_pct: number | null;
  retainage_amount: number | null;
  retainage_released: number | null;
  net_amount_this_period: number | null;
  balance_to_finish: number | null;
}

function asNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasNoSovProgressFields(lineItem: OwnerInvoiceLineItemDisplayFields): boolean {
  return (
    asNumber(lineItem.scheduled_value) === 0 &&
    asNumber(lineItem.work_completed_previous) === 0 &&
    asNumber(lineItem.work_completed_period) === 0 &&
    asNumber(lineItem.materials_stored) === 0 &&
    asNumber(lineItem.total_completed_stored) === 0 &&
    asNumber(lineItem.net_amount_this_period) === 0 &&
    asNumber(lineItem.balance_to_finish) === 0
  );
}

export function buildOwnerInvoiceLineItemSovFields(
  approvedAmount: number | null | undefined,
) {
  const amount = asNumber(approvedAmount);
  return {
    scheduled_value: amount,
    work_completed_previous: 0,
    work_completed_period: amount,
    materials_stored: 0,
    total_completed_stored: amount,
    work_completed_pct: amount > 0 ? 100 : 0,
    retainage_amount: 0,
    retainage_released: 0,
    net_amount_this_period: amount,
    balance_to_finish: 0,
  };
}

export function normalizeOwnerInvoiceLineItem<T extends OwnerInvoiceLineItemDisplayFields>(
  lineItem: T,
): T {
  const approvedAmount = asNumber(lineItem.approved_amount);
  if (approvedAmount <= 0 || !hasNoSovProgressFields(lineItem)) {
    return lineItem;
  }

  return {
    ...lineItem,
    ...buildOwnerInvoiceLineItemSovFields(approvedAmount),
  };
}

export function normalizeOwnerInvoiceLineItems<T extends OwnerInvoiceLineItemDisplayFields>(
  lineItems: T[] | null | undefined,
): T[] {
  return (lineItems ?? []).map(normalizeOwnerInvoiceLineItem);
}
