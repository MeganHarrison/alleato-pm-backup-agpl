export interface PercentAutofillParams {
  scheduledValue: number;
  previouslyBilled: number;
}

export interface CurrentAmountFromPercentInput extends PercentAutofillParams {
  completionPercent: number;
}

export interface CompletionPercentFromAmountInput extends PercentAutofillParams {
  currentAmount: number;
}

export interface ValidationResult {
  error: string | null;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCompletionPercentFromCurrentAmount({
  scheduledValue,
  previouslyBilled,
  currentAmount,
}: CompletionPercentFromAmountInput): number {
  if (scheduledValue <= 0) {
    return 0;
  }

  return roundCurrency(((previouslyBilled + currentAmount) / scheduledValue) * 100);
}

export function calculateCurrentAmountFromCompletionPercent({
  scheduledValue,
  previouslyBilled,
  completionPercent,
}: CurrentAmountFromPercentInput): { amount: number | null; error: string | null } {
  if (scheduledValue <= 0) {
    return {
      amount: null,
      error: "Percent autofill requires a positive scheduled value.",
    };
  }

  if (completionPercent < 0 || completionPercent > 100) {
    return {
      amount: null,
      error: "Percent complete must be between 0 and 100.",
    };
  }

  const totalCompletedTarget = roundCurrency((scheduledValue * completionPercent) / 100);
  const currentAmount = roundCurrency(totalCompletedTarget - previouslyBilled);

  if (currentAmount < 0) {
    return {
      amount: null,
      error: "Percent complete cannot be below the amount already billed.",
    };
  }

  return { amount: currentAmount, error: null };
}

export function validateCurrentAmount({
  scheduledValue,
  previouslyBilled,
  currentAmount,
}: CompletionPercentFromAmountInput): ValidationResult {
  if (currentAmount < 0) {
    return {
      error: "Current-period amount cannot be negative.",
    };
  }

  if (scheduledValue <= 0) {
    return {
      error: currentAmount > 0 ? "This row has no scheduled value to bill against." : null,
    };
  }

  const totalCompleted = roundCurrency(previouslyBilled + currentAmount);
  if (totalCompleted > roundCurrency(scheduledValue)) {
    return {
      error: "Current plus previous billing exceeds the scheduled value.",
    };
  }

  return { error: null };
}
