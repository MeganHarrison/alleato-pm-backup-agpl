import {
  assertGraphMailWritePermission,
  buildOutlookMailDraftAdaptiveCard,
  buildOutlookMailMessagePayload,
  getGraphMailPermissionStatus,
} from "./mail";

jest.mock("server-only", () => ({}));

function fakeGraphToken(claims: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "signature",
  ].join(".");
}

describe("Outlook mail helpers", () => {
  it("builds a Microsoft Graph draft message payload", () => {
    const payload = buildOutlookMailMessagePayload({
      subject: "Owner follow-up",
      body: "Brandon,\n\nHere is the proposed response.",
      toRecipients: [{ email: "owner@example.com", name: "Owner Rep" }],
      ccRecipients: [{ email: "pm@example.com" }],
      importance: "high",
    });

    expect(payload).toMatchObject({
      subject: "Owner follow-up",
      importance: "high",
      body: {
        contentType: "HTML",
        content: "Brandon,<br /><br />Here is the proposed response.",
      },
      toRecipients: [
        {
          emailAddress: { address: "owner@example.com", name: "Owner Rep" },
        },
      ],
      ccRecipients: [
        {
          emailAddress: { address: "pm@example.com", name: "pm@example.com" },
        },
      ],
    });
  });

  it("fails loudly when a new message draft has no recipients", () => {
    expect(() =>
      buildOutlookMailMessagePayload({
        subject: "Owner follow-up",
        body: "Draft body",
        toRecipients: [],
      }),
    ).toThrow("Outlook draft needs at least one recipient");
  });

  it("allows reply drafts to infer recipients from the original message", () => {
    expect(() =>
      buildOutlookMailMessagePayload({
        subject: "RE: Owner follow-up",
        body: "Draft body",
        toRecipients: [],
        replyToGraphMessageId: "message-123",
      }),
    ).not.toThrow();
  });

  it("builds an Adaptive Card payload for draft previews", () => {
    const card = buildOutlookMailDraftAdaptiveCard({
      title: "Owner follow-up",
      mailboxUserId: "brandon@example.com",
      recipientLabel: "2 recipients",
      status: "draft",
      mode: "new_message",
      openUrl: "https://outlook.office.com/mail/id/123",
    });

    expect(card.type).toBe("AdaptiveCard");
    expect(card.body).toEqual(expect.arrayContaining([expect.objectContaining({ type: "FactSet" })]));
    expect(card.actions).toEqual([
      {
        type: "Action.OpenUrl",
        title: "Open in Outlook",
        url: "https://outlook.office.com/mail/id/123",
      },
    ]);
  });

  it("detects missing Graph mail write permission before draft creation", () => {
    const token = fakeGraphToken({
      roles: ["Mail.Read", "Calendars.ReadWrite"],
    });

    expect(getGraphMailPermissionStatus(token)).toMatchObject({
      ok: false,
      roles: ["Mail.Read", "Calendars.ReadWrite"],
      scopes: [],
    });
    expect(() => assertGraphMailWritePermission(token)).toThrow(
      "Microsoft Graph mail write permission is not configured.",
    );
  });

  it("accepts Graph tokens with mail write permission", () => {
    const token = fakeGraphToken({
      roles: ["Mail.Read", "Mail.ReadWrite"],
    });

    expect(getGraphMailPermissionStatus(token)).toMatchObject({
      ok: true,
      roles: ["Mail.Read", "Mail.ReadWrite"],
      scopes: [],
    });
    expect(() => assertGraphMailWritePermission(token)).not.toThrow();
  });
});
