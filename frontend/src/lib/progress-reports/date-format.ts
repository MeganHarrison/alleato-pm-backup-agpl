import { format } from "date-fns";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseProgressReportDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatProgressReportDate(
  value: string | null | undefined,
  pattern = "MMM d, yyyy",
  fallback = "-",
) {
  const date = parseProgressReportDate(value);
  if (!date) return fallback;
  return format(date, pattern);
}

