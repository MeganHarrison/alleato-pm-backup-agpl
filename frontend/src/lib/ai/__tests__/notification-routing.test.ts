import { routeAiNotification } from "@/lib/ai/notification-routing";

describe("AI notification routing", () => {
  it("routes overdue RFIs as interruptions through Teams, in-app, and digest", () => {
    const decision = routeAiNotification({
      eventType: "rfi_overdue",
      severity: "high",
    });

    expect(decision).toMatchObject({
      tier: "interrupt",
      requiredAction: "Respond, reassign, escalate, or close the RFI.",
    });
    expect(decision.channels).toEqual(["teams", "in_app", "digest"]);
    expect(decision.failureLoudBehavior).toContain("delivery failures");
  });

  it("routes memory updates quietly to avoid interruption noise", () => {
    const decision = routeAiNotification({
      eventType: "ai_memory_updated",
    });

    expect(decision.tier).toBe("quiet");
    expect(decision.channels).toEqual(["quiet_inbox"]);
    expect(decision.reason).toContain("not an interruption");
  });

  it("downgrades low-confidence AI risk signals to quiet review", () => {
    const decision = routeAiNotification({
      eventType: "teams_project_risk",
      sourceConfidence: 0.42,
    });

    expect(decision.tier).toBe("quiet");
    expect(decision.channels).toEqual(["quiet_inbox", "page_activity"]);
    expect(decision.preferenceOverrideReason).toBe(
      "Low-confidence AI signal routes quietly until reviewed or corroborated.",
    );
  });

  it("suppresses Teams for non-critical events when preferences require urgent-only Teams", () => {
    const decision = routeAiNotification({
      eventType: "rfi_assigned",
      severity: "normal",
      preferenceHints: { urgentOnlyTeams: true },
    });

    expect(decision.channels).toEqual(["in_app"]);
    expect(decision.preferenceOverrideReason).toBe(
      "Teams delivery suppressed by preference; in-app visibility retained.",
    );
  });

  it("keeps Teams for critical events even when urgent-only Teams is enabled", () => {
    const decision = routeAiNotification({
      eventType: "submittal_overdue",
      severity: "critical",
      preferenceHints: { urgentOnlyTeams: true },
    });

    expect(decision.channels).toEqual(["teams", "in_app"]);
    expect(decision.preferenceOverrideReason).toBe(
      "Critical severity keeps Teams routing enabled.",
    );
  });

  it("falls back loudly when Teams recipient is not linked", () => {
    const decision = routeAiNotification({
      eventType: "rfi_assigned",
      teamsRecipientLinked: false,
    });

    expect(decision.channels).toEqual(["in_app", "admin_system_queue"]);
    expect(decision.preferenceOverrideReason).toBe(
      "Teams recipient is not linked; routed to in-app and admin/system queue.",
    );
  });

  it("delivery failures always interrupt through in-app, widget, and admin queue", () => {
    const decision = routeAiNotification({
      eventType: "ai_memory_updated",
      hasDeliveryFailure: true,
      preferenceHints: { preferDigest: true, suppressTeams: true },
    });

    expect(decision.tier).toBe("interrupt");
    expect(decision.channels).toEqual([
      "in_app",
      "assistant_widget",
      "admin_system_queue",
    ]);
    expect(decision.preferenceOverrideReason).toContain(
      "Delivery failure overrides quiet routing",
    );
  });

  it("adds the assistant widget when the user is on the related page", () => {
    const decision = routeAiNotification({
      eventType: "ai_change_event_awaiting_approval",
      isUserOnRelatedPage: true,
    });

    expect(decision.channels).toEqual([
      "in_app",
      "assistant_widget",
    ]);
  });
});
