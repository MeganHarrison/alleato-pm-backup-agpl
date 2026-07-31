type BillingPeriodDraftInput = {
  start_date?: string | null;
  end_date?: string | null;
  due_date?: string | null;
};

export function validateBillingPeriodDraft(
  input: BillingPeriodDraftInput,
): string | null {
  if (!input.start_date) return "Billing period start date is required.";
  if (!input.end_date) return "Billing period end date is required.";
  if (!input.due_date) return "Billing period due date is required.";
  if (input.end_date < input.start_date) {
    return "Billing period end date must be on or after the start date.";
  }
  return null;
}
