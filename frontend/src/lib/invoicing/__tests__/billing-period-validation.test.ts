import { validateBillingPeriodDraft } from "../billing-period-validation";

describe("billing-period-validation", () => {
  it("requires due date", () => {
    expect(
      validateBillingPeriodDraft({
        start_date: "2026-06-01",
        end_date: "2026-06-30",
        due_date: undefined,
      }),
    ).toBe("Billing period due date is required.");
  });

  it("rejects end dates before start dates", () => {
    expect(
      validateBillingPeriodDraft({
        start_date: "2026-06-30",
        end_date: "2026-06-01",
        due_date: "2026-07-05",
      }),
    ).toBe("Billing period end date must be on or after the start date.");
  });
  it("accepts a complete unique-range candidate even when another period is open", () => {
    expect(
      validateBillingPeriodDraft({
        start_date: "2026-07-01",
        end_date: "2026-07-31",
        due_date: "2026-08-05",
      }),
    ).toBeNull();
  });
});
