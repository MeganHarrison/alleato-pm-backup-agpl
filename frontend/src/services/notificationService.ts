import { randomUUID } from "crypto";

import { sendProactiveTeamsDM } from "@/lib/bot/teams-proactive";
import { serviceDb } from "@/lib/supabase/service-db";
import type {
  AiWidgetNotificationKind,
  AiWidgetNotificationMetadata,
} from "@/lib/collaboration/ai-widget-notifications";

type UserTarget = string | string[];

type BasePayload = {
  projectId?: number;
  entityType?: string;
  entityId?: string;
};

export type CriticalIssueData = BasePayload & {
  severity?: string;
  summary?: string;
};

export type DeadlineData = BasePayload & {
  dueDate?: string;
  title?: string;
};

export type StatusChangeData = BasePayload & {
  from?: string;
  to?: string;
};

export type BudgetAlertData = BasePayload & {
  alertType?: string;
  amount?: number;
};

export type WeeklyDigestData = BasePayload & {
  totalOpenItems?: number;
};

export type AssignmentData = BasePayload & {
  assignee?: string;
};

export type ApprovalRequestData = BasePayload & {
  requester?: string;
};

export type BallInCourtData = BasePayload & {
  rfiNumber?: string;
};

export type AiWidgetNotificationData = BasePayload & {
  kind: AiWidgetNotificationKind;
  title: string;
  body?: string | null;
  prompt: string;
  actionLabel?: string | null;
  source?: string | null;
  actorId?: string | null;
  eventKey?: string | null;
};

export type RfiReviewNeededData = BasePayload & {
  subject: string;
  question: string;
  ballInCourt?: string | null;
  dueDate?: string | null;
  costImpact?: string | null;
  scheduleImpact?: string | null;
  eventKey?: string | null;
};

export type NotificationKind =
  | "$criticalIssue"
  | "$deadline"
  | "$statusChange"
  | "$budgetAlert"
  | "$weeklyDigest"
  | "$assignment"
  | "$approvalRequest"
  | "$ballInCourt";

type AnyActivityData =
  | CriticalIssueData
  | DeadlineData
  | StatusChangeData
  | BudgetAlertData
  | WeeklyDigestData
  | AssignmentData
  | ApprovalRequestData
  | BallInCourtData;

function toArray(target: UserTarget): string[] {
  return Array.isArray(target) ? target : [target];
}

function describeKind(kind: NotificationKind): { title: string; body: string } {
  switch (kind) {
    case "$criticalIssue":
      return {
        title: "Critical issue",
        body: "A critical issue needs attention.",
      };
    case "$deadline":
      return {
        title: "Deadline approaching",
        body: "A tracked item is due soon.",
      };
    case "$statusChange":
      return {
        title: "Status changed",
        body: "A tracked record changed status.",
      };
    case "$budgetAlert":
      return {
        title: "Budget alert",
        body: "A budget threshold was triggered.",
      };
    case "$weeklyDigest":
      return {
        title: "Weekly digest",
        body: "Your weekly project summary is ready.",
      };
    case "$assignment":
      return { title: "Assignment", body: "You were assigned to a record." };
    case "$approvalRequest":
      return {
        title: "Approval requested",
        body: "A record requires your approval.",
      };
    case "$ballInCourt":
      return {
        title: "Ball in court",
        body: "Ownership has shifted to your queue.",
      };
    default:
      return { title: "Notification", body: "You have a new update." };
  }
}

function cleanOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildAiWidgetNotificationMetadata(
  data: AiWidgetNotificationData,
): AiWidgetNotificationMetadata & {
  eventKey?: string;
  projectId?: number;
  entityType?: string;
  entityId?: string;
} {
  const prompt = cleanOptionalText(data.prompt);
  if (!prompt) {
    throw new Error(
      "AI widget notifications require a non-empty metadata.prompt.",
    );
  }

  return {
    prompt,
    actionLabel: cleanOptionalText(data.actionLabel),
    source: cleanOptionalText(data.source) ?? "collaboration_notifications",
    eventKey: cleanOptionalText(data.eventKey),
    projectId: data.projectId,
    entityType: cleanOptionalText(data.entityType),
    entityId: cleanOptionalText(data.entityId),
  };
}

export function buildRfiReviewPrompt(data: RfiReviewNeededData): string {
  const lines = [
    "Review this RFI draft and help me revise it or confirm it before creating it.",
    "",
    `Project ID: ${data.projectId ?? "not selected"}`,
    `Subject: ${data.subject}`,
    `Question: ${data.question}`,
    `Ball in court: ${data.ballInCourt?.trim() || "Not provided"}`,
    `Due date: ${data.dueDate?.trim() || "Not provided"}`,
    `Cost impact: ${data.costImpact?.trim() || "tbd"}`,
    `Schedule impact: ${data.scheduleImpact?.trim() || "tbd"}`,
    "",
    "If anything is missing, ask for it. If it is ready, show the preview and wait for my explicit confirmation before creating it.",
  ];

  return lines.join("\n");
}

