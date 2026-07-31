import { randomUUID } from "node:crypto";

import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { getRun, start } from "workflow/api";

import {
  durableApiError,
  durableConversationBelongsToUser,
} from "@/lib/ai/durable-chat.server";
import { isDurableStartLeaseExpired } from "@/lib/ai/durable-chat";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { durableAiChatWorkflow } from "@/workflows/durable-ai-chat/workflow";
import type { Json } from "@/types/database.types";

export const maxDuration = 300;

const WHERE = "durable-ai/chat#POST";

type DurableChatBody = {
  id?: unknown;
  messages?: unknown;
  selectedProjectId?: unknown;
  clientMessageId?: unknown;
};

function isUiMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "assistant") &&
    Array.isArray(record.parts)
  );
}

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function streamResponse(args: {
  runId: string;
  turnId: string;
  stream: ReadableStream<UIMessageChunk>;
}) {
  return createUIMessageStreamResponse({
    stream: args.stream,
    headers: {
      "x-workflow-run-id": args.runId,
      "x-durable-turn-id": args.turnId,
    },
  });
}

type UIMessageChunk = import("ai").UIMessageChunk;

export async function POST(request: Request) {
  const user = await getApiRouteUser();
  if (!user) {
    return durableApiError({
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Authentication is required to run the durable AI assistant.",
      where: WHERE,
    });
  }

  let body: DurableChatBody;
  try {
    body = (await request.json()) as DurableChatBody;
  } catch {
    return durableApiError({
      status: 400,
      code: "INVALID_JSON",
      message: "The durable AI request body is not valid JSON.",
      where: WHERE,
    });
  }

  const sessionId = typeof body.id === "string" ? body.id : "";
  const messages = Array.isArray(body.messages)
    ? body.messages.filter(isUiMessage)
    : [];
  const latestMessage = messages.at(-1);
  const clientMessageId =
    typeof body.clientMessageId === "string" && body.clientMessageId
      ? body.clientMessageId
      : latestMessage?.id;
  const selectedProjectId =
    typeof body.selectedProjectId === "number" &&
    Number.isInteger(body.selectedProjectId)
      ? body.selectedProjectId
      : null;

  if (!sessionId || !latestMessage || !clientMessageId) {
    return durableApiError({
      status: 400,
      code: "INVALID_CHAT_REQUEST",
      message:
        "A durable conversation ID, client message ID, and message history are required.",
      where: WHERE,
    });
  }
  const ownership = await durableConversationBelongsToUser({
    sessionId,
    userId: user.id,
  });
  if (ownership.error) {
    return durableApiError({
      status: 500,
      code: "DURABLE_CONVERSATION_AUTHORIZATION_FAILED",
      message: `Durable conversation ownership lookup failed: ${ownership.error}`,
      where: WHERE,
    });
  }
  if (!ownership.belongs) {
    return durableApiError({
      status: 404,
      code: "DURABLE_CONVERSATION_NOT_FOUND",
      message:
        "This durable AI conversation does not exist or is not owned by the current user.",
      where: WHERE,
    });
  }

  const { data: acceptedTurn, error: acceptError } = await serviceDb
    .from("durable_ai_turns")
    .insert({
      user_id: user.id,
      session_id: sessionId,
      client_message_id: clientMessageId,
      status: "accepted",
      stage: "accepted",
    })
    .select("id")
    .single();

  let turnId: string;
  if (acceptError || !acceptedTurn) {
    if (acceptError?.code !== "23505") {
      return durableApiError({
        status: 500,
        code: "TURN_ACCEPT_FAILED",
        message: `The durable turn ledger rejected the request: ${acceptError?.message ?? "no ledger row was returned"}`,
        where: WHERE,
      });
    }

    const { data: existingTurn, error: existingError } = await serviceDb
      .from("durable_ai_turns")
      .select("id, workflow_run_id, status, stage, error_message, updated_at")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .eq("client_message_id", clientMessageId)
      .single();
    if (existingError || !existingTurn) {
      return durableApiError({
        status: 500,
        code: "TURN_REPLAY_LOOKUP_FAILED",
        message: `The duplicate turn was detected but its run could not be loaded: ${existingError?.message ?? "missing ledger row"}`,
        where: WHERE,
      });
    }
    if (existingTurn.status === "failed") {
      return durableApiError({
        status: 409,
        code: "DURABLE_RUN_FAILED",
        message:
          existingTurn.error_message ?? "The durable workflow run failed.",
        where: WHERE,
        runId: existingTurn.workflow_run_id,
        stage: existingTurn.stage,
      });
    }
    if (existingTurn.workflow_run_id) {
      const existingRun = getRun(existingTurn.workflow_run_id);
      return streamResponse({
        runId: existingTurn.workflow_run_id,
        turnId: existingTurn.id,
        stream: existingRun.readable as ReadableStream<UIMessageChunk>,
      });
    }

    if (!isDurableStartLeaseExpired(existingTurn.updated_at)) {
      return durableApiError({
        status: 409,
        code: "TURN_START_IN_PROGRESS",
        message:
          "This turn is still inside its workflow-start lease. Retry this same message after 30 seconds; its idempotency key prevents a duplicate turn.",
        where: WHERE,
        stage: existingTurn.stage,
      });
    }

    const reclaimedAt = new Date().toISOString();
    const { data: reclaimedTurn, error: reclaimError } = await serviceDb
      .from("durable_ai_turns")
      .update({
        stage: "workflow-start-reclaimed",
        updated_at: reclaimedAt,
      })
      .eq("id", existingTurn.id)
      .is("workflow_run_id", null)
      .eq("updated_at", existingTurn.updated_at)
      .select("id")
      .maybeSingle();
    if (reclaimError) {
      return durableApiError({
        status: 500,
        code: "TURN_START_RECLAIM_FAILED",
        message: `The accepted turn could not reclaim its expired workflow-start lease: ${reclaimError.message}`,
        where: WHERE,
        stage: existingTurn.stage,
      });
    }
    if (!reclaimedTurn) {
      return durableApiError({
        status: 409,
        code: "TURN_START_RECLAIMED_ELSEWHERE",
        message:
          "Another request reclaimed this turn's workflow-start lease. Retry the same message to reconnect to its run.",
        where: WHERE,
        stage: existingTurn.stage,
      });
    }
    turnId = reclaimedTurn.id;
  } else {
    turnId = acceptedTurn.id;
  }

  if (latestMessage.role === "user") {
    const userHistoryId = turnId;
    const { error: userMessageError } = await serviceDb
      .from("chat_history")
      .upsert(
        {
          id: userHistoryId,
          session_id: sessionId,
          user_id: user.id,
          role: "user",
          content: textFromMessage(latestMessage),
          metadata: {
            surface: "durable_ai",
            durable_turn_id: turnId,
            client_message_id: clientMessageId,
            ui_message: latestMessage,
          } as unknown as Json,
        },
        { onConflict: "id" },
      );
    if (userMessageError) {
      await serviceDb
        .from("durable_ai_turns")
        .update({
          status: "failed",
          stage: "user-persistence",
          error_message: userMessageError.message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", turnId);
      return durableApiError({
        status: 500,
        code: "USER_MESSAGE_PERSIST_FAILED",
        message: `The user message was not persisted: ${userMessageError.message}`,
        where: WHERE,
        stage: "user-persistence",
      });
    }
    const { error: userLinkError } = await serviceDb
      .from("durable_ai_turns")
      .update({
        user_message_id: userHistoryId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", turnId);
    if (userLinkError) {
      const failedAt = new Date().toISOString();
      const { error: failureRecordError } = await serviceDb
        .from("durable_ai_turns")
        .update({
          status: "failed",
          stage: "user-message-link",
          error_message: userLinkError.message,
          completed_at: failedAt,
          updated_at: failedAt,
        })
        .eq("id", turnId)
        .is("workflow_run_id", null);
      return durableApiError({
        status: 500,
        code: "USER_MESSAGE_LINK_FAILED",
        message: `The user message was saved but could not be linked to its durable turn: ${userLinkError.message}${failureRecordError ? `; recording the terminal turn failure also failed: ${failureRecordError.message}` : ""}`,
        where: WHERE,
        stage: "user-message-link",
      });
    }
  }

  const assistantHistoryId = randomUUID();
  try {
    const run = await start(durableAiChatWorkflow, [
      {
        turnId,
        userId: user.id,
        sessionId,
        assistantHistoryId,
        selectedProjectId,
        messages,
      },
    ]);
    const queuedAt = new Date().toISOString();
    const { data: attachedTurn, error: runUpdateError } = await serviceDb
      .from("durable_ai_turns")
      .update({
        workflow_run_id: run.runId,
        status: "running",
        stage: "queued",
        started_at: queuedAt,
        updated_at: queuedAt,
      })
      .eq("id", turnId)
      .is("workflow_run_id", null)
      .select("id")
      .maybeSingle();
    if (runUpdateError) {
      throw new Error(
        `The workflow started but its run ID could not be persisted: ${runUpdateError.message}`,
      );
    }
    if (!attachedTurn) {
      const { data: claimedTurn, error: claimLookupError } = await serviceDb
        .from("durable_ai_turns")
        .select("workflow_run_id")
        .eq("id", turnId)
        .single();
      if (claimLookupError || !claimedTurn?.workflow_run_id) {
        throw new Error(
          `The workflow started but its turn claim could not be verified: ${claimLookupError?.message ?? "missing run ID"}`,
        );
      }
      if (claimedTurn.workflow_run_id !== run.runId) {
        const claimedRun = getRun(claimedTurn.workflow_run_id);
        return streamResponse({
          runId: claimedTurn.workflow_run_id,
          turnId,
          stream: claimedRun.readable as ReadableStream<UIMessageChunk>,
        });
      }
    }

    return streamResponse({
      runId: run.runId,
      turnId,
      stream: run.readable as ReadableStream<UIMessageChunk>,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { data: failedTurn } = await serviceDb
      .from("durable_ai_turns")
      .update({
        status: "failed",
        stage: "workflow-start",
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", turnId)
      .is("workflow_run_id", null)
      .select("id")
      .maybeSingle();
    if (!failedTurn) {
      const { data: claimedTurn } = await serviceDb
        .from("durable_ai_turns")
        .select("workflow_run_id")
        .eq("id", turnId)
        .maybeSingle();
      if (claimedTurn?.workflow_run_id) {
        const claimedRun = getRun(claimedTurn.workflow_run_id);
        return streamResponse({
          runId: claimedTurn.workflow_run_id,
          turnId,
          stream: claimedRun.readable as ReadableStream<UIMessageChunk>,
        });
      }
    }
    return durableApiError({
      status: 500,
      code: "WORKFLOW_START_FAILED",
      message,
      where: WHERE,
      stage: "workflow-start",
    });
  }
}
