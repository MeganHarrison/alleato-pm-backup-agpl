import {
  BudgetLineItemsPayloadSchema,
  BudgetModificationPayloadSchema,
} from "@/lib/schemas/budget";

const FROM_LINE_ID = "11111111-1111-4111-8111-111111111111";
const TO_LINE_ID = "22222222-2222-4222-8222-222222222222";

describe("BudgetModificationPayloadSchema", () => {
  it("accepts locked-budget transfer lines without a single budgetItemId", () => {
    const result = BudgetModificationPayloadSchema.safeParse({
      title: "Budget Transfer",
      transferLines: [
        {
          fromBudgetLineId: FROM_LINE_ID,
          toBudgetLineId: TO_LINE_ID,
          amount: "2000.00",
          notes: "Move allowance to project management",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects transfers that move money from and to the same line item", () => {
    const result = BudgetModificationPayloadSchema.safeParse({
      title: "Budget Transfer",
      transferLines: [
        {
          fromBudgetLineId: FROM_LINE_ID,
          toBudgetLineId: FROM_LINE_ID,
          amount: "2000.00",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("BudgetLineItemsPayloadSchema", () => {
  const baseLineItem = {
    costCodeId: "10-2813",
    costType: "X",
    amount: "0",
    description: "Toilet Accessories - Expense",
  };

  it("rejects accidental zero-dollar budget lines", () => {
    const result = BudgetLineItemsPayloadSchema.safeParse({
      lineItems: [baseLineItem],
    });

    expect(result.success).toBe(false);
  });

  it("accepts explicit zero-dollar budget lines for migration parity setup", () => {
    const result = BudgetLineItemsPayloadSchema.safeParse({
      lineItems: [
        {
          ...baseLineItem,
          allowZeroAmount: true,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
