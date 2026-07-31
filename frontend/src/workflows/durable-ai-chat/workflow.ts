import {
  convertToModelMessages,
  isStepCount,
  streamText,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { getWritable, getWorkflowMetadata } from "workflow";

import { DEFAULT_AI_ASSISTANT_MODEL } from "@/lib/ai/assistant-models";
import { assembleSystemPrompt } from "@/lib/ai/bot-core";
import { createStrategistTools } from "@/lib/ai/orchestrator";
import { getLanguageModel } from "@/lib/ai/providers";
import { createAiAssistantMcpTools } from "@/lib/ai/tools/mcp-tools";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Json } from "@/types/database.types";

export type DurableAiChatInput = {
  turnId: string;
  userId: string;
  sessionId: string;
  assistantHistoryId: string;
  selectedProjectId: number | null;
  messages: UIMessage[];
};

/**
 * Runtime adaptation of Vercel's copied sequential and orchestrator workflow
 * examples: the workflow owns deterministic stage ordering, while each worker
 * function owns database, model, stream, and tool side effects.
 */

type DurableGenerationResult = {
  responseMessage: UIMessage;
  assistantText: string;
  toolTrace: Array<Record<string, unknown>>;
};

function messageText(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter(
      (part): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function markTurnRunning(turnId: string, workflowRunId: string) {
  "use step";

  const runningAt = new Date().toISOString();
  const { data: claimedTurn, error } = await serviceDb
    .from("durable_ai_turns")
    .update({
      workflow_run_id: workflowRunId,
      status: "running",
      stage: "generation",
      started_at: runningAt,
      updated_at: runningAt,
    })
    .eq("id", turnId)
    .is("workflow_run_id", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Marking durable turn running failed: ${error.message}`);
  }
  if (claimedTurn) return;

  const { data: existingTurn, error: lookupError } = await serviceDb
    .from("durable_ai_turns")
    .select("workflow_run_id")
    .eq("id", turnId)
    .single();
  if (lookupError || !existingTurn?.workflow_run_id) {
    throw new Error(
      `Durable turn claim lookup failed: ${lookupError?.message ?? "missing turn claim"}`,
    );
  }
  if (existingTurn.workflow_run_id !== workflowRunId) {
    throw new Error(
      `Durable turn ${turnId} is already owned by workflow run ${existingTurn.workflow_run_id}; refusing duplicate run ${workflowRunId}.`,
    );
  }

  const { error: refreshError } = await serviceDb
    .from("durable_ai_turns")
    .update({
      status: "running",
      stage: "generation",
      started_at: runningAt,
      updated_at: runningAt,
    })
    .eq("id", turnId)
    .eq("workflow_run_id", workflowRunId);
  if (refreshError) {
    throw new Error(
      `Refreshing durable turn ownership failed: ${refreshError.message}`,
    );
  }
}

async function generateDurableResponse(
  input: DurableAiChatInput,
  workflowRunId: string,
): Promise<DurableGenerationResult> {
  "use step";

  const writable = getWritable<UIMessageChunk>();
  const writer = writable.getWriter();
  const latestUserMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserText = messageText(latestUserMessage);
  const toolTrace: Array<Record<string, unknown>> = [];
  let mcpToolBundle: Awaited<
    ReturnType<typeof createAiAssistantMcpTools>
  > | null = null;

  try {
    mcpToolBundle = await createAiAssistantMcpTools();
    const systemPrompt = await assembleSystemPrompt({
      userId: input.userId,
      messageText: latestUserText,
      selectedProjectId: input.selectedProjectId ?? undefined,
      sessionId: input.sessionId,
      isFirstTurn:
        input.messages.filter((message) => message.role === "user").length <= 1,
      platform: "web",
    });
    const tools = createStrategistTools(input.userId, {
      pinnedProjectId: input.selectedProjectId ?? undefined,
      sessionId: input.sessionId,
      includeActionTools: true,
      generatedTaskWriteMode: "preview",
      onTrace: (trace) => toolTrace.push(trace as Record<string, unknown>),
    }) as unknown as ToolSet;
    Object.assign(tools, mcpToolBundle.tools);
    toolTrace.push(...mcpToolBundle.trace);

    const modelMessages = await convertToModelMessages(input.messages);
    let responseMessage: UIMessage | null = null;
    let streamedError: string | null = null;
    const result = streamText({
      model: getLanguageModel(DEFAULT_AI_ASSISTANT_MODEL),
      instructions: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: isStepCount(7),
    });
    const stream = result.toUIMessageStream({
      originalMessages: input.messages,
      sendSources: true,
      onError: (error) => {
        streamedError = errorMessage(error);
        return `Durable AI run ${workflowRunId} failed during generation: ${streamedError}`;
      },
      onEnd: ({ responseMessage: completedMessage }) => {
        responseMessage = completedMessage;
      },
    });
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }

    if (streamedError) {
      throw new Error(streamedError);
    }
    if (!responseMessage) {
      throw new Error("The AI stream ended without a response message.");
    }

    return {
      responseMessage,
      assistantText: messageText(responseMessage),
      toolTrace,
    };
  } finally {
    writer.releaseLock();
    await mcpToolBundle?.close();
  }
}

// This step can execute action tools. Retrying it could repeat an external side
// effect after the model or connection fails, so the canary fails loudly and
// relies on the same run's resumable stream instead of replaying the step.
generateDurableResponse.maxRetries = 0;

async function persistDurableResponse(args: {
  input: DurableAiChatInput;
  workflowRunId: string;
  result: DurableGenerationResult;
}) {
  "use step";

  const now = new Date().toISOString();
  const metadata = {
    surface: "durable_ai",
    workflow_run_id: args.workflowRunId,
    durable_turn_id: args.input.turnId,
    model: DEFAULT_AI_ASSISTANT_MODEL,
    tool_trace: args.result.toolTrace,
    ui_message: args.result.responseMessage,
  } as unknown as Json;
  const { error: messageError } = await serviceDb.from("chat_history").upsert(
    {
      id: args.input.assistantHistoryId,
      session_id: args.input.sessionId,
      user_id: args.input.userId,
      role: "assistant",
      content: args.result.assistantText,
      metadata,
    },
    { onConflict: "id" },
  );
  if (messageError) {
    throw new Error(
      `Persisting durable assistant response failed: ${messageError.message}`,
    );
  }

  const { error: conversationError } = await serviceDb
    .from("conversations")
    .update({ last_message_at: now })
    .eq("session_id", args.input.sessionId)
    .eq("user_id", args.input.userId);
  if (conversationError) {
    throw new Error(
      `Updating durable conversation timestamp failed: ${conversationError.message}`,
    );
  }

  const { error: turnError } = await serviceDb
    .from("durable_ai_turns")
    .update({
      assistant_message_id: args.input.assistantHistoryId,
      status: "completed",
      stage: "completed",
      completed_at: now,
      updated_at: now,
      error_message: null,
    })
    .eq("id", args.input.turnId)
    .eq("workflow_run_id", args.workflowRunId);
  if (turnError) {
    throw new Error(`Completing durable turn failed: ${turnError.message}`);
  }
}

async function reconcilePersistedResponse(args: {
  input: DurableAiChatInput;
  workflowRunId: string;
  persistenceError: string;
}): Promise<boolean> {
  "use step";

  const { data: assistantMessage, error: lookupError } = await serviceDb
    .from("chat_history")
    .select("id")
    .eq("id", args.input.assistantHistoryId)
    .eq("session_id", args.input.sessionId)
    .eq("user_id", args.input.userId)
    .maybeSingle();
  if (lookupError) {
    throw new Error(
      `Durable persistence recovery lookup failed: ${lookupError.message}`,
    );
  }
  if (!assistantMessage) return false;

  const now = new Date().toISOString();
  const { error: conversationError } = await serviceDb
    .from("conversations")
    .update({ last_message_at: now })
    .eq("session_id", args.input.sessionId)
    .eq("user_id", args.input.userId);
  const recoveryMessage = conversationError
    ? `${args.persistenceError}; conversation timestamp recovery failed: ${conversationError.message}`
    : `Recovered after persistence error: ${args.persistenceError}`;
  const { error: turnError } = await serviceDb
    .from("durable_ai_turns")
    .update({
      assistant_message_id: args.input.assistantHistoryId,
      status: "completed",
      stage: conversationError
        ? "completed-with-warning"
        : "completed-recovered",
      completed_at: now,
      updated_at: now,
      error_message: recoveryMessage,
    })
    .eq("id", args.input.turnId)
    .eq("workflow_run_id", args.workflowRunId);
  if (turnError) {
    throw new Error(
      `Durable persistence recovery could not reconcile the turn ledger: ${turnError.message}`,
    );
  }

  return true;
}

async function recordDurableFailure(args: {
  turnId: string;
  workflowRunId: string;
  message: string;
  stage: string;
}) {
  "use step";

  const failedAt = new Date().toISOString();
  const failure = {
    status: "failed",
    stage: args.stage,
    error_message: args.message,
    completed_at: failedAt,
    updated_at: failedAt,
  };
  const { data: ownedTurn, error } = await serviceDb
    .from("durable_ai_turns")
    .update(failure)
    .eq("id", args.turnId)
    .eq("workflow_run_id", args.workflowRunId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`Recording durable turn failure failed: ${error.message}`);
  }
  if (ownedTurn) return;

  // A run that failed before markTurnRunning claimed the row may claim only an
  // unowned turn as failed. A losing duplicate run cannot overwrite the winner.
  const { error: claimError } = await serviceDb
    .from("durable_ai_turns")
    .update({
      ...failure,
      workflow_run_id: args.workflowRunId,
      started_at: failedAt,
    })
    .eq("id", args.turnId)
    .is("workflow_run_id", null);
  if (claimError) {
    throw new Error(
      `Claiming failed durable turn ownership failed: ${claimError.message}`,
    );
  }
}

async function recordStreamCloseWarning(args: {
  turnId: string;
  workflowRunId: string;
  message: string;
}) {
  "use step";

  const { error } = await serviceDb
    .from("durable_ai_turns")
    .update({
      status: "completed",
      stage: "completed-stream-close-warning",
      error_message: args.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.turnId)
    .eq("workflow_run_id", args.workflowRunId);
  if (error) {
    throw new Error(
      `Recording durable stream-close warning failed: ${error.message}`,
    );
  }
}

async function writeDurableFailure(
  workflowRunId: string,
  stage: string,
  message: string,
) {
  "use step";

  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.write({
      type: "error",
      errorText: `Durable AI run ${workflowRunId} failed during ${stage}: ${message}`,
    });
    await writer.close();
  } finally {
    writer.releaseLock();
  }
}

async function closeDurableStream() {
  "use step";

  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.close();
  } finally {
    writer.releaseLock();
  }
}

export async function durableAiChatWorkflow(input: DurableAiChatInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  let stage = "start";

  try {
    await markTurnRunning(input.turnId, workflowRunId);
    stage = "generation";
    const result = await generateDurableResponse(input, workflowRunId);
    stage = "persistence";
    await persistDurableResponse({ input, workflowRunId, result });
    stage = "stream-close";
    await closeDurableStream();
    return { status: "completed", turnId: input.turnId };
  } catch (error) {
    let message = errorMessage(error);
    if (stage === "persistence") {
      try {
        const recovered = await reconcilePersistedResponse({
          input,
          workflowRunId,
          persistenceError: message,
        });
        if (recovered) {
          await closeDurableStream();
          return {
            status: "completed",
            turnId: input.turnId,
            recovered: true,
          };
        }
      } catch (recoveryError) {
        stage = "persistence-recovery";
        message = `${message}; ${errorMessage(recoveryError)}`;
      }
    }
    if (stage === "stream-close") {
      await recordStreamCloseWarning({
        turnId: input.turnId,
        workflowRunId,
        message,
      });
      await writeDurableFailure(workflowRunId, stage, message);
      return {
        status: "completed-with-warning",
        turnId: input.turnId,
      };
    }
    try {
      await recordDurableFailure({
        turnId: input.turnId,
        workflowRunId,
        message,
        stage,
      });
    } finally {
      await writeDurableFailure(workflowRunId, stage, message);
    }
    throw error;
  }
}
