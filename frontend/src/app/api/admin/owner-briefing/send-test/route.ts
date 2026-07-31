export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/owner-briefing/send-test
 *
 * Deprecated compatibility endpoint. The previous implementation queried
 * daily_recaps and sent Teams messages directly, bypassing the canonical Daily
 * Brief delivery kill switch. Keep this route loud so old callers get a ledger
 * row and an actionable error, but do not generate, query, or deliver here.
 */

import { NextResponse } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import {
  completeDailyBriefRun,
  failDailyBriefRun,
  recordDeliveryAttempt,
  sourceHealthForDeliveryResult,
  startDailyBriefRun,
} from "@/lib/ai-ops/executive-daily-brief-ledger";

const WHERE = "/api/admin/owner-briefing/send-test#POST";
const CANONICAL_ROUTE = "/api/executive/daily-brief/send-teams";

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const cronSecret = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Unauthorized.",
      status: 401,
      severity: "medium",
    });
  }

  const runContext = await startDailyBriefRun({
    eventType: "teams_event",
    triggerType: "deprecated_admin_owner_briefing_send_test",
    surface: "admin_owner_briefing_send_test",
    title: "Deprecated owner briefing admin test send",
    userGoal:
      "Send a test Executive Daily Brief Teams message to one recipient.",
    normalizedGoal:
      "Block the deprecated test-send route and direct callers to the canonical AI Ops delivery gateway.",
    deliveryTarget: {
      channel: "teams",
      deprecated: true,
      canonicalRoute: CANONICAL_ROUTE,
    },
    payload: { deprecatedRoute: WHERE, canonicalRoute: CANONICAL_ROUTE },
  });

  const blockedResult = {
    ok: false as const,
    status: "blocked" as const,
    reason:
      "Deprecated admin owner briefing test-send route is blocked. Use /api/executive/daily-brief/send-teams with dryRun=true for test delivery so the kill switch, source policy, provider response, and delivery attempts stay in the canonical AI Ops gateway.",
  };

  try {
    await recordDeliveryAttempt(runContext, {
      channel: "teams",
      status: "blocked",
      failureCode: "DEPRECATED_DAILY_BRIEF_TEST_SEND_BLOCKED",
      failureMessage: blockedResult.reason,
      retryable: false,
      metadata: { deprecatedRoute: WHERE, canonicalRoute: CANONICAL_ROUTE },
    });
    await completeDailyBriefRun(runContext, {
      status: "skipped",
      deliveryStatus: "blocked",
      resultSummary: blockedResult.reason,
      deliveryTarget: {
        channel: "teams",
        deprecated: true,
        canonicalRoute: CANONICAL_ROUTE,
      },
      sourceCounts: {},
      sourceHealth: sourceHealthForDeliveryResult(blockedResult),
      metadata: { deprecatedRoute: WHERE, canonicalRoute: CANONICAL_ROUTE },
    });
  } catch (error) {
    await failDailyBriefRun(
      runContext,
      error,
      "DEPRECATED_DAILY_BRIEF_TEST_SEND_LEDGER_FAILED",
    );
    throw error;
  }

  return NextResponse.json(
    {
      ok: false,
      status: "blocked",
      reason: blockedResult.reason,
      canonicalRoute: CANONICAL_ROUTE,
      runId: runContext.runId,
    },
    { status: 410 },
  );
});
