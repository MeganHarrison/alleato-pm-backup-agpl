import {
  calculateCompletionPercentFromCurrentAmount,
  calculateCurrentAmountFromCompletionPercent,
  validateCurrentAmount,
} from "../subcontractor-percent-autofill";

describe("subcontractor percent autofill", () => {
  it("derives current-period amount from a target completion percent", () => {
    expect(
      calculateCurrentAmountFromCompletionPercent({
        scheduledValue: 1000,
        previouslyBilled: 250,
        completionPercent: 60,
      }),
    ).toEqual({ amount: 350, error: null });
  });

  it("rejects target percentages below prior billing progress", () => {
    expect(
      calculateCurrentAmountFromCompletionPercent({
        scheduledValue: 1000,
        previouslyBilled: 400,
        completionPercent: 30,
      }),
    ).toEqual({
      amount: null,
      error: "Percent complete cannot be below the amount already billed.",
    });
  });

  it("derives displayed completion percent from a manual current-period amount", () => {
    expect(
      calculateCompletionPercentFromCurrentAmount({
        scheduledValue: 1000,
        previouslyBilled: 250,
        currentAmount: 350,
      }),
    ).toBe(60);
  });

  it("fails loudly when manual billing exceeds the scheduled value", () => {
    expect(
      validateCurrentAmount({
        scheduledValue: 1000,
        previouslyBilled: 800,
        currentAmount: 250,
      }),
    ).toEqual({
      error: "Current plus previous billing exceeds the scheduled value.",
    });
  });
});
