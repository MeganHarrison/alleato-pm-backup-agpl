import {
  calculateCompletionPercentFromCurrentAmount,
  calculateCurrentAmountFromCompletionPercent,
  validateBillingComponentSigns,
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

  it("supports applying a deductive change order through signed billing", () => {
    expect(
      calculateCurrentAmountFromCompletionPercent({
        scheduledValue: -5000,
        previouslyBilled: -1000,
        completionPercent: 60,
      }),
    ).toEqual({ amount: -2000, error: null });

    expect(
      calculateCompletionPercentFromCurrentAmount({
        scheduledValue: -5000,
        previouslyBilled: -1000,
        currentAmount: -2000,
      }),
    ).toBe(60);

    expect(
      validateCurrentAmount({
        scheduledValue: -5000,
        previouslyBilled: -1000,
        currentAmount: -2000,
      }),
    ).toEqual({ error: null });
  });

  it("rejects deductive billing beyond the signed scheduled value", () => {
    expect(
      validateCurrentAmount({
        scheduledValue: -5000,
        previouslyBilled: -4000,
        currentAmount: -1001,
      }),
    ).toEqual({
      error: "Current plus previous billing exceeds the scheduled value.",
    });

    expect(
      validateCurrentAmount({
        scheduledValue: -5000,
        previouslyBilled: -1000,
        currentAmount: 500,
      }),
    ).toEqual({
      error:
        "Current-period billing must follow the sign of the scheduled value.",
    });
  });

  it("rejects mixed-sign work and materials that cancel on a deductive row", () => {
    expect(validateBillingComponentSigns(-5000, [-6000, 1000])).toEqual({
      error:
        "Work and materials billing must each follow the sign of the scheduled value.",
    });
    expect(validateBillingComponentSigns(-5000, [-3000, -1000])).toEqual({
      error: null,
    });
  });
});
