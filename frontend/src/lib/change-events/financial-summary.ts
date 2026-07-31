export interface ChangeEventFinancialTotals {
  revenueRom: string | number | null | undefined;
  costRom: string | number | null | undefined;
  nonCommittedCost: string | number | null | undefined;
}

export function toCurrencyNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function calculateChangeEventOverUnder(
  totals: Pick<ChangeEventFinancialTotals, "revenueRom" | "costRom">,
): number {
  return toCurrencyNumber(totals.revenueRom) - toCurrencyNumber(totals.costRom);
}

/**
 * Procore's default "Line Item Revenue Source" for a change event. Verified
 * against the live Procore instance (deep-crawl manifest: the field's
 * `currentValue` is "Match Revenue to Latest Cost"). An unset/empty source
 * therefore means "revenue mirrors cost" — NOT "no revenue".
 */
export const DEFAULT_LINE_ITEM_REVENUE_SOURCE = "Match Revenue to Latest Cost";

/**
 * Whether a revenue source means "revenue mirrors the latest cost" (revenue
 * ROM is auto-computed from cost, the Qty/Unit-Cost revenue cells are
 * read-only).
 *
 * NOTE: an empty/unset source returns `false` here — this predicate answers the
 * narrow "should the revenue inputs be read-only?" question, and an unchosen
 * source must not lock the inputs. To resolve the *effective* source (where
 * unset defaults to match-cost), use {@link resolveRevenueSource}.
 */
export function isMatchCostRevenueSource(source?: string | null): boolean {
  const normalized = (source ?? "").trim().toLowerCase();
  return normalized.includes("match revenue to latest cost");
}

/**
 * Resolve the effective revenue source for a change event: an unset/empty
 * source falls back to the Procore default ("Match Revenue to Latest Cost").
 */
export function resolveRevenueSource(source?: string | null): string {
  const trimmed = (source ?? "").trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_LINE_ITEM_REVENUE_SOURCE;
}

export interface LineItemRevenueInput {
  /** The change event's `expecting_revenue` flag (defaults to `true`). */
  expectingRevenue: boolean;
  /** The change event's `line_item_revenue_source` (may be null/empty). */
  revenueSource?: string | null;
  costRom: string | number | null | undefined;
  revenueRom: string | number | null | undefined;
}

/**
 * Revenue ROM for a single change-event line item, given the change event's
 * revenue settings. This is the single source of truth for rolling revenue up:
 *
 *   - `expectingRevenue === false` → 0 (no revenue is billed)
 *   - source resolves to match-cost (INCLUDING an unset source, which defaults
 *     to match-cost per Procore) → the line's cost ROM
 *   - otherwise ("Enter manually" / "Quantity x Unit Cost") → the stored
 *     revenue ROM
 *
 * Fixes the class of bug where a change event with a populated cost but no
 * explicitly-selected revenue source rolled up Revenue ROM = $0, which then
 * left the Prime PCO amount blank.
 */
export function computeLineItemRevenueRom(item: LineItemRevenueInput): number {
  if (item.expectingRevenue === false) return 0;
  if (isMatchCostRevenueSource(resolveRevenueSource(item.revenueSource))) {
    return toCurrencyNumber(item.costRom);
  }
  return toCurrencyNumber(item.revenueRom);
}
