import {
  assertGraphCalendarWritePermission,
  buildCalendarInviteAdaptiveCard,
  buildOutlookCalendarEventPayload,
  getGraphCalendarPermissionStatus,
} from "./calendar-invites";

jest.mock("server-only", () => ({}));

function fakeGraphToken(claims: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "signature",
  ].join(".");
}

describe("Outlook calendar invite helpers", () => {
  it("builds a Microsoft Graph calendar event payload with Teams meeting settings", () => {
    const payload = buildOutlookCalendarEventPayload({
      subject: "Owner review",
      body: "Review open cost and schedule items.",
      startDateTime: "2026-05-13T14:00:00",
      endDateTime: "2026-05-13T14:30:00",
      timeZone: "Eastern Standard Time",
      location: "Microsoft Teams",
      attendees: [
        { email: "brandon@example.com", name: "Brandon Clymer" },
        { email: "pm@example.com", type: "optional" },
      ],
      transactionId: "invite-123",
    });

    expect(payload).toMatchObject({
      subject: "Owner review",
      start: { dateTime: "2026-05-13T14:00:00", timeZone: "Eastern Standard Time" },
      end: { dateTime: "2026-05-13T14:30:00", timeZone: "Eastern Standard Time" },
      location: { displayName: "Microsoft Teams" },
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
      transactionId: "invite-123",
    });
    expect(payload.attendees).toEqual([
      {
        emailAddress: { address: "brandon@example.com", name: "Brandon Clymer" },
        type: "required",
      },
      {
        emailAddress: { address: "pm@example.com", name: "pm@example.com" },
        type: "optional",
      },
    ]);
  });

  it("fails loudly when the invite end time is not after the start time", () => {
    expect(() =>
      buildOutlookCalendarEventPayload({
        subject: "Owner review",
        body: "Review open items.",
        startDateTime: "2026-05-13T14:00:00",
        endDateTime: "2026-05-13T14:00:00",
        attendees: [{ email: "brandon@example.com" }],
      }),
    ).toThrow("endDateTime must be after startDateTime");
  });

  it("builds an Adaptive Card payload for the chat widget and Teams-compatible rendering", () => {
    const card = buildCalendarInviteAdaptiveCard({
      title: "Owner review",
      startLabel: "2026-05-13T14:00:00",
      endLabel: "2026-05-13T14:30:00",
      location: "Microsoft Teams",
      attendeeLabel: "2 attendees",
      status: "created",
      openUrl: "https://outlook.office.com/calendar/item/123",
    });

    expect(card.type).toBe("AdaptiveCard");
    expect(card.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "FactSet" }),
      ]),
    );
    expect(card.actions).toEqual([
      {
        type: "Action.OpenUrl",
        title: "Open in Outlook",
        url: "https://outlook.office.com/calendar/item/123",
      },
    ]);
  });

  it("detects missing Graph calendar write permission before event creation", () => {
    const token = fakeGraphToken({
      roles: ["Mail.Read", "ChannelMessage.Read.All", "Chat.Read.All"],
    });

    expect(getGraphCalendarPermissionStatus(token)).toMatchObject({
      ok: false,
      roles: ["Mail.Read", "ChannelMessage.Read.All", "Chat.Read.All"],
      scopes: [],
    });
    expect(() => assertGraphCalendarWritePermission(token)).toThrow(
      "Microsoft Graph calendar write permission is not configured.",
    );
  });

  it("accepts Graph tokens with calendar write permission", () => {
    const token = fakeGraphToken({
      roles: ["Mail.Read", "Calendars.ReadWrite"],
    });

    expect(getGraphCalendarPermissionStatus(token)).toMatchObject({
      ok: true,
      roles: ["Mail.Read", "Calendars.ReadWrite"],
      scopes: [],
    });
    expect(() => assertGraphCalendarWritePermission(token)).not.toThrow();
  });
});
