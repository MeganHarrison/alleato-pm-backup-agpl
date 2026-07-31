/**
 * Shared low-level utilities for accounting route handlers.
 *
 * These are pure, side-effect-free functions. Keep them that way —
 * no Supabase clients, no env-var reads, no logging.
 */

/** Coerce a nullable/undefined numeric DB column to a plain number. */
export function toNumber(value: number | null | undefined): number {
  return Number(value ?? 0);
}

/** Round to 2 decimal places (display rounding only — not for financial storage or accumulation). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Parse any date-like string to an ISO-8601 timestamp string, or null
 * if the value is absent or unparseable.
 */
export function asIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * Return the latest ISO timestamp from an array of nullable date strings,
 * or null if the array is empty or contains no parseable dates.
 */
export function getMaxDate(values: Array<string | null | undefined>): string | null {
  let maxTs = 0;
  for (const value of values) {
    const parsed = asIsoDate(value);
    if (!parsed) continue;
    const ts = new Date(parsed).getTime();
    if (ts > maxTs) maxTs = ts;
  }
  return maxTs ? new Date(maxTs).toISOString() : null;
}
