const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDisplayDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  if (ISO_DATE_ONLY_PATTERN.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  return new Date(value);
}
