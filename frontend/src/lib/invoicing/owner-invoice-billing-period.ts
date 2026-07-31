import type { BillingPeriod } from "@/hooks/use-billing-periods";

const newestFirst = (left: BillingPeriod, right: BillingPeriod) =>
  right.start_date.localeCompare(left.start_date) ||
  right.period_number - left.period_number;

export function selectDefaultOwnerInvoiceBillingPeriod(
  periods: BillingPeriod[],
): BillingPeriod | null {
  const sorted = [...periods].sort(newestFirst);
  return sorted.find((period) => !period.is_closed) ?? sorted[0] ?? null;
}

export interface AppliedOwnerInvoiceDueDate {
  billingPeriodId: string;
  dueDate: string | null;
}

export function shouldApplyOwnerInvoiceDueDate(
  previous: AppliedOwnerInvoiceDueDate | null,
  next: AppliedOwnerInvoiceDueDate,
  isDueDateDirty: boolean,
): boolean {
  if (previous?.billingPeriodId !== next.billingPeriodId) return true;
  return previous.dueDate !== next.dueDate && !isDueDateDirty;
}

function parseDateOnly(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCompactRange(startValue: string, endValue: string): string {
  const start = parseDateOnly(startValue);
  const end = parseDateOnly(endValue);
  if (!start || !end) return `${startValue} to ${endValue}`;

  const startMonth = start.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear === endYear && startMonth === endMonth) {
    return `${startMonth} ${startDay} to ${endDay}, ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startMonth} ${startDay} to ${endMonth} ${endDay}, ${startYear}`;
  }
  return `${startMonth} ${startDay}, ${startYear} to ${endMonth} ${endDay}, ${endYear}`;
}

export function formatOwnerInvoiceBillingPeriodOption(
  period: BillingPeriod,
): string {
  const range = formatCompactRange(period.start_date, period.end_date);
  return period.is_closed ? range : `${range}, Open`;
}
