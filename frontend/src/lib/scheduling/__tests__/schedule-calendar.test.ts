import {
  addWorkingDays,
  defaultScheduleCalendar,
  isWorkingDay,
  workingDayDelta,
  workingDayDuration,
} from "../schedule-calendar";

describe("construction schedule calendar", () => {
  it("uses the explicit default Monday-through-Friday calendar", () => {
    expect(defaultScheduleCalendar.working_weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(addWorkingDays("2026-08-07", 1, defaultScheduleCalendar)).toBe("2026-08-10");
  });

  it("skips a project non-working date even when it falls on a configured weekday", () => {
    const calendar = {
      working_weekdays: [1, 2, 3, 4, 5],
      non_working_dates: ["2026-08-10"],
    };

    expect(addWorkingDays("2026-08-07", 1, calendar)).toBe("2026-08-11");
    expect(workingDayDuration("2026-08-07", "2026-08-11", calendar)).toBe(2);
  });

  it("honors a six-day construction week", () => {
    const calendar = {
      working_weekdays: [1, 2, 3, 4, 5, 6],
      non_working_dates: [],
    };

    expect(addWorkingDays("2026-08-07", 1, calendar)).toBe("2026-08-08");
  });

  it("allows a dated working override outside the normal week", () => {
    const calendar = {
      working_weekdays: [1, 2, 3, 4, 5],
      non_working_dates: [],
      working_date_overrides: ["2026-08-09"],
    };

    expect(isWorkingDay("2026-08-09", calendar)).toBe(true);
    expect(addWorkingDays("2026-08-07", 1, calendar)).toBe("2026-08-09");
  });

  it("returns signed project-working-day movement and honors exceptions", () => {
    const calendar = {
      working_weekdays: [1, 2, 3, 4, 5],
      non_working_dates: ["2026-08-10"],
    };

    expect(workingDayDelta("2026-08-07", "2026-08-11", calendar)).toBe(1);
    expect(workingDayDelta("2026-08-11", "2026-08-07", calendar)).toBe(-1);
    expect(workingDayDelta("2026-08-07", "2026-08-07", calendar)).toBe(0);
    expect(workingDayDelta("2026-08-07", "2026-08-09", calendar)).toBe(0);
    expect(workingDayDelta("2026-08-09", "2026-08-07", calendar)).toBe(0);
  });
});
