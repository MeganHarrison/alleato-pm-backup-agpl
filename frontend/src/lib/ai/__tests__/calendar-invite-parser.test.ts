import { parseCalendarInviteRequest } from "../calendar-invite-parser";

describe("parseCalendarInviteRequest", () => {
  it("parses natural calendar invite prompts without requiring a raw email address", () => {
    const parsed = parseCalendarInviteRequest(
      "Send a 30 minute Teams meeting invite to Megan Harrison on 2026-05-14 at 2pm about Deep Agents production readiness.",
    );

    expect(parsed).toMatchObject({
      attendeeName: "Megan Harrison",
      subject: "Deep Agents production readiness",
      startDateTime: "2026-05-14T14:00:00",
      endDateTime: "2026-05-14T14:30:00",
      isOnlineMeeting: true,
      confirmed: false,
    });
    expect(parsed?.attendeeEmail).toBeUndefined();
  });
});
