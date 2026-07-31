import type { ScheduleResourceCapacityProfile } from "@/types/scheduling";
import { buildScheduleResourceCapacityResolver } from "../schedule-resource-capacity";

const calendar = {
  working_weekdays: [1, 2, 3, 4, 5],
  non_working_dates: ["2026-08-06"],
  working_date_overrides: ["2026-08-09"],
};

function profile(
  overrides: Partial<ScheduleResourceCapacityProfile> = {},
): ScheduleResourceCapacityProfile {
  return {
    profile_id: "profile-r1",
    project_id: 67,
    resource_id: "r1",
    configured: true,
    version: 1,
    coverage_start_date: "2026-08-01",
    coverage_finish_date: "2026-08-31",
    weekday_overrides: [{ weekday: 1, capacity_percent: 60 }],
    exceptions: [
      { date: "2026-08-03", capacity_percent: 25, reason: "Training" },
      { date: "2026-08-06", capacity_percent: 80, reason: "Ignored on project closure" },
    ],
    ...overrides,
  };
}

describe("schedule resource capacity", () => {
  it("applies project non-working, exception, weekday, and inherited precedence with typed sources", () => {
    const resolver = buildScheduleResourceCapacityResolver({
      calendar,
      capacity_profiles: [profile()],
    });

    expect(resolver.resolve("r1", "2026-08-06")).toMatchObject({
      capacity_percent: 0,
      source: "project_non_working",
    });
    expect(resolver.resolve("r1", "2026-08-03")).toEqual({
      capacity_percent: 25,
      source: "date_exception",
      reason: "Training",
      available: true,
    });
    expect(resolver.resolve("r1", "2026-08-10")).toMatchObject({
      capacity_percent: 60,
      source: "weekday_override",
    });
    expect(resolver.resolve("r1", "2026-08-04")).toMatchObject({
      capacity_percent: 100,
      source: "inherited",
    });
    expect(resolver.resolve("r1", "2026-08-09")).toMatchObject({
      capacity_percent: 100,
      source: "inherited",
    });
    expect(resolver.resolve("unconfigured", "2026-08-04")).toMatchObject({
      capacity_percent: 100,
      source: "inherited",
    });
  });

  it("makes invalid, duplicate, and uncovered capacity facts deterministic and visible", () => {
    const resolver = buildScheduleResourceCapacityResolver({
      calendar,
      capacity_profiles: [
        profile({
          coverage_start_date: "2026-08-05",
          weekday_overrides: [
            { weekday: 1, capacity_percent: 40 },
            { weekday: 1, capacity_percent: 70 },
            { weekday: 8, capacity_percent: 50 },
            { weekday: 2, capacity_percent: 101 },
          ],
          exceptions: [
            { date: "2026-08-07", capacity_percent: 20, reason: null },
            { date: "2026-08-07", capacity_percent: 30, reason: null },
            { date: "not-a-date", capacity_percent: 40, reason: null },
          ],
        }),
      ],
    });

    expect(resolver.resolve("r1", "2026-08-03")).toEqual({
      capacity_percent: 0,
      source: "unavailable",
      reason: null,
      available: false,
    });
    expect(resolver.resolve("r1", "2026-08-07")).toMatchObject({
      capacity_percent: 100,
      source: "inherited",
    });
    expect(resolver.diagnostics.map(({ code }) => code)).toEqual([
      "duplicate_capacity_fact",
      "duplicate_capacity_fact",
      "invalid_capacity_fact",
      "invalid_capacity_fact",
      "invalid_capacity_fact",
    ]);
    expect(resolver.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_capacity_fact", fact_type: "weekday", key: "1" }),
        expect.objectContaining({ code: "duplicate_capacity_fact", fact_type: "exception", key: "2026-08-07" }),
      ]),
    );
    expect(resolver.rangeDiagnostics("2026-08-03", "2026-08-07")).toEqual([
      expect.objectContaining({
        code: "uncovered_capacity_range",
        resource_id: "r1",
        date: "2026-08-03",
      }),
    ]);
  });

  it("does not depend on profile or fact input order", () => {
    const facts = profile({
      weekday_overrides: [
        { weekday: 2, capacity_percent: 80 },
        { weekday: 1, capacity_percent: 60 },
      ],
      exceptions: [
        { date: "2026-08-05", capacity_percent: 20, reason: "A" },
        { date: "2026-08-04", capacity_percent: 40, reason: "B" },
      ],
    });
    const first = buildScheduleResourceCapacityResolver({ calendar, capacity_profiles: [facts] });
    const second = buildScheduleResourceCapacityResolver({
      calendar,
      capacity_profiles: [{
        ...facts,
        weekday_overrides: [...facts.weekday_overrides].reverse(),
        exceptions: [...facts.exceptions].reverse(),
      }],
    });

    expect(second.resolve("r1", "2026-08-04")).toEqual(first.resolve("r1", "2026-08-04"));
    expect(second.diagnostics).toEqual(first.diagnostics);
  });

  it("does not choose between duplicate profiles or use malformed coverage", () => {
    const duplicate = buildScheduleResourceCapacityResolver({
      calendar,
      capacity_profiles: [profile(), profile({ profile_id: "profile-r1-duplicate" })],
    });
    expect(duplicate.diagnostics).toEqual([
      expect.objectContaining({ code: "duplicate_capacity_profile", resource_id: "r1" }),
    ]);
    expect(duplicate.resolve("r1", "2026-08-04")).toMatchObject({
      source: "unavailable",
      available: false,
    });

    const malformedCoverage = buildScheduleResourceCapacityResolver({
      calendar,
      capacity_profiles: [profile({
        coverage_start_date: "2026-08-31",
        coverage_finish_date: "2026-08-01",
      })],
    });
    expect(malformedCoverage.diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_capacity_fact", fact_type: "coverage" }),
    ]);
    expect(malformedCoverage.resolve("r1", "2026-08-04")).toMatchObject({
      source: "unavailable",
      available: false,
    });
  });
});
