import type { BillingPeriod } from "@/hooks/use-billing-periods";
import {
  formatOwnerInvoiceBillingPeriodOption,
  selectDefaultOwnerInvoiceBillingPeriod,
  shouldApplyOwnerInvoiceDueDate,
} from "@/lib/invoicing/owner-invoice-billing-period";

const period = (
  overrides: Partial<BillingPeriod> & Pick<BillingPeriod, "id" | "start_date" | "end_date">,
): BillingPeriod => ({
  id: overrides.id,
  project_id: 67,
  name: null,
  start_date: overrides.start_date,
  end_date: overrides.end_date,
  due_date: null,
  is_closed: true,
  period_number: 1,
  closed_by: null,
  closed_date: null,
  created_at: null,
  updated_at: null,
  ...overrides,
});

describe("owner invoice billing-period selection", () => {
  it("defaults to the newest open period even when the input is unsorted", () => {
    const selected = selectDefaultOwnerInvoiceBillingPeriod([
      period({
        id: "open-older",
        start_date: "2026-05-01",
        end_date: "2026-05-31",
        is_closed: false,
      }),
      period({
        id: "closed-newest",
        start_date: "2026-07-01",
        end_date: "2026-07-31",
      }),
      period({
        id: "open-newer",
        start_date: "2026-06-01",
        end_date: "2026-06-30",
        is_closed: false,
      }),
    ]);

    expect(selected?.id).toBe("open-newer");
  });

  it("defaults to the most recent period when none is open", () => {
    const selected = selectDefaultOwnerInvoiceBillingPeriod([
      period({
        id: "older",
        start_date: "2026-05-01",
        end_date: "2026-05-31",
      }),
      period({
        id: "newest",
        start_date: "2026-06-01",
        end_date: "2026-06-30",
      }),
    ]);

    expect(selected?.id).toBe("newest");
    expect(selectDefaultOwnerInvoiceBillingPeriod([])).toBeNull();
  });

  it("formats a compact canonical date range and open state", () => {
    expect(
      formatOwnerInvoiceBillingPeriodOption(
        period({
          id: "period-1",
          name: "July 2026",
          start_date: "2026-07-01",
          end_date: "2026-07-31",
          is_closed: false,
        }),
      ),
    ).toBe("Jul 1 to 31, 2026, Open");
  });

  it("refreshes an untouched due-date default without overwriting a manual override", () => {
    const previous = {
      billingPeriodId: "period-1",
      dueDate: "2026-07-31",
    };
    const refreshed = {
      billingPeriodId: "period-1",
      dueDate: "2026-08-05",
    };

    expect(shouldApplyOwnerInvoiceDueDate(previous, refreshed, false)).toBe(true);
    expect(shouldApplyOwnerInvoiceDueDate(previous, refreshed, true)).toBe(false);
    expect(
      shouldApplyOwnerInvoiceDueDate(
        previous,
        {
          billingPeriodId: "period-2",
          dueDate: null,
        },
        true,
      ),
    ).toBe(true);
  });
});
