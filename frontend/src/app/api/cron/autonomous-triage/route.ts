/**
 * POST /api/cron/autonomous-triage
 *
 * Scores stuck `agent_learnings` candidates with a cheap model and auto-applies
 * a gated action (promote / archive / keep), then reports the run to Teams.
 * See `lib/ai/services/autonomous-triage.ts` for the safety model.
 *
 * Secured via CRON_SECRET. Gated behind AUTONOMOUS_TRIAGE_ENABLED (default off).
 * Pass `?dryRun=1` to score + report without writing any status change.
 *
 * Vercel cron schedule: "0 2 * * *" (daily 2am UTC, before daily-flags at 6am).
 */

import { NextResponse } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { logEvent } from "@/lib/guardrails/observability";
import { runAutonomousTriage } from "@/lib/ai/services/autonomous-triage";

export const maxDuration = 300;

export const POST = withApiGuardrails(
  "/api/cron/autonomous-triage#POST",
  async ({ request, requestId }) => {
    const cronSecret = request.headers
      .get("authorization")
      ?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/cron/autonomous-triage#POST",
        message: "Unauthorized cron invocation.",
        status: 401,
        severity: "medium",
      });
    }

    if (process.env.AUTONOMOUS_TRIAGE_ENABLED !== "true") {
      return NextResponse.json({ success: true, skipped: "feature_disabled" });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const result = await runAutonomousTriage({ dryRun });

    logEvent({
      event: "background_job_completed",
      requestId,
      where: "/api/cron/autonomous-triage#POST",
      details: {
        dry_run: result.dryRun,
        scanned: result.scanned,
        promoted: result.promoted,
        archived: result.archived,
        kept: result.kept,
        scoring_failed: result.scoringFailed,
        remaining_candidates: result.remainingCandidates,
        pending_human_promotions: result.pendingHumanPromotions,
        teams_sent: result.teamsSent,
      },
    });

    return NextResponse.json({ success: true, ...result });
  },
);

// Vercel cron invocations are HTTP GET (vercel.com/docs/cron-jobs); auth still requires CRON_SECRET.
export const GET = POST;