export async function notifyAiWidgetNotification(
  userId: UserTarget,
  data: AiWidgetNotificationData,
): Promise<{ created: number; skipped: number }> {
  const title = cleanOptionalText(data.title);
  if (!title) {
    throw new Error("AI widget notifications require a non-empty title.");
  }

  const metadata = buildAiWidgetNotificationMetadata(data);
  const users = toArray(userId);
  let created = 0;
  let skipped = 0;

  for (const uid of users) {
    if (metadata.eventKey) {
      const { data: existing, error: existingError } = await serviceDb
        .from("collaboration_notifications")
        .select("id")
        .eq("user_id", uid)
        .eq("kind", data.kind)
        .eq("metadata->>eventKey", metadata.eventKey)
        .is("read_at", null)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw new Error(
          `Failed to check existing AI widget notification (${data.kind}): ${existingError.message}`,
        );
      }

      if (existing) {
        skipped += 1;
        continue;
      }
    }

    const { error } = await serviceDb
      .from("collaboration_notifications")
      .insert({
        user_id: uid,
        actor_id: data.actorId ?? null,
        project_id: data.projectId ?? null,
        entity_type: data.entityType ?? null,
        entity_id: data.entityId ?? null,
        kind: data.kind,
        title,
        body: cleanOptionalText(data.body) ?? null,
        metadata,
      });

    if (error) {
      throw new Error(
        `Failed to create AI widget notification (${data.kind}): ${error.message}`,
      );
    }

    created += 1;
  }

  return { created, skipped };
}

export async function notifyRfiReviewNeeded(
  userId: UserTarget,
  data: RfiReviewNeededData,
): Promise<{ created: number; skipped: number }> {
  return notifyAiWidgetNotification(userId, {
    kind: "rfi_attention",
    title: "RFI ready for review",
    body: data.subject,
    projectId: data.projectId,
    entityType: "rfis",
    prompt: buildRfiReviewPrompt(data),
    actionLabel: "Review RFI",
    source: "createRFI.preview",
    eventKey: data.eventKey,
  });
}

async function notifyUsers(
  userId: UserTarget,
  kind: NotificationKind,
  data: AnyActivityData,
) {
  const users = toArray(userId);
  const descriptor = describeKind(kind);

  const { error } = await serviceDb.from("collaboration_notifications").insert(
    users.map((uid) => ({
      user_id: uid,
      project_id: data.projectId ?? null,
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
      kind,
      title: descriptor.title,
      body: descriptor.body,
      metadata: {
        ...data,
        eventKey: randomUUID(),
      },
    })),
  );

  if (error) {
    throw new Error(
      `Failed to create notifications (${kind}): ${error.message}`,
    );
  }

  // 2. Teams DM fan-out (fire-and-forget — never blocks the main notification path)
  for (const uid of users) {
    sendProactiveTeamsDM(
      uid,
      `**${descriptor.title}**\n${descriptor.body}`,
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[notificationService] teams DM failed", {
        userId: uid,
        kind,
        error: msg,
      });
    });
  }
}

export async function notifyCriticalIssue(
  userId: UserTarget,
  data: CriticalIssueData,
) {
  await notifyUsers(userId, "$criticalIssue", data);
}

export async function notifyDeadline(userId: UserTarget, data: DeadlineData) {
  await notifyUsers(userId, "$deadline", data);
}

export async function notifyStatusChange(
  userId: UserTarget,
  data: StatusChangeData,
) {
  await notifyUsers(userId, "$statusChange", data);
}

export async function notifyBudgetAlert(
  userId: UserTarget,
  data: BudgetAlertData,
) {
  await notifyUsers(userId, "$budgetAlert", data);
}

export async function notifyWeeklyDigest(
  userId: UserTarget,
  data: WeeklyDigestData,
) {
  await notifyUsers(userId, "$weeklyDigest", data);
}

export async function notifyAssignment(
  userId: UserTarget,
  data: AssignmentData,
) {
  await notifyUsers(userId, "$assignment", data);
}

export async function notifyApprovalRequest(
  userId: UserTarget,
  data: ApprovalRequestData,
) {
  await notifyUsers(userId, "$approvalRequest", data);
}

export async function notifyBallInCourt(
  userId: UserTarget,
  data: BallInCourtData,
) {
  await notifyUsers(userId, "$ballInCourt", data);
}

export async function notifyProjectTeam(
  memberUserIds: string[],
  kind: NotificationKind,
  data: AnyActivityData,
) {
  await notifyUsers(memberUserIds, kind, data);
}
