import type { BillingPeriod } from "@/hooks/use-billing-periods";

const newestFirst = (left: BillingPeriod, right: BillingPeriod) =>
  right.start_date.localeCompare(left.start_date) ||
  right.period_number - left.period_number;

export function selectDefaultBillingPeriod(
  periods: BillingPeriod[],
): BillingPeriod | null {
  const sorted = [...periods].sort(newestFirst);
  return sorted.find((period) => !period.is_closed) ?? sorted[0] ?? null;
}
