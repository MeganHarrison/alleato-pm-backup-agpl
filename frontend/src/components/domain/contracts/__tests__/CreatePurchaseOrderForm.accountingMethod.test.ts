import { getInitialPurchaseOrderAccountingMethod } from "../CreatePurchaseOrderForm";

describe("getInitialPurchaseOrderAccountingMethod", () => {
  it("defaults new purchase orders to amount-based accounting", () => {
    expect(getInitialPurchaseOrderAccountingMethod(undefined)).toBe("amount");
  });

  it("preserves persisted unit-quantity accounting when editing", () => {
    expect(getInitialPurchaseOrderAccountingMethod("unit-quantity")).toBe("unit-quantity");
  });

  it("preserves persisted amount accounting when editing", () => {
    expect(getInitialPurchaseOrderAccountingMethod("amount")).toBe("amount");
  });
});
