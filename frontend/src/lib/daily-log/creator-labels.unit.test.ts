import { formatDailyLogDate, getDailyLogCreatorLabel } from "./creator-labels";

describe("getDailyLogCreatorLabel", () => {
  it("uses the user's full name when present", () => {
    expect(
      getDailyLogCreatorLabel({
        full_name: "Colin Gillespie",
        email: "cgillespie@alleatogroup.com",
      }),
    ).toBe("Colin Gillespie");
  });

  it("falls back to initials derived from the email local part", () => {
    expect(
      getDailyLogCreatorLabel({
        full_name: null,
        email: "megan.harrison@alleatogroup.com",
      }),
    ).toBe("MH");
  });

  it("never returns a raw UUID when the profile is missing", () => {
    expect(getDailyLogCreatorLabel(null)).toBeNull();
  });
});

describe("formatDailyLogDate", () => {
  it("formats date-only strings without timezone shifting", () => {
    expect(formatDailyLogDate("2026-05-21")).toBe("May 21, 2026");
  });
});
