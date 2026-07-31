import {
  getAiNotificationDeliveryPlan,
  shouldInterruptAiWidget,
} from "../ai-notification-routing";

describe("AI notification routing", () => {
  it("routes approval decisions as interrupting approval queue items", () => {
    const notification = {
      id: "1",
      kind: "ai_notification_decision",
      readAt: null,
      metadata: { eventType: "ai_change_event_awaiting_approval" },
    };

    expect(getAiNotificationDeliveryPlan(notification)).toEqual({
      tier: "interrupt",
      channels: ["approvals_queue", "in_app", "assistant_widget"],
      reason: "AI decision requires human review before a business action proceeds.",
    });
    expect(shouldInterruptAiWidget(notification)).toBe(true);
  });

  it("does not interrupt the widget when selected channels omit assistant_widget", () => {
    const notification = {
      id: "1b",
      kind: "ai_notification_decision",
      readAt: null,
      metadata: {
        eventType: "ai_commitment_awaiting_approval",
        tier: "interrupt",
        channelsSelected: ["in_app", "teams"],
      },
    };

    expect(getAiNotificationDeliveryPlan(notification)).toEqual({
      tier: "interrupt",
      channels: ["approvals_queue", "in_app", "teams"],
      reason: "AI decision requires human review before a business action proceeds.",
    });
    expect(shouldInterruptAiWidget(notification)).toBe(false);
  });

  it("keeps memory and profile updates quiet by default", () => {
    const notification = {
      id: "2",
      kind: "ai_notification_decision",
      readAt: null,
      metadata: { eventType: "ai_memory_updated" },
    };

    expect(getAiNotificationDeliveryPlan(notification)).toEqual({
      tier: "quiet",
      channels: ["quiet_inbox"],
      reason: "Notification is useful context but does not require interruption.",
    });
    expect(shouldInterruptAiWidget(notification)).toBe(false);
  });

  it("honors explicit interrupt tier metadata", () => {
    expect(
      getAiNotificationDeliveryPlan({
        id: "3",
        kind: "ai_action_ready",
        readAt: null,
        metadata: { tier: "interrupt" },
      })?.tier,
    ).toBe("interrupt");
  });

  it("does not route legacy change request review drafts to the widget", () => {
    expect(
      getAiNotificationDeliveryPlan({
        id: "4",
        kind: "change_request_review_needed",
        readAt: null,
        metadata: { tier: "quiet", channelsSelected: ["quiet_inbox"] },
      }),
    ).toBeNull();
    expect(
      shouldInterruptAiWidget({
        id: "4",
        kind: "change_request_review_needed",
        readAt: null,
        metadata: {
          tier: "interrupt",
          channelsSelected: ["assistant_widget"],
        },
      }),
    ).toBe(false);
  });

  it("ignores non-AI notification kinds", () => {
    expect(
      getAiNotificationDeliveryPlan({
        id: "5",
        kind: "comment",
        readAt: null,
      }),
    ).toBeNull();
  });
});
