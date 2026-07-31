/**
 * POST /api/cron/check-feedback-github-health
 *
 * Proactively verifies the feedback → GitHub pipeline can still create issues.
 * Both the admin-feedback form AND the Velt comments path create issues via the
 * same `createGitHubIssue()` helper, so a single under-scoped/expired token
 * silently breaks BOTH at once (feedback is still saved, but no issue is filed).
 *
 * This is the guardrail for that failure class: it probes the token's
 * Issues:write permission WITHOUT creating an issue (see
 * probeFeedbackIssueWritePermission) and, on failure, logs an error and posts a
 * Teams alert so the outage is caught within the cron window instead of by a
 * user hitting the form.
 *
 * Secured via CRON_SECRET env var (set in Vercel).
 * Vercel cron schedule: every 6 hours.
 */

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { logEvent } from "@/lib/guardrails/observability";
import { logger } from "@/lib/logger";
import { probeFeedbackIssueWritePermission } from "@/lib/admin-feedback/github";
import { notifyTeamsFeedbackAlert } from "@/lib/admin-feedback/teams-webhook";

export const maxDuration = 30;

const FAILURE_MESSAGES: Record<string, string> = {
  not_configured:
    "GITHUB_FEEDBACK_TOKEN / owner / repo is not configured — no issues will be created.",
  invalid_credentials:
    "GitHub rejected the feedback token (401). It is likely expired — regenerate GITHUB_FEEDBACK_TOKEN.",
  insufficient_permissions:
    "The feedback token can read the repo but CANNOT create issues (403). Regenerate the fine-grained PAT with 'Issues: Read and write'.",
  repo_not_found:
    "The configured feedback repo/owner was not found (404). Check GITHUB_FEEDBACK_REPO_OWNER / GITHUB_FEEDBACK_REPO_NAME.",
  unknown: "The feedback token failed an unexpected GitHub check.",
};

export const POST = withApiGuardrails(
  "/api/cron/check-feedback-github-health#POST",
  async ({ request, requestId }) => {
    const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/cron/check-feedback-github-health#POST",
        message: "Unauthorized cron invocation.",
        status: 401,
        severity: "medium",
      });
    }

    const health = await probeFeedbackIssueWritePermission();

    if (health.ok) {
      logEvent({
        event: "background_job_completed",
        requestId,
        where: "/api/cron/check-feedback-github-health#POST",
        details: { healthy: true },
      });
      return NextResponse.json({ success: true, healthy: true });
    }

    const message = FAILURE_MESSAGES[health.code] ?? FAILURE_MESSAGES.unknown;

    // Fail loudly: an error log (surfaced in monitoring) + a Teams ping.
    logger.error({
      msg: "[cron/check-feedback-github-health] feedback GitHub pipeline is DOWN",
      data: { code: health.code, status: health.status, details: health.details },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const teamsResult = await notifyTeamsFeedbackAlert({
      requestId,
      title: "⚠️ Feedback → GitHub pipeline is down",
      detail: `${message}\n\nFeedback and comments are still being saved, but no GitHub issues are being created until this is fixed. (probe: ${health.code}${health.status ? ` / HTTP ${health.status}` : ""})`,
      inboxUrl: appUrl ? `${appUrl}/feedback-inbox` : undefined,
    });

    logEvent({
      event: "background_job_completed",
      requestId,
      where: "/api/cron/check-feedback-github-health#POST",
      details: { healthy: false, code: health.code, teamsAlert: teamsResult.ok },
    });

    return NextResponse.json({
      success: true,
      healthy: false,
      code: health.code,
      status: health.status,
      teamsAlerted: teamsResult.ok,
    });
  },
);

// Vercel cron invocations are HTTP GET (vercel.com/docs/cron-jobs); auth still requires CRON_SECRET.
export const GET = POST;
