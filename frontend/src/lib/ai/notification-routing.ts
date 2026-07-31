export type AiNotificationEventType =
  | "rfi_overdue"
  | "rfi_due_soon"
  | "rfi_assigned"
  | "submittal_overdue"
  | "submittal_rejected"
  | "submittal_ai_conflict"
  | "ai_change_event_awaiting_approval"
  | "ai_commitment_awaiting_approval"
  | "client_report_ready_to_send"
  | "outlook_email_requires_response"
  | "teams_project_risk"
  | "delivery_failure"
  | "source_sync_failure"
  | "ai_memory_updated"
  | "leadership_context_added"
  | "comment_added"
  | "routine_sync_completed";

export type AiNotificationSeverity = "low" | "normal" | "high" | "critical";

export type AiNotificationChannel =
  | "in_app"
  | "assistant_widget"
  | "teams"
  | "outlook_email"
  | "quiet_inbox"
  | "digest"
  | "page_activity"
  | "admin_system_queue";

export type AiNotificationTier = "interrupt" | "quiet" | "digest" | "system";

export type AiNotificationPreferenceHints = {
  suppressTeams?: boolean;
  preferDigest?: boolean;
  urgentOnlyTeams?: boolean;
};

export type AiNotificationRoutingInput = {
  eventType: AiNotificationEventType;
  severity?: AiNotificationSeverity;
  sourceConfidence?: number | null;
  preferenceHints?: AiNotificationPreferenceHints;
  teamsRecipientLinked?: boolean;
  isUserOnRelatedPage?: boolean;
  hasDeliveryFailure?: boolean;
};

export type AiNotificationRoutingDecision = {
  tier: AiNotificationTier;
  channels: AiNotificationChannel[];
  requiredAction: string;
  reason: string;
  failureLoudBehavior: string;
  preferenceOverrideReason: string | null;
};

type RoutingRule = {
  tier: AiNotificationTier;
  channels: AiNotificationChannel[];
  requiredAction: string;
  reason: string;
  failureLoudBehavior: string;
};

const ROUTING_RULES: Record<AiNotificationEventType, RoutingRule> = {
  rfi_overdue: {
    tier: "interrupt",
    channels: ["teams", "in_app", "digest"],
    requiredAction: "Respond, reassign, escalate, or close the RFI.",
    reason: "RFI is overdue and may block design or schedule decisions.",
    failureLoudBehavior: "Record delivery failures and keep the RFI badge visible.",
  },
  rfi_due_soon: {
    tier: "interrupt",
    channels: ["in_app", "assistant_widget", "digest"],
    requiredAction: "Respond or confirm the response plan.",
    reason: "RFI is due within the configured action window.",
    failureLoudBehavior: "If Teams is suppressed, keep in-app visibility.",
  },
  rfi_assigned: {
    tier: "interrupt",
    channels: ["in_app", "teams"],
    requiredAction: "Open the RFI and respond or accept ownership.",
    reason: "The user owns the next action.",
    failureLoudBehavior: "If Teams recipient is not linked, fall back to in-app and log the skip.",
  },
  submittal_overdue: {
    tier: "interrupt",
    channels: ["teams", "in_app"],
    requiredAction: "Review, respond, or reassign the submittal.",
    reason: "Submittal review is overdue and may block procurement or field work.",
    failureLoudBehavior: "Keep overdue state visible until resolved.",
  },
  submittal_rejected: {
    tier: "interrupt",
    channels: ["teams", "in_app"],
    requiredAction: "Review rejection, assign next step, and resubmit if needed.",
    reason: "Returned or rejected submittal needs corrective action.",
    failureLoudBehavior: "Log failed delivery and preserve the page alert.",
  },
  submittal_ai_conflict: {
    tier: "interrupt",
    channels: ["teams", "in_app", "page_activity"],
    requiredAction: "Review the AI finding and decide whether to create follow-up work.",
    reason: "AI found a possible spec, drawing, or material mismatch.",
    failureLoudBehavior: "Link source evidence and mark source readiness.",
  },
  ai_change_event_awaiting_approval: {
    tier: "interrupt",
    channels: ["in_app", "assistant_widget"],
    requiredAction: "Approve, edit, or discard the AI-created change event draft.",
    reason: "AI-created draft needs human decision before it becomes record truth.",
    failureLoudBehavior: "Keep draft visible with source and owner.",
  },
  ai_commitment_awaiting_approval: {
    tier: "interrupt",
    channels: ["in_app", "teams"],
    requiredAction: "Confirm vendor, dates, line items, and total before commit.",
    reason: "Commitment or SOV draft is a high-risk financial write.",
    failureLoudBehavior: "Keep Commit disabled until required confirmations complete.",
  },
  client_report_ready_to_send: {
    tier: "interrupt",
    channels: ["in_app", "teams"],
    requiredAction: "Review recipients and content, then send or revise.",
    reason: "Client-facing communication needs review before delivery.",
    failureLoudBehavior: "Delivery state must show sent, failed, skipped, or blocked.",
  },
  outlook_email_requires_response: {
    tier: "interrupt",
    channels: ["teams", "in_app", "assistant_widget"],
    requiredAction: "Draft a reply, assign ownership, or dismiss with reason.",
    reason: "External communication risk needs timely response.",
    failureLoudBehavior: "Preserve email source link and classification reason.",
  },
  teams_project_risk: {
    tier: "interrupt",
    channels: ["teams", "in_app", "assistant_widget"],
    requiredAction: "Convert to RFI, task, change event, or dismiss with reason.",
    reason: "Teams message contains a project risk or blocker.",
    failureLoudBehavior: "Store source message and confidence.",
  },
  delivery_failure: {
    tier: "interrupt",
    channels: ["in_app", "assistant_widget", "admin_system_queue"],
    requiredAction: "Retry, change channel, or mark delivery skipped.",
    reason: "The user may think someone was notified when delivery failed.",
    failureLoudBehavior: "Expose failed channel and provider error.",
  },
  source_sync_failure: {
    tier: "system",
    channels: ["admin_system_queue", "in_app"],
    requiredAction: "Fix sync/provider state or mark affected source stale.",
    reason: "AI may be missing current evidence for decisions.",
    failureLoudBehavior: "AI answers must disclose stale or missing source state.",
  },
  ai_memory_updated: {
    tier: "quiet",
    channels: ["quiet_inbox"],
    requiredAction: "Review in AI Profile or Memory Center if needed.",
    reason: "Memory update is transparency context, not an interruption.",
    failureLoudBehavior: "Keep memory source and edit/delete path visible.",
  },
  leadership_context_added: {
    tier: "quiet",
    channels: ["quiet_inbox"],
    requiredAction: "Review AI Profile timeline and audit metadata.",
    reason: "User should know, but this usually should not interrupt.",
    failureLoudBehavior: "Show source, author, visibility, and audit trail.",
  },
  comment_added: {
    tier: "quiet",
    channels: ["quiet_inbox", "page_activity"],
    requiredAction: "Review when working that record.",
    reason: "Comment is informational unless tied to direct ownership or urgency.",
    failureLoudBehavior: "Keep record timeline updated.",
  },
  routine_sync_completed: {
    tier: "system",
    channels: ["admin_system_queue"],
    requiredAction: "No user action required.",
    reason: "Routine sync completion should not create user noise.",
    failureLoudBehavior: "Keep system history inspectable.",
  },
};

