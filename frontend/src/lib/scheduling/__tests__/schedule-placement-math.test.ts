import type { DependencyType } from "@/types/scheduling";
import {
  dependencyMinimumStart,
  effectiveTaskDates,
  effectiveTaskDuration,
  placementFromStart,
  workingDateAtOrBefore,
} from "../schedule-placement-math";

const calendar = {
  working_weekdays: [1, 2, 3, 4, 5],
  non_working_dates: ["2026-08-05"],
};

describe("schedule placement math", () => {
  it("uses forecast start and finish independently and preserves the effective working duration", () => {
    const task = {
      start_date: "2026-08-03",
      finish_date: "2026-08-07",
      forecast_start_date: "2026-08-04",
      forecast_finish_date: null,
    };

    expect(effectiveTaskDates(task)).toEqual({ start: "2026-08-04", finish: "2026-08-07" });
    expect(effectiveTaskDuration(task, calendar)).toBe(3);
    expect(placementFromStart("2026-08-06", 3, calendar)).toEqual({
      start: "2026-08-06",
      finish: "2026-08-10",
    });
    expect(workingDateAtOrBefore("2026-08-09", calendar)).toBe("2026-08-07");
  });

  it.each([
    ["finish_to_start", -1, "2026-08-04"],
    ["start_to_start", -1, "2026-07-31"],
    ["finish_to_finish", -1, "2026-07-31"],
    ["start_to_finish", -1, "2026-07-30"],
  ] satisfies Array<[DependencyType, number, string]>) (
    "applies negative lag for %s without changing relationship semantics",
    (dependency_type, lag_days, expectedStart) => {
      expect(dependencyMinimumStart(
        { dependency_type, lag_days },
        { start: "2026-08-03", finish: "2026-08-04" },
        2,
        calendar,
      )).toBe(expectedStart);
    },
  );
});
