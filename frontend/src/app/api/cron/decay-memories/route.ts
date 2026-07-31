/**
 * POST /api/cron/decay-memories
 *
 * Weekly cron job that:
 *   1. Decays importance/confidence on stale facts and lessons
 *   2. Expires context memories past their TTL
 *
 * Secured via CRON_SECRET env var (set in Vercel and call with Authorization header).
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/decay-memories", "schedule": "0 4 * * 0" }] }
 */

import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { logEvent } from "@/lib/guardrails/observability";

export const POST = withApiGuardrails("/api/cron/decay-memories#POST", async ({ request, requestId }) => {
  // OWASP A07:2021 - Identification and Authentication Failures:
  // Always require CRON_SECRET; never skip validation when env var is unset.
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/cron/decay-memories#POST",
      message: "Unauthorized cron invocation.",
      status: 401,
      severity: "medium",
    });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("decay_memory_confidence");

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/cron/decay-memories#POST",
      message: "Failed to execute memory decay job.",
      details: {
        reason: error.message,
      },
      cause: error,
    });
  }

  const result = data?.[0] ?? { decayed_count: 0, expired_count: 0 };
  logEvent({
    event: "background_job_completed",
    requestId,
    where: "/api/cron/decay-memories#POST",
    details: {
      decayed: result.decayed_count,
      expired: result.expired_count,
    },
  });

  return NextResponse.json({
    success: true,
    decayed: result.decayed_count,
    expired: result.expired_count,
    runAt: new Date().toISOString(),
  });
});

// Vercel cron invocations are HTTP GET (vercel.com/docs/cron-jobs); auth still requires CRON_SECRET.
export const GET = POST;
