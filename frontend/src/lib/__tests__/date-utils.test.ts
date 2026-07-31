import { parseDisplayDate } from "../date-utils";

describe("parseDisplayDate", () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  it("keeps ISO date-only strings on the intended local calendar date", () => {
    process.env.TZ = "America/New_York";

    const parsed = parseDisplayDate("2026-01-05");

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(5);
  });
});
