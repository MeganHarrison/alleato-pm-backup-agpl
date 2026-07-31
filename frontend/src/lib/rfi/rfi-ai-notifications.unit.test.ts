import { recordAiNotificationDecision } from "@/lib/ai/notification-decision-ledger";
import { recordRfiOpenedAiNotificationDecisions } from "./rfi-ai-notifications";

jest.mock("@/lib/ai/notification-decision-ledger", () => ({
  recordAiNotificationDecision: jest.fn(),
}));

const mockRecordAiNotificationDecision =
  recordAiNotificationDecision as jest.MockedFunction<
    typeof recordAiNotificationDecision
  >;

describe("recordRfiOpenedAiNotificationDecisions", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockRecordAiNotificationDecision.mockResolvedValue({
      status: "recorded",
      decision: {
        tier: "interrupt",
        channels: ["in_app"],
        requiredAction: "Open the RFI and respond or accept ownership.",
        reason: "The user owns the next action.",
        failureLoudBehavior:
          "If Teams recipient is not linked, fall back to in-app and log the skip.",
        preferenceOverrideReason:
          "Teams delivery suppressed by preference; in-app visibility retained.",
      },
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("records decisions for mapped RFI opened recipients without Teams delivery", async () => {
    const result = await recordRfiOpenedAiNotificationDecisions({
      projectId: 25125,
      projectName: "Goodwill Noblesville",
      rfiId: "rfi-1",
      rfiNumber: 14,
      rfiSubject: "Storefront jamb detail",
      actorUserId: "sender-user",
      assigneeEmails: new Set(["assigned@example.com"]),
      recipients: [
        {
          name: "Assigned User",
          email: "assigned@example.com",
          userId: "assigned-user",
          userMappingStatus: "mapped",
        },
        {
          name: "Distribution User",
          email: "distribution@example.com",
          userId: "distribution-user",
          userMappingStatus: "mapped",
        },
      ],
    });

    expect(result).toMatchObject({
      attempted: 2,
      recorded: 2,
      skippedDuplicate: 0,
      skippedUnmapped: 0,
      skippedAmbiguous: 0,
      failed: [],
    });
    expect(mockRecordAiNotificationDecision).toHaveBeenCalledTimes(2);
    expect(mockRecordAiNotificationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "assigned-user",
        actorId: "sender-user",
        eventType: "rfi_assigned",
        projectId: 25125,
        entityType: "rfi",
        entityId: "rfi-1",
        eventKey: "rfi:rfi-1:opened",
        title: "RFI #14 opened: Storefront jamb detail",
        preferenceHints: { suppressTeams: true },
      }),
    );
    expect(mockRecordAiNotificationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "distribution-user",
        body: "Review RFI #14 for Goodwill Noblesville; you were included in the opened RFI notification.",
      }),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("skips unmapped and ambiguous recipients without guessing user IDs", async () => {
    const result = await recordRfiOpenedAiNotificationDecisions({
      projectId: 25125,
      projectName: "Goodwill Noblesville",
      rfiId: "rfi-1",
      rfiNumber: 14,
      rfiSubject: "Storefront jamb detail",
      actorUserId: "sender-user",
      assigneeEmails: new Set(),
      recipients: [
        {
          name: "Mapped User",
          email: "mapped@example.com",
          userId: "mapped-user",
          userMappingStatus: "mapped",
        },
        {
          name: "Contact Only",
          email: "contact@example.com",
          userMappingStatus: "unmapped",
        },
        {
          name: "Ambiguous User",
          email: "shared@example.com",
          userMappingStatus: "ambiguous",
        },
      ],
    });

    expect(result).toMatchObject({
      attempted: 1,
      recorded: 1,
      skippedUnmapped: 1,
      skippedAmbiguous: 1,
    });
    expect(mockRecordAiNotificationDecision).toHaveBeenCalledTimes(1);
    expect(mockRecordAiNotificationDecision).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: "mapped-user" }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[rfi-notify] AI notification decision skipped for unmapped recipients",
      expect.objectContaining({
        projectId: 25125,
        rfiId: "rfi-1",
        skippedUnmapped: 1,
        skippedAmbiguous: 1,
      }),
    );
  });

  it("returns and warns ledger failures without throwing", async () => {
    mockRecordAiNotificationDecision.mockResolvedValueOnce({
      status: "failed",
      decision: {
        tier: "interrupt",
        channels: ["in_app"],
        requiredAction: "Open the RFI and respond or accept ownership.",
        reason: "The user owns the next action.",
        failureLoudBehavior:
          "If Teams recipient is not linked, fall back to in-app and log the skip.",
        preferenceOverrideReason: null,
      },
      error: {
        code: "insert_failed",
        message: "Failed to record AI notification decision (rfi_assigned): db unavailable",
      },
    });

    const result = await recordRfiOpenedAiNotificationDecisions({
      projectId: 25125,
      projectName: "Goodwill Noblesville",
      rfiId: "rfi-1",
      rfiNumber: 14,
      rfiSubject: "Storefront jamb detail",
      actorUserId: "sender-user",
      assigneeEmails: new Set(["assigned@example.com"]),
      recipients: [
        {
          name: "Assigned User",
          email: "assigned@example.com",
          userId: "assigned-user",
          userMappingStatus: "mapped",
        },
      ],
    });

    expect(result.failed).toEqual([
      {
        userId: "assigned-user",
        code: "insert_failed",
        message:
          "Failed to record AI notification decision (rfi_assigned): db unavailable",
      },
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[rfi-notify] AI notification decision failed",
      expect.objectContaining({
        projectId: 25125,
        rfiId: "rfi-1",
        failed: [
          {
            userId: "assigned-user",
            code: "insert_failed",
            message:
              "Failed to record AI notification decision (rfi_assigned): db unavailable",
          },
        ],
      }),
    );
  });
});