function uniqueChannels(
  channels: AiNotificationChannel[],
): AiNotificationChannel[] {
  return Array.from(new Set(channels));
}

function isCritical(severity: AiNotificationSeverity | undefined) {
  return severity === "critical" || severity === "high";
}

export function routeAiNotification(
  input: AiNotificationRoutingInput,
): AiNotificationRoutingDecision {
  const rule = ROUTING_RULES[input.eventType];
  const severity = input.severity ?? "normal";
  let tier = rule.tier;
  let channels = [...rule.channels];
  let preferenceOverrideReason: string | null = null;

  if (
    input.sourceConfidence !== null &&
    input.sourceConfidence !== undefined &&
    input.sourceConfidence < 0.5 &&
    input.eventType !== "delivery_failure"
  ) {
    tier = "quiet";
    channels = ["quiet_inbox", "page_activity"];
    preferenceOverrideReason =
      "Low-confidence AI signal routes quietly until reviewed or corroborated.";
  }

  if (input.hasDeliveryFailure || input.eventType === "delivery_failure") {
    tier = "interrupt";
    channels = ["in_app", "assistant_widget", "admin_system_queue"];
    preferenceOverrideReason =
      "Delivery failure overrides quiet routing because the sender may believe notification succeeded.";
  }

  if (input.preferenceHints?.preferDigest && tier === "quiet") {
    channels = ["digest"];
    preferenceOverrideReason =
      "User preference downgraded quiet notification to digest.";
  }

  if (
    input.preferenceHints?.suppressTeams ||
    (input.preferenceHints?.urgentOnlyTeams && !isCritical(severity))
  ) {
    channels = channels.filter((channel) => channel !== "teams");
    if (rule.channels.includes("teams")) {
      channels.push("in_app");
      preferenceOverrideReason =
        "Teams delivery suppressed by preference; in-app visibility retained.";
    }
  }

  if (isCritical(severity) && rule.channels.includes("teams")) {
    channels.push("teams");
    preferenceOverrideReason =
      preferenceOverrideReason ??
      "Critical severity keeps Teams routing enabled.";
  }

  if (input.teamsRecipientLinked === false) {
    channels = channels.filter((channel) => channel !== "teams");
    channels.push("in_app", "admin_system_queue");
    preferenceOverrideReason =
      "Teams recipient is not linked; routed to in-app and admin/system queue.";
  }

  if (input.isUserOnRelatedPage && tier === "interrupt") {
    channels.push("assistant_widget");
  }

  return {
    tier,
    channels: uniqueChannels(channels),
    requiredAction: rule.requiredAction,
    reason: rule.reason,
    failureLoudBehavior: rule.failureLoudBehavior,
    preferenceOverrideReason,
  };
}
