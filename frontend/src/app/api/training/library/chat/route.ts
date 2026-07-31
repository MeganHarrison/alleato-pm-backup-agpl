import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createChatHistoryWriter } from "@/app/api/ai-assistant/chat/chat-history-writer";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { getLanguageModel } from "@/lib/ai/providers";
import { retrieveChunks } from "@/lib/ai/retrieval/retrieve-chunks";
import {
  appendTrainingSourceLinks,
  buildTrainingContext,
  normalizeTrainingSources,
  TRAINING_NOTEBOOK_FALLBACK_URL,
  TRAINING_SOURCE_TYPES,
  trainingLibraryRecoveryMessage,
} from "@/lib/ai/training-library/grounding";
import { createToolContext } from "@/lib/ai/tools/tool-context";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Json } from "@/types/database.types";

export const maxDuration = 60;

const TrainingLibraryChatSchema = z.object({
  id: z.string().min(1),
  messages: z.array(z.custom<UIMessage>()).min(1),
});

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("")
    .trim();
}

function modelHistory(messages: UIMessage[]): ModelMessage[] {
  return messages.slice(-8).flatMap((message): ModelMessage[] => {
    const content = textFromMessage(message);
    if (!content || (message.role !== "user" && message.role !== "assistant")) {
      return [];
    }
    return [{ role: message.role, content }];
  });
}

function textStream(content: string) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      const id = randomUUID();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: content });
      writer.write({ type: "text-end", id });
    },
    onError: () =>
      `The training response could not be delivered. Use the [NotebookLM backup](${TRAINING_NOTEBOOK_FALLBACK_URL}) and try again.`,
  });
}

async function persistAssistantResponse(params: {
  writer: ReturnType<typeof createChatHistoryWriter>;
  answer: string;
  sources: ReturnType<typeof normalizeTrainingSources>;
  status: "grounded" | "empty" | "retrieval_error" | "synthesis_error";
}) {
  await params.writer.persistRecordOrThrow(
    {
      role: "assistant",
      content: params.answer,
      sources: params.sources.map((source) => ({
        id: source.id,
        title: source.title,
        url: source.url,
        source_type: source.sourceType,
        excerpt: source.excerpt,
        similarity: source.similarity,
      })) as Json,
      metadata: {
        surface: "training_library",
        grounding_status: params.status,
        source_count: params.sources.length,
      },
    },
    "training library answer",
  );
}

async function updateConversationTimestamp(sessionId: string, userId: string) {
  const { error } = await serviceDb
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (error) {
    throw new Error(
      `Training conversation timestamp could not be updated: ${error.message}`,
    );
  }
}

export const POST = withApiGuardrails(
  "training/library/chat#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "training/library/chat#POST",
        message: "Authentication is required to ask the training library.",
        status: 401,
        severity: "medium",
      });
    }

    const { id: sessionId, messages } = (await parseJsonBody(
      request,
      TrainingLibraryChatSchema,
      "training/library/chat#POST",
    )) as z.infer<typeof TrainingLibraryChatSchema>;
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const question = lastUserMessage ? textFromMessage(lastUserMessage) : "";
    if (!question) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "training/library/chat#POST",
        message: "A text question is required.",
        status: 400,
        severity: "low",
      });
    }

    if (
      !(await conversationBelongsToSurface({
        sessionId,
        userId: user.id,
        surface: "training_library",
      }))
    ) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "training/library/chat#POST",
        message: "This training conversation does not exist.",
        status: 404,
        severity: "medium",
      });
    }

    const deps = createToolContext({ userId: user.id });
    const historyWriter = createChatHistoryWriter(deps.db, {
      sessionId,
      userId: user.id,
    });
    await historyWriter.persistRecordOrThrow(
      {
        role: "user",
        content: question,
        metadata: { surface: "training_library" },
      },
      "training library question",
    );

    let sources: ReturnType<typeof normalizeTrainingSources> = [];
    try {
      const rows = await retrieveChunks({
        query: question,
        openai: deps.openai,
        ragClient: deps.rag,
        sourceTypes: [...TRAINING_SOURCE_TYPES],
        matchCount: 10,
        matchThreshold: 0.32,
        hybridRankingEnabled: true,
        telemetryEnabled: true,
        errorLabel: "Training library retrieval",
      });
      sources = normalizeTrainingSources(rows);
    } catch (error) {
      console.error("[training-library/chat] retrieval failed", {
        sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
      const answer = trainingLibraryRecoveryMessage("unavailable");
      await persistAssistantResponse({
        writer: historyWriter,
        answer,
        sources,
        status: "retrieval_error",
      });
      await updateConversationTimestamp(sessionId, user.id);
      return createUIMessageStreamResponse({ stream: textStream(answer) });
    }

    if (sources.length === 0) {
      const answer = trainingLibraryRecoveryMessage("empty");
      await persistAssistantResponse({
        writer: historyWriter,
        answer,
        sources,
        status: "empty",
      });
      await updateConversationTimestamp(sessionId, user.id);
      return createUIMessageStreamResponse({ stream: textStream(answer) });
    }

    let answer: string;
    try {
      const result = await generateText({
        model: getLanguageModel("openai/gpt-4.1-mini"),
        instructions: `You are the Alleato Training Library assistant.

Answer only from the retrieved Alleato training context. Never use unstated
facts or pretend an external linked resource was scraped. Give concise,
practical construction guidance. Cite supporting statements with [Source N].
If the context does not support the question, say so and recommend a narrower
question. Do not omit citations.

Retrieved training context:
${buildTrainingContext(sources)}`,
        messages: modelHistory(messages),
        maxOutputTokens: 1200,
        temperature: 0.2,
      });
      answer = appendTrainingSourceLinks(result.text, sources);
    } catch (error) {
      console.error("[training-library/chat] synthesis failed", {
        sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
      answer = `The training sources were found, but the grounded answer could not be generated. Use the [NotebookLM backup](${TRAINING_NOTEBOOK_FALLBACK_URL}) and try again.`;
      await persistAssistantResponse({
        writer: historyWriter,
        answer,
        sources,
        status: "synthesis_error",
      });
      await updateConversationTimestamp(sessionId, user.id);
      return createUIMessageStreamResponse({ stream: textStream(answer) });
    }

    await persistAssistantResponse({
      writer: historyWriter,
      answer,
      sources,
      status: "grounded",
    });
    await updateConversationTimestamp(sessionId, user.id);
    return createUIMessageStreamResponse({ stream: textStream(answer) });
  },
);
