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

export function validateBillingComponentSigns(
  scheduledValue: number,
  componentAmounts: number[],
): ValidationResult {
  const hasWrongSign =
    scheduledValue < 0
      ? componentAmounts.some((amount) => amount > 0)
      : componentAmounts.some((amount) => amount < 0);

  return {
    error: hasWrongSign
      ? "Work and materials billing must each follow the sign of the scheduled value."
      : null,
  };
}

export function calculateCompletionPercentFromCurrentAmount({
  scheduledValue,
  previouslyBilled,
  currentAmount,
}: CompletionPercentFromAmountInput): number {
  if (scheduledValue === 0) {
    return 0;
  }

  return roundCurrency(((previouslyBilled + currentAmount) / scheduledValue) * 100);
}

export function calculateCurrentAmountFromCompletionPercent({
  scheduledValue,
  previouslyBilled,
  completionPercent,
}: CurrentAmountFromPercentInput): { amount: number | null; error: string | null } {
  if (scheduledValue === 0) {
    return {
      amount: null,
      error: "Percent autofill requires a non-zero scheduled value.",
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

  if (
    (scheduledValue > 0 && currentAmount < 0) ||
    (scheduledValue < 0 && currentAmount > 0)
  ) {
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
  if (
    (scheduledValue > 0 && currentAmount < 0) ||
    (scheduledValue < 0 && currentAmount > 0)
  ) {
    return {
      error:
        "Current-period billing must follow the sign of the scheduled value.",
    };
  }

  if (scheduledValue === 0) {
    return {
      error:
        currentAmount !== 0
          ? "This row has no scheduled value to bill against."
          : null,
    };
  }

  const totalCompleted = roundCurrency(previouslyBilled + currentAmount);
  const roundedSchedule = roundCurrency(scheduledValue);
  if (
    (roundedSchedule > 0 &&
      (totalCompleted < 0 || totalCompleted > roundedSchedule)) ||
    (roundedSchedule < 0 &&
      (totalCompleted > 0 || totalCompleted < roundedSchedule))
  ) {
    return {
      error: "Current plus previous billing exceeds the scheduled value.",
    };
  }

  return { error: null };
}
