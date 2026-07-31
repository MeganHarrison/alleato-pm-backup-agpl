/**
 * Regression test: change-event line-item revenue Qty / Unit Cost editability.
 *
 * Root cause: LineItemRow gated the revenue inputs read-only unless the source
 * was "" or exactly "manual". It checked for the substring "manual entry", but
 * the actual dropdown option is "Enter manually" — so selecting "Enter manually"
 * (the one option meant for typed pricing) LOCKED the fields, and
 * "Quantity x Unit Cost" was silently locked too. A user could not enter a unit
 * cost to mark anything up.
 *
 * Correct contract: revenue Qty / Unit Cost are read-only ONLY when revenue
 * mirrors cost ("Match Revenue to Latest Cost" / legacy match aliases). Every
 * other source — including all REVENUE_SOURCE_OPTIONS except match-cost — is
 * user-editable. Revenue ROM is always computed and is out of scope here.
 *
 * Bucket: Should have been caught pre-deploy → this test is the guardrail.
 */

import {
  REVENUE_SOURCE_OPTIONS,
  isMatchCostRevenueSource,
} from "../change-event-form/types";

describe("isMatchCostRevenueSource — read-only gate for revenue inputs", () => {
  it("treats the match-cost option as read-only", () => {
    expect(isMatchCostRevenueSource("Match Revenue to Latest Cost")).toBe(true);
  });

  it("treats legacy match-cost aliases as read-only", () => {
    expect(isMatchCostRevenueSource("match_cost")).toBe(true);
    expect(isMatchCostRevenueSource("match_revenue_to_cost")).toBe(true);
  });

  it("treats 'Enter manually' as editable (the original bug)", () => {
    expect(isMatchCostRevenueSource("Enter manually")).toBe(false);
  });

  it("treats 'Quantity x Unit Cost' as editable", () => {
    expect(isMatchCostRevenueSource("Quantity x Unit Cost")).toBe(false);
  });

  it("treats empty / unset source as editable", () => {
    expect(isMatchCostRevenueSource("")).toBe(false);
    expect(isMatchCostRevenueSource(undefined)).toBe(false);
    expect(isMatchCostRevenueSource(null)).toBe(false);
  });

  it("is case/whitespace insensitive", () => {
    expect(isMatchCostRevenueSource("  match revenue to latest cost  ")).toBe(true);
    expect(isMatchCostRevenueSource("ENTER MANUALLY")).toBe(false);
  });

  it("locks exactly one of the three dropdown options (match-cost)", () => {
    const readOnlyCount = REVENUE_SOURCE_OPTIONS.filter((o) =>
      isMatchCostRevenueSource(o.value),
    ).length;
    expect(readOnlyCount).toBe(1);
  });
});
