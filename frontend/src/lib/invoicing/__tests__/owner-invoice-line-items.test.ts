import {
  buildOwnerInvoiceLineItemSovFields,
  normalizeOwnerInvoiceLineItem,
  normalizeOwnerInvoiceLineItems,
} from "../owner-invoice-line-items";

const ZERO_SOV_IMPORTED_LINE = {
  id: 5989,
  invoice_id: 218,
  description: "4000",
  category: "4000",
  approved_amount: 12668.06,
  scheduled_value: 0,
  work_completed_previous: 0,
  work_completed_period: 0,
  materials_stored: 0,
  total_completed_stored: 0,
  work_completed_pct: 0,
  retainage_amount: 0,
  retainage_released: 0,
  net_amount_this_period: 0,
  balance_to_finish: 0,
};

describe("owner invoice line item normalization", () => {
  it("maps legacy Acumatica approved amounts into SOV display fields", () => {
    const normalized = normalizeOwnerInvoiceLineItem(ZERO_SOV_IMPORTED_LINE);

    expect(normalized.scheduled_value).toBe(12668.06);
    expect(normalized.work_completed_period).toBe(12668.06);
    expect(normalized.total_completed_stored).toBe(12668.06);
    expect(normalized.net_amount_this_period).toBe(12668.06);
    expect(normalized.balance_to_finish).toBe(0);
    expect(normalized.work_completed_pct).toBe(100);
  });

  it("does not overwrite real SOV progress fields", () => {
    const normalized = normalizeOwnerInvoiceLineItem({
      ...ZERO_SOV_IMPORTED_LINE,
      scheduled_value: 20000,
      work_completed_previous: 5000,
      work_completed_period: 7000,
      total_completed_stored: 12000,
      net_amount_this_period: 7000,
      balance_to_finish: 8000,
      work_completed_pct: 60,
    });

    expect(normalized.scheduled_value).toBe(20000);
    expect(normalized.work_completed_previous).toBe(5000);
    expect(normalized.work_completed_period).toBe(7000);
    expect(normalized.net_amount_this_period).toBe(7000);
  });

  it("normalizes arrays and handles empty inputs", () => {
    expect(normalizeOwnerInvoiceLineItems(null)).toEqual([]);
    expect(normalizeOwnerInvoiceLineItems([ZERO_SOV_IMPORTED_LINE])).toEqual([
      expect.objectContaining({ scheduled_value: 12668.06 }),
    ]);
  });

  it("builds SOV insert fields from approved amount for future imports", () => {
    expect(buildOwnerInvoiceLineItemSovFields(400)).toEqual({
      scheduled_value: 400,
      work_completed_previous: 0,
      work_completed_period: 400,
      materials_stored: 0,
      total_completed_stored: 400,
      work_completed_pct: 100,
      retainage_amount: 0,
      retainage_released: 0,
      net_amount_this_period: 400,
      balance_to_finish: 0,
    });
  });
});
