import { validateFieldScheduleUpdate } from "../field-update-validation";

describe("field schedule update validation", () => {
  it("requires a reason when a field delay is recorded", () => {
    expect(validateFieldScheduleUpdate({ forecast_finish_date: "2026-08-14" })).toEqual({
      error: "Provide a delay reason when changing forecast dates or remaining duration.",
    });
  });

  it("accepts an auditable field update with a reason, note, and attachments", () => {
    expect(validateFieldScheduleUpdate({
      actual_start_date: "2026-08-01",
      forecast_finish_date: "2026-08-14",
      remaining_duration_days: 8,
      delay_reason: "Rain delay",
      note: "Crew stood down after site inspection.",
      attachment_urls: ["https://example.com/daily-log.pdf"],
    })).toEqual({
      value: {
        actual_start_date: "2026-08-01",
        forecast_finish_date: "2026-08-14",
        remaining_duration_days: 8,
        delay_reason: "Rain delay",
        note: "Crew stood down after site inspection.",
        attachment_urls: ["https://example.com/daily-log.pdf"],
      },
    });
  });

  it("rejects invalid dates, negative remaining duration, and non-URL attachments", () => {
    expect(validateFieldScheduleUpdate({ actual_finish_date: "not-a-date" }).error).toContain("valid ISO date");
    expect(validateFieldScheduleUpdate({ remaining_duration_days: -1, delay_reason: "Weather" }).error).toContain("zero or greater");
    expect(validateFieldScheduleUpdate({ attachment_urls: ["not a url"] }).error).toContain("valid URLs");
  });

  it("rejects fractional remaining duration before the audited write boundary", () => {
    expect(validateFieldScheduleUpdate({
      remaining_duration_days: 1.5,
      delay_reason: "Weather",
    })).toEqual({ error: "remaining_duration_days must be a whole number of days." });
  });
});
