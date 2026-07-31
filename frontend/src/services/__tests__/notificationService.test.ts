jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/bot/teams-proactive", () => ({
  sendProactiveTeamsDM: jest.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import {
  buildAiWidgetNotificationMetadata,
  buildRfiReviewPrompt,
  notifyAiWidgetNotification,
  notifyRfiReviewNeeded,
} from "../notificationService";

const mockedCreateServiceClient = jest.mocked(createServiceClient);

function createNotificationClientMock({
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
  const isRead = jest.fn(() => ({ is: isDeleted }));
  const eqEventKey = jest.fn(() => ({ is: isRead }));
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
    isRead,
    isDeleted,
    limit,
    maybeSingle,
    insert,
  };
}

describe("AI widget notification producer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes metadata and requires a usable prompt", () => {
    expect(
      buildAiWidgetNotificationMetadata({
        kind: "ai_action_ready",
        title: "Ready",
        prompt: "  Review this draft. ",
        actionLabel: " Open ",
        source: " createChangeEvent.preview ",
        projectId: 43,
        entityType: "change_events",
        eventKey: " key-1 ",
      }),
    ).toEqual({
      prompt: "Review this draft.",
      actionLabel: "Open",
      source: "createChangeEvent.preview",
      eventKey: "key-1",
      projectId: 43,
      entityType: "change_events",
      entityId: undefined,
    });

    expect(() =>
      buildAiWidgetNotificationMetadata({
        kind: "ai_action_ready",
        title: "Ready",
        prompt: " ",
      }),
    ).toThrow("AI widget notifications require a non-empty metadata.prompt.");
  });

  it("creates an unread collaboration notification with prompt metadata", async () => {
    const client = createNotificationClientMock();

    await expect(
      notifyAiWidgetNotification("user-1", {
        kind: "ai_action_ready",
        title: "Assistant action ready",
        body: "Review the draft.",
        prompt: "Review the draft and confirm before writing.",
        actionLabel: "Review draft",
        source: "unit-test",
        projectId: 43,
        entityType: "change_events",
        eventKey: "event-1",
      }),
    ).resolves.toEqual({ created: 1, skipped: 0 });

    expect(client.eqEventKey).toHaveBeenCalledWith(
      "metadata->>eventKey",
      "event-1",
    );
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        project_id: 43,
        entity_type: "change_events",
        kind: "ai_action_ready",
        title: "Assistant action ready",
        body: "Review the draft.",
        metadata: expect.objectContaining({
          prompt: "Review the draft and confirm before writing.",
          actionLabel: "Review draft",
          source: "unit-test",
          eventKey: "event-1",
          projectId: 43,
          entityType: "change_events",
        }),
      }),
    );
  });

  it("skips duplicate unread notifications with the same event key", async () => {
    const client = createNotificationClientMock({
      existing: { id: "notification-1" },
    });

    await expect(
      notifyAiWidgetNotification("user-1", {
        kind: "ai_action_ready",
        title: "Assistant action ready",
        prompt: "Review the draft.",
        eventKey: "event-1",
      }),
    ).resolves.toEqual({ created: 0, skipped: 1 });

    expect(client.insert).not.toHaveBeenCalled();
  });

  it("throws actionable errors when duplicate lookup or insert fails", async () => {
    createNotificationClientMock({
      existingError: { message: "metadata index unavailable" },
    });

    await expect(
      notifyAiWidgetNotification("user-1", {
        kind: "ai_action_ready",
        title: "Assistant action ready",
        prompt: "Review the draft.",
        eventKey: "event-1",
      }),
    ).rejects.toThrow(
      "Failed to check existing AI widget notification (ai_action_ready): metadata index unavailable",
    );

    const client = createNotificationClientMock({
      insertError: { message: "insert denied" },
    });

    await expect(
      notifyAiWidgetNotification("user-1", {
        kind: "ai_action_ready",
        title: "Assistant action ready",
        prompt: "Review the draft.",
      }),
    ).rejects.toThrow(
      "Failed to create AI widget notification (ai_action_ready): insert denied",
    );
    expect(client.select).not.toHaveBeenCalled();
  });

  it("builds RFI review notifications for the widget composer", async () => {
    const client = createNotificationClientMock();

    await expect(
      notifyRfiReviewNeeded("user-1", {
        projectId: 25125,
        subject: "RFI - Delayed Electrical Rough-in",
        question: "Please clarify delayed electrical rough-in.",
        costImpact: "tbd",
        scheduleImpact: "tbd",
        eventKey: "rfi-preview-1",
      }),
    ).resolves.toEqual({ created: 1, skipped: 0 });

    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        project_id: 25125,
        entity_type: "rfis",
        kind: "rfi_attention",
        title: "RFI ready for review",
        body: "RFI - Delayed Electrical Rough-in",
        metadata: expect.objectContaining({
          actionLabel: "Review RFI",
          source: "createRFI.preview",
          eventKey: "rfi-preview-1",
          prompt: expect.stringContaining(
            "RFI - Delayed Electrical Rough-in",
          ),
        }),
      }),
    );
  });

  it("renders RFI review prompts with required draft fields", () => {
    expect(
      buildRfiReviewPrompt({
        projectId: 25125,
        subject: "RFI - Delayed Electrical Rough-in",
        question: "Please clarify delayed electrical rough-in.",
      }),
    ).toContain("Question: Please clarify delayed electrical rough-in.");
  });
});
