/**
 * POST /api/cron/attribution-rules
 *
 * Scheduled job that mines recent manual project assignments (recorded as
 * `ai_feedback_events` with event_family "attribution") for recurring
 * sender-domain / sender-email / title-keyword → project patterns and creates
 * `attribution_rule` learning promotions.
 *
 * IMPORTANT: this only creates promotions in `status = "candidate"`. Rules are
 * NEVER auto-activated — an admin still approves + applies them in the
 * /ai-learning-promotions review queue before they affect auto-matching.
 *
 * Secured via CRON_SECRET. Registered in frontend/vercel.json:
 *   { "path": "/api/cron/attribution-rules", "schedule": "0 8 * * 1" }
 */

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { logEvent } from "@/lib/guardrails/observability";
import { generateAttributionRulePromotionCandidates } from "@/lib/ai/services/feedback-event-service";

const WHERE = "/api/cron/attribution-rules#POST";

export const POST = withApiGuardrails(WHERE, async ({ request, requestId }) => {
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Unauthorized cron invocation.",
      status: 401,
      severity: "medium",
    });
  }

  const result = await generateAttributionRulePromotionCandidates({
    windowDays: 60,
    minSignals: 3,
    dryRun: false,
  });

  logEvent({
    event: "background_job_completed",
    requestId,
    where: WHERE,
    details: {
      inspectedRows: result.inspectedRows,
      candidatesFound: result.candidatesFound,
      candidatesCreated: result.candidatesCreated,
    },
  });

  return NextResponse.json({
    success: true,
    inspectedRows: result.inspectedRows,
    candidatesFound: result.candidatesFound,
    candidatesCreated: result.candidatesCreated,
    candidatesSkipped: result.candidatesSkipped,
    runAt: new Date().toISOString(),
  });
});

// Vercel cron invocations are HTTP GET (vercel.com/docs/cron-jobs); auth still requires CRON_SECRET.
export const GET = POST;
