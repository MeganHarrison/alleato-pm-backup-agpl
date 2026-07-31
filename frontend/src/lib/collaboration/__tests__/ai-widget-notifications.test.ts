import {
  getFirstUnreadAiWidgetNotificationDraft,
  getAiWidgetNotificationMetadata,
  getUnreadAiApprovalDecisionNotifications,
  getUnreadAiWidgetNotifications,
  isAiWidgetNotificationKind,
} from "../ai-widget-notifications";

describe("ai widget collaboration notifications", () => {
  it("accepts only durable AI widget notification kinds", () => {
    expect(isAiWidgetNotificationKind("ai_assistant_welcome")).toBe(true);
    expect(isAiWidgetNotificationKind("ai_action_ready")).toBe(true);
    expect(isAiWidgetNotificationKind("ai_notification_decision")).toBe(true);
    expect(isAiWidgetNotificationKind("rfi_attention")).toBe(true);

    expect(isAiWidgetNotificationKind("comment")).toBe(false);
    expect(isAiWidgetNotificationKind("ai_assistant")).toBe(false);
    expect(isAiWidgetNotificationKind("change_request_review_needed")).toBe(
      false,
    );
    expect(isAiWidgetNotificationKind("")).toBe(false);
  });

  it("filters unread AI widget notifications without matching read or unrelated rows", () => {
    const notifications = [
      { id: "1", kind: "comment", readAt: null },
      { id: "2", kind: "ai_action_ready", readAt: "2026-06-25T00:00:00Z" },
      { id: "3", kind: "ai_action_ready", readAt: null },
      { id: "4", kind: "rfi_attention", readAt: null },
      {
        id: "5",
        kind: "ai_notification_decision",
        readAt: null,
        metadata: {
          eventType: "delivery_failure",
          tier: "interrupt",
          channelsSelected: ["assistant_widget"],
        },
      },
    ];

    expect(getUnreadAiWidgetNotifications(notifications)).toEqual([
      notifications[2],
      notifications[3],
      notifications[4],
    ]);
  });

  it("normalizes optional metadata and drops invalid values", () => {
    expect(
      getAiWidgetNotificationMetadata({
        prompt: "  Draft a change event. ",
        actionLabel: " Open assistant ",
        source: " collaboration_notifications ",
        eventType: " ai_memory_updated ",
        requiredAction: " Open the assistant. ",
        tier: " quiet ",
        ignored: "value",
      }),
    ).toEqual({
      prompt: "Draft a change event.",
      actionLabel: "Open assistant",
      source: "collaboration_notifications",
      eventType: "ai_memory_updated",
      requiredAction: "Open the assistant.",
      tier: "quiet",
    });

    expect(
      getAiWidgetNotificationMetadata({
        prompt: " ",
        actionLabel: 42,
        source: null,
      }),
    ).toEqual({});
    expect(getAiWidgetNotificationMetadata(null)).toEqual({});
    expect(getAiWidgetNotificationMetadata(["not", "object"])).toEqual({});
  });

  it("selects the first unread AI widget draft with a valid prompt", () => {
    const notifications = [
      {
        id: "1",
        kind: "ai_action_ready",
        readAt: null,
        metadata: { prompt: " " },
      },
      {
        id: "2",
        kind: "comment",
        readAt: null,
        metadata: { prompt: "Ignore unrelated notifications." },
      },
      {
        id: "3",
        kind: "rfi_attention",
        readAt: null,
        metadata: {
          prompt: " Review this RFI draft. ",
          actionLabel: " Review draft ",
          source: " collaboration_notifications ",
        },
      },
      {
        id: "4",
        kind: "ai_action_ready",
        readAt: null,
        metadata: { prompt: "Second valid prompt." },
      },
    ];

    expect(getFirstUnreadAiWidgetNotificationDraft(notifications)).toEqual({
      id: "3",
      prompt: "Review this RFI draft.",
      actionLabel: "Review draft",
      source: "collaboration_notifications",
    });
  });

  it("does not surface legacy change request review drafts in the widget", () => {
    const notifications = [
      {
        id: "1",
        kind: "change_request_review_needed",
        readAt: null,
        metadata: {
          prompt: "Review this change request draft.",
          actionLabel: "Review draft",
          source: "createChangeEvent.preview",
        },
      },
    ];

    expect(getUnreadAiWidgetNotifications(notifications)).toEqual([]);
    expect(getFirstUnreadAiWidgetNotificationDraft(notifications)).toBeNull();
  });

  it("generates a contextual prompt for widget-selected AI notification decisions", () => {
    const notifications = [
      {
        id: "1",
        kind: "ai_notification_decision",
        title: "AI delivery failed",
        body: "Teams notification could not be delivered.",
        readAt: null,
        metadata: {
          eventType: "delivery_failure",
          tier: "interrupt",
          channelsSelected: ["in_app", "assistant_widget"],
          requiredAction: "Retry delivery or choose another notification channel.",
          source: "ai_notification_routing",
        },
      },
    ];

    expect(getFirstUnreadAiWidgetNotificationDraft(notifications)).toEqual({
      id: "1",
      prompt:
        "Review this AI update: Retry delivery or choose another notification channel.",
      source: "ai_notification_routing",
    });
  });

  it("does not return quiet AI decisions as widget-visible notifications or drafts", () => {
    const notifications = [
      {
        id: "1",
        kind: "ai_notification_decision",
        title: "AI memory saved",
        body: "Megan prefers preview-first approvals.",
        readAt: null,
        metadata: {
          eventType: "ai_memory_updated",
          tier: "quiet",
          channelsSelected: ["quiet_inbox"],
          requiredAction: "Review in AI profile when convenient.",
        },
      },
    ];

    expect(getUnreadAiWidgetNotifications(notifications)).toEqual([]);
    expect(getFirstUnreadAiWidgetNotificationDraft(notifications)).toBeNull();
  });

  it("returns interrupting AI decisions when assistant_widget is selected", () => {
    const notifications = [
      {
        id: "1",
        kind: "ai_notification_decision",
        title: "Email needs response",
        body: "External request needs an owner.",
        readAt: null,
        metadata: {
          eventType: "delivery_failure",
          tier: "interrupt",
          channelsSelected: ["in_app", "assistant_widget"],
          requiredAction: "Draft a reply or assign ownership.",
        },
      },
    ];

    expect(getUnreadAiWidgetNotifications(notifications)).toEqual([
      notifications[0],
    ]);
    expect(getFirstUnreadAiWidgetNotificationDraft(notifications)).toEqual({
      id: "1",
      prompt: "Review this AI update: Draft a reply or assign ownership.",
      actionLabel: undefined,
      source: undefined,
    });
  });

  it("identifies unread AI approval decisions that need the review queue", () => {
    const notifications = [
      {
        id: "1",
        kind: "ai_notification_decision",
        readAt: null,
        metadata: { eventType: "ai_change_event_awaiting_approval" },
      },
      {
        id: "2",
        kind: "ai_notification_decision",
        readAt: "2026-06-26T00:00:00Z",
        metadata: { eventType: "ai_commitment_awaiting_approval" },
      },
      {
        id: "3",
        kind: "ai_notification_decision",
        readAt: null,
        metadata: { eventType: "ai_memory_updated" },
      },
      {
        id: "4",
        kind: "ai_action_ready",
        readAt: null,
        metadata: { eventType: "ai_change_event_awaiting_approval" },
      },
    ];

    expect(getUnreadAiApprovalDecisionNotifications(notifications)).toEqual([
      notifications[0],
    ]);
  });

  it("does not turn unread approval queue decisions into chat drafts", () => {
    expect(
      getFirstUnreadAiWidgetNotificationDraft([
        {
          id: "1",
          kind: "ai_notification_decision",
          title: "Change request ready",
          body: "Review before submitting.",
          readAt: null,
          metadata: {
            eventType: "ai_change_event_awaiting_approval",
            prompt: "Review this in the assistant.",
            requiredAction: "Open the approvals queue.",
          },
        },
        {
          id: "2",
          kind: "ai_action_ready",
          readAt: null,
          metadata: { prompt: "Open the regular assistant action." },
        },
      ]),
    ).toEqual({
      id: "2",
      prompt: "Open the regular assistant action.",
      actionLabel: undefined,
      source: undefined,
    });
  });

  it("keeps explicit widget prompts ahead of generated AI decision prompts", () => {
    const notifications = [
      {
        id: "1",
        kind: "ai_notification_decision",
        title: "AI memory saved",
        body: "Megan prefers preview-first approvals.",
        readAt: null,
        metadata: {
          eventType: "delivery_failure",
          tier: "interrupt",
          channelsSelected: ["assistant_widget"],
          prompt: "Show me what changed in my AI profile.",
          requiredAction: "Review the saved memory before using it.",
        },
      },
    ];

    expect(getFirstUnreadAiWidgetNotificationDraft(notifications)).toEqual({
      id: "1",
      prompt: "Show me what changed in my AI profile.",
      actionLabel: undefined,
      source: undefined,
    });
  });

  it("skips malformed AI decision rows without usable prompt content", () => {
    expect(
      getFirstUnreadAiWidgetNotificationDraft([
        {
          id: "1",
          kind: "ai_notification_decision",
          readAt: null,
          metadata: { requiredAction: 42 },
        },
      ]),
    ).toBeNull();
  });

  it("does not create a draft from read, unrelated, or malformed notifications", () => {
    expect(
      getFirstUnreadAiWidgetNotificationDraft([
        {
          id: "1",
          kind: "ai_action_ready",
          readAt: "2026-06-25T00:00:00Z",
          metadata: { prompt: "Already read." },
        },
        {
          id: "2",
          kind: "comment",
          readAt: null,
          metadata: { prompt: "Wrong channel." },
        },
        {
          id: "3",
          kind: "ai_action_ready",
          readAt: null,
          metadata: { prompt: 42 },
        },
      ]),
    ).toBeNull();
  });
});
