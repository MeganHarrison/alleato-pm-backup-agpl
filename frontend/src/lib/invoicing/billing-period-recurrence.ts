function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

function toIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function snapToFirstDayOfMonth(value: string) {
  const parsed = parseIsoDate(value);
  return parsed ? toIsoDate(parsed.year, parsed.month, 1) : value;
}

export function snapToLastDayOfMonth(value: string) {
  const parsed = parseIsoDate(value);
  return parsed
    ? toIsoDate(
        parsed.year,
        parsed.month,
        lastDayOfMonth(parsed.year, parsed.month),
      )
    : value;
}

export function isFirstDayOfMonth(value: string) {
  const parsed = parseIsoDate(value);
  return parsed?.day === 1;
}

export function isLastDayOfMonth(value: string) {
  const parsed = parseIsoDate(value);
  return Boolean(
    parsed &&
      parsed.day === lastDayOfMonth(parsed.year, parsed.month),
  );
}

export function getCalendarMonthDefaults(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const end = toIsoDate(year, month, lastDayOfMonth(year, month));

  return {
    start: toIsoDate(year, month, 1),
    end,
    due: end,
  };
}
