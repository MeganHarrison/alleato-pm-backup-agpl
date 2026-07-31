/**
 * Microsoft Teams webhook notifier for admin feedback submissions.
 *
 * Sends an Adaptive Card to a Power Automate "Post to a channel when a
 * webhook request is received" Workflow URL. This is the modern replacement
 * for the deprecated Office 365 connector incoming-webhook format.
 *
 * Configuration:
 *   TEAMS_FEEDBACK_WEBHOOK_URL — Workflow URL from Teams (https://*.logic.azure.com/...)
 *
 * Failure mode: returns `{ ok: false, reason }`. NEVER throws. Feedback
 * submission must not block on Teams delivery — the inbox is the source of
 * truth, the Teams ping is a nicety.
 */

import { fetchWithGuardrails, WRITE_POLICY } from "@/lib/fetch-with-guardrails";
import { logger } from "@/lib/logger";
import type {
  AdminFeedbackRequestType,
  AdminFeedbackSeverity,
} from "./constants";
import { ADMIN_FEEDBACK_REQUEST_TYPE_LABELS } from "./constants";

type NotifyInput = {
  requestId: string;
  feedbackId: string;
  title: string;
  comment: string;
  requestType: AdminFeedbackRequestType;
  severity: AdminFeedbackSeverity;
  pageUrl: string;
  pagePath: string;
  pageTitle: string | null;
  screenshotUrl: string | null;
  videoRecordingUrl: string | null;
  submitterEmail: string | null;
  submitterName: string | null;
  githubIssueUrl: string | null;
  inboxUrl: string;
};

type NotifyResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "send_failed"; details?: string };

const SEVERITY_COLORS: Record<AdminFeedbackSeverity, string> = {
  high: "Attention",
  medium: "Accent",
  low: "Good",
};

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function buildAdaptiveCardPayload(input: NotifyInput) {
  const facts: { title: string; value: string }[] = [
    { title: "Type", value: ADMIN_FEEDBACK_REQUEST_TYPE_LABELS[input.requestType] },
    { title: "Severity", value: input.severity },
    {
      title: "Submitted by",
      value: input.submitterName ?? input.submitterEmail ?? "Unknown",
    },
    { title: "Page", value: input.pageTitle ?? input.pagePath },
  ];

  const actions: Record<string, unknown>[] = [
    {
      type: "Action.OpenUrl",
      title: "Open in feedback inbox",
      url: input.inboxUrl,
    },
    {
      type: "Action.OpenUrl",
      title: "Open page",
      url: input.pageUrl,
    },
  ];

  if (input.githubIssueUrl) {
    actions.push({
      type: "Action.OpenUrl",
      title: "GitHub issue",
      url: input.githubIssueUrl,
    });
  }

  if (input.videoRecordingUrl) {
    actions.push({
      type: "Action.OpenUrl",
      title: "Watch screen recording",
      url: input.videoRecordingUrl,
    });
  }

  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      size: "Large",
      weight: "Bolder",
      text: truncate(input.title, 140),
      wrap: true,
      color: SEVERITY_COLORS[input.severity] ?? "Default",
    },
    {
      type: "TextBlock",
      text: truncate(input.comment, 600),
      wrap: true,
      spacing: "Small",
    },
    {
      type: "FactSet",
      facts,
    },
  ];

  if (input.screenshotUrl) {
    body.push({
      type: "Image",
      url: input.screenshotUrl,
      size: "Large",
      altText: "Screenshot attached to feedback",
    });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
          actions,
        },
      },
    ],
  };
}

/**
 * Sends a plain operational alert to the feedback Teams channel. Used by the
 * feedback-github-health cron to shout when the GitHub feedback pipeline is
 * broken (e.g. the token lost Issues:write) so it is caught proactively
 * instead of by a user hitting the form. Never throws.
 */
export async function notifyTeamsFeedbackAlert(input: {
  requestId: string;
  title: string;
  detail: string;
  inboxUrl?: string;
}): Promise<NotifyResult> {
  const webhookUrl = process.env.TEAMS_FEEDBACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { ok: false, reason: "not_configured" };
  }

  const actions = input.inboxUrl
    ? [{ type: "Action.OpenUrl", title: "Open feedback inbox", url: input.inboxUrl }]
    : [];

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              color: "Attention",
              text: truncate(input.title, 140),
              wrap: true,
            },
            {
              type: "TextBlock",
              text: truncate(input.detail, 600),
              wrap: true,
              spacing: "Small",
            },
          ],
          actions,
        },
      },
    ],
  };

  try {
    const response = await fetchWithGuardrails(webhookUrl, {
      method: "POST",
      requestId: input.requestId,
      where: "admin-feedback/teams-webhook-alert",
      dependency: "teams-webhook",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: WRITE_POLICY.timeoutMs,
      retries: 0,
    });
    if (!response.ok) {
      return { ok: false, reason: "send_failed", details: `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "send_failed",
      details: error instanceof Error ? error.message : "unknown",
    };
  }
}

export async function notifyTeamsWebhook(input: NotifyInput): Promise<NotifyResult> {
  const webhookUrl = process.env.TEAMS_FEEDBACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "https:") {
      return {
        ok: false,
        reason: "send_failed",
        details: "TEAMS_FEEDBACK_WEBHOOK_URL must use https://",
      };
    }
  } catch {
    return {
      ok: false,
      reason: "send_failed",
      details: "TEAMS_FEEDBACK_WEBHOOK_URL is not a valid URL",
    };
  }

  const payload = buildAdaptiveCardPayload(input);

  try {
    const response = await fetchWithGuardrails(webhookUrl, {
      method: "POST",
      requestId: input.requestId,
      where: "admin-feedback/teams-webhook",
      dependency: "teams-webhook",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: WRITE_POLICY.timeoutMs,
      retries: 0,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.warn({
        msg: "[teams-webhook] non-2xx response",
        data: {
          status: response.status,
          feedbackId: input.feedbackId,
          detail: detail.slice(0, 500),
        },
      });
      return { ok: false, reason: "send_failed", details: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    logger.warn({
      msg: "[teams-webhook] delivery failed",
      data: {
        feedbackId: input.feedbackId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      ok: false,
      reason: "send_failed",
      details: error instanceof Error ? error.message : "unknown",
    };
  }
}
