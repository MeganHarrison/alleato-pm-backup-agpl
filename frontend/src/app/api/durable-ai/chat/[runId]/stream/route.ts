import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { getRun } from "workflow/api";

import { getDurableReconnectDisposition } from "@/lib/ai/durable-chat";
import { durableApiError } from "@/lib/ai/durable-chat.server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

export const maxDuration = 300;

const WHERE = "durable-ai/chat/[runId]/stream#GET";

export const GET = withApiGuardrails<{ runId: string }>(
  WHERE,
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      return durableApiError({
        status: 401,
        code: "AUTH_REQUIRED",
        message: "Authentication is required to reconnect to a durable AI run.",
        where: WHERE,
      });
    }

    const { runId } = params;
    const { data: turn, error } = await serviceDb
      .from("durable_ai_turns")
      .select("id, status, stage, error_message")
      .eq("workflow_run_id", runId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return durableApiError({
        status: 500,
        code: "RUN_AUTHORIZATION_FAILED",
        message: `Durable run authorization failed: ${error.message}`,
        where: WHERE,
        runId,
      });
    }
    if (!turn) {
      return durableApiError({
        status: 404,
        code: "DURABLE_RUN_NOT_FOUND",
        message:
          "This workflow run does not exist or is not owned by the current user.",
        where: WHERE,
        runId,
      });
    }
    const disposition = getDurableReconnectDisposition(turn.status);
    if (disposition === "complete") {
      return new Response(null, {
        status: 204,
        headers: {
          "x-workflow-run-id": runId,
          "x-durable-turn-id": turn.id,
        },
      });
    }
    if (disposition === "failed") {
      return durableApiError({
        status: 409,
        code: "DURABLE_RUN_FAILED",
        message: turn.error_message ?? "The durable workflow run failed.",
        where: WHERE,
        runId,
        stage: turn.stage,
      });
    }

    const rawStartIndex = new URL(request.url).searchParams.get("startIndex");
    const parsedStartIndex =
      rawStartIndex == null ? undefined : Number(rawStartIndex);
    if (parsedStartIndex !== undefined && !Number.isInteger(parsedStartIndex)) {
      return durableApiError({
        status: 400,
        code: "INVALID_STREAM_INDEX",
        message: "The workflow stream startIndex must be an integer.",
        where: WHERE,
        runId,
      });
    }

    const run = getRun(runId);
    if (!(await run.exists)) {
      return durableApiError({
        status: 404,
        code: "WORKFLOW_RUN_MISSING",
        message:
          "The turn ledger exists, but Vercel Workflow cannot find its run. The run ID is preserved for diagnosis.",
        where: WHERE,
        runId,
        stage: turn.stage,
      });
    }
    const readable = run.getReadable({ startIndex: parsedStartIndex });
    const tailIndex = await readable.getTailIndex();

    return createUIMessageStreamResponse({
      stream: readable as ReadableStream<UIMessageChunk>,
      headers: {
        "x-workflow-run-id": runId,
        "x-durable-turn-id": turn.id,
        "x-workflow-stream-tail-index": String(tailIndex),
      },
    });
  },
);
