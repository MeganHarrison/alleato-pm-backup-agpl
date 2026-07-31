jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import { recordAiNotificationDecision } from "@/lib/ai/notification-decision-ledger";

const mockedCreateServiceClient = jest.mocked(createServiceClient);

function createClientMock({
  existing = null,
  existingError = null,
  insertError = null,
}: {
  existing?: { id: string } | null;
  existingError?: { message: string } | null;
  insertError?: { message: string } | null;
} = {}) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: existing,
    error: existingError,
  });
  const limit = jest.fn(() => ({ maybeSingle }));
  const isDeleted = jest.fn(() => ({ limit }));
  const eqEventKey = jest.fn(() => ({ is: isDeleted }));
  const eqKind = jest.fn(() => ({ eq: eqEventKey }));
  const eqUser = jest.fn(() => ({ eq: eqKind }));
  const select = jest.fn(() => ({ eq: eqUser }));
  const insert = jest.fn().mockResolvedValue({ error: insertError });
  const from = jest.fn(() => ({
    select,
    insert,
  }));

  mockedCreateServiceClient.mockReturnValue({ from } as never);

  return {
    from,
    select,
    eqUser,
    eqKind,
    eqEventKey,
    isDeleted,
    limit,
    maybeSingle,
    insert,
  };
}

describe("AI notification decision ledger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records a routing decision in collaboration notifications metadata", async () => {
    const client = createClientMock();

    await expect(
      recordAiNotificationDecision({
        recipientUserId: "user-1",
        eventType: "rfi_overdue",
        severity: "high",
        projectId: 25125,
        entityType: "rfis",
        entityId: "rfi-1",
        eventKey: "rfi-1-overdue",
        preview: {
          table: "rfis",
          fields: {
            subject: "Door hardware clarification",
            empty: undefined,
          },
        },
      }),
    ).resolves.toMatchObject({
      status: "recorded",
      decision: {
        tier: "interrupt",
        channels: ["teams", "in_app", "digest"],
      },
    });

    expect(client.eqEventKey).toHaveBeenCalledWith(
      "metadata->>eventKey",
      "rfi-1-overdue",
    );
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        project_id: 25125,
        entity_type: "rfis",
        entity_id: "rfi-1",
        kind: "ai_notification_decision",
        title: "AI notification decision: rfi overdue",
        body: "Respond, reassign, escalate, or close the RFI.",
        metadata: expect.objectContaining({
          source: "ai_notification_routing",
          eventKey: "rfi-1-overdue",
          eventType: "rfi_overdue",
          severity: "high",
          tier: "interrupt",
          channelsSelected: ["teams", "in_app", "digest"],
          channelsSent: [],
          channelsFailed: [],
          channelsSkipped: [],
          preview: {
            table: "rfis",
            fields: {
              subject: "Door hardware clarification",
            },
          },
          ledgerOnly: true,
        }),
      }),
    );
  });

  it("skips duplicate decisions with the same event key", async () => {
    createClientMock({
      existing: { id: "notification-1" },
    });

    await expect(
      recordAiNotificationDecision({
        recipientUserId: "user-1",
        eventType: "ai_memory_updated",
        eventKey: "memory-1-updated",
      }),
    ).resolves.toMatchObject({
      status: "skipped_duplicate",
      existingId: "notification-1",
    });
  });

  it("returns typed failure when duplicate lookup fails", async () => {
    createClientMock({
      existingError: { message: "metadata index unavailable" },
    });

    await expect(
      recordAiNotificationDecision({
        recipientUserId: "user-1",
        eventType: "ai_memory_updated",
        eventKey: "memory-1-updated",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: {
        code: "duplicate_lookup_failed",
        message:
          "Failed to check existing AI notification decision (ai_memory_updated): metadata index unavailable",
      },
    });
  });

  it("returns typed failure when insert fails", async () => {
    createClientMock({
      insertError: { message: "insert denied" },
    });

    await expect(
      recordAiNotificationDecision({
        recipientUserId: "user-1",
        eventType: "delivery_failure",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: {
        code: "insert_failed",
        message:
          "Failed to record AI notification decision (delivery_failure): insert denied",
      },
    });
  });

  it("does not touch Supabase when recipient is missing", async () => {
    const result = await recordAiNotificationDecision({
      recipientUserId: " ",
      eventType: "rfi_assigned",
    });

    expect(result).toMatchObject({
      status: "failed",
      error: {
        code: "missing_recipient",
        message: "AI notification decisions require a recipient user ID.",
      },
    });
    expect(mockedCreateServiceClient).not.toHaveBeenCalled();
  });
});
