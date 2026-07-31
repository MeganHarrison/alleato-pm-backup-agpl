/**
 * Content window — the single source of truth for "is this row inside the
 * retrieval window Y", replacing the `date`/`created_at`/`captured_at` OR-ladder
 * that is currently forked across the executive brief, the AI tools, the
 * synthesis sweep, and the pages.
 *
 * Semantics are lifted verbatim from `brandon-daily-update.ts` (the transcript-
 * first daily brief) so the Content Source module is parity-faithful to the
 * consumer it will replace first. Eastern (America/New_York) business-day
 * anchoring is intentional — a Monday brief must still include the prior
 * Thursday/Friday.
 */

/** Recency columns on a `document_metadata` row, in the order callers trust them. */
export interface RecencyRow {
  date?: string | null;
  captured_at?: string | null;
  created_at?: string | null;
  category?: string | null;
  type?: string | null;
}

/** A normalized retrieval window. `since`/`until` are ISO instants. */
export interface ContentWindow {
  since: string;
  until?: string;
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** YYYY-MM-DD in Eastern time — the key all window comparisons are made on. */
export function getEasternDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function newestValidDateString(
  values: Array<string | null | undefined>,
): string | null {
  let newest: { raw: string; time: number } | null = null;
  for (const value of values) {
    if (!value) continue;
    const date = parseDate(value);
    if (!date) continue;
    const time = date.getTime();
    if (!newest || time > newest.time) newest = { raw: value, time };
  }
  return newest?.raw ?? null;
}

/**
 * The instant a row should be judged "recent" by. Documents take the newest of
 * their date columns; everything else trusts date → captured_at → created_at.
 */
export function getRecencyAnchor(row: RecencyRow): string | null {
  if (row.category === "document" || row.type === "document") {
    return newestValidDateString([row.date, row.captured_at, row.created_at]);
  }
  return row.date ?? row.captured_at ?? row.created_at ?? null;
}

/** True when the row's recency anchor is on/after the window's lower bound. */
export function isWithinWindow(row: RecencyRow, window: ContentWindow): boolean {
  const anchor = getRecencyAnchor(row);
  const parsed = parseDate(anchor);
  if (parsed === null) return false;
  const key = getEasternDateKey(parsed);
  const sinceKey = getEasternDateKey(parseDate(window.since) ?? new Date(window.since));
  if (key < sinceKey) return false;
  if (window.until) {
    const untilKey = getEasternDateKey(parseDate(window.until) ?? new Date(window.until));
    if (key > untilKey) return false;
  }
  return true;
}

const EASTERN_WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function easternWeekdayIndex(date: Date): number {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(date);
  return EASTERN_WEEKDAY_INDEX[label] ?? 1;
}

/**
 * A window covering the last `days` BUSINESS days (Mon–Fri) in Eastern time.
 * `now` is injectable so the logic is unit-testable without wall-clock coupling.
 */
export function businessDaysAgoWindow(days: number, now: Date = new Date()): ContentWindow {
  const target = Math.max(days, 1);
  const cursor = new Date(now.getTime());
  let counted = 0;
  for (let guard = 0; guard < 31; guard += 1) {
    const day = easternWeekdayIndex(cursor);
    if (day !== 0 && day !== 6) {
      counted += 1;
      if (counted >= target) break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  const sinceKey = getEasternDateKey(cursor);
  return { since: `${sinceKey}T00:00:00.000Z`, until: now.toISOString() };
}
