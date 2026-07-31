import { getRun } from "workflow/api";

import { durableApiError } from "@/lib/ai/durable-chat.server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const WHERE = "durable-ai/chat/[runId]/status#GET";

export const GET = withApiGuardrails<{ runId: string }>(
  WHERE,
  async ({ params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      return durableApiError({
        status: 401,
        code: "AUTH_REQUIRED",
        message: "Authentication is required to inspect a durable AI run.",
        where: WHERE,
      });
    }

    const { runId } = params;
    const { data: turn, error } = await serviceDb
      .from("durable_ai_turns")
      .select(
        "id, session_id, status, stage, error_message, created_at, started_at, completed_at",
      )
      .eq("workflow_run_id", runId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !turn) {
      return durableApiError({
        status: error ? 500 : 404,
        code: error ? "RUN_STATUS_LOOKUP_FAILED" : "DURABLE_RUN_NOT_FOUND",
        message: error
          ? `Durable run status lookup failed: ${error.message}`
          : "This workflow run does not exist or is not owned by the current user.",
        where: WHERE,
        runId,
      });
    }

    const run = getRun(runId);
    const workflowStatus = (await run.exists) ? await run.status : "missing";
    return Response.json({
      runId,
      turnId: turn.id,
      sessionId: turn.session_id,
      ledgerStatus: turn.status,
      workflowStatus,
      stage: turn.stage,
      error: turn.error_message,
      createdAt: turn.created_at,
      startedAt: turn.started_at,
      completedAt: turn.completed_at,
    });
  },
);
