import {
  getCalendarMonthDefaults,
  snapToFirstDayOfMonth,
  snapToLastDayOfMonth,
} from "../billing-period-recurrence";

describe("billing-period-recurrence", () => {
  it("snaps a monthly start anchor to the first day of its month", () => {
    expect(snapToFirstDayOfMonth("2026-07-29")).toBe("2026-07-01");
  });

  it.each([
    ["2026-02-10", "2026-02-28"],
    ["2028-02-10", "2028-02-29"],
    ["2026-04-10", "2026-04-30"],
    ["2026-07-10", "2026-07-31"],
  ])(
    "snaps %s to the real last day of that calendar month",
    (input, expected) => {
      expect(snapToLastDayOfMonth(input)).toBe(expected);
    },
  );

  it("provides a complete current-calendar-month suggestion for an empty project", () => {
    expect(getCalendarMonthDefaults(new Date(2026, 6, 29))).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
      due: "2026-07-31",
    });
  });

  it("leaves an empty anchor empty so validation remains actionable", () => {
    expect(snapToFirstDayOfMonth("")).toBe("");
    expect(snapToLastDayOfMonth("")).toBe("");
  });
});
