import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { createChatHistoryWriter } from "@/lib/ai/chat-history-writer";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { DEFAULT_AI_ASSISTANT_MODEL } from "@/lib/ai/assistant-models";
import { getLanguageModel } from "@/lib/ai/providers";
import { createAsrsIntelligenceTools } from "@/lib/ai/tools/asrs-intelligence";
import {
  buildFmdsSourceRecords,
  renderFmdsEvidencePrompt,
} from "@/lib/fmds/fmds-chat-presentation";
import { searchFmdsEvidence } from "@/lib/fmds/fmds-chat.server";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

export const maxDuration = 300;

const requestSchema = z.object({
  id: z.string().uuid(),
  messages: z.array(z.custom<UIMessage>()).min(1),
});

function messageText(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("")
    .trim();
}

export const POST = withApiGuardrails("asrs/chat#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "asrs/chat#POST",
      message: "Sign in again to use ASRS Intelligence.",
      status: 401,
      severity: "medium",
    });
  }

  const { id: sessionId, messages } = (await parseJsonBody(
    request,
    requestSchema,
    "asrs/chat#POST",
  )) as z.infer<typeof requestSchema>;

  if (
    !(await conversationBelongsToSurface({
      sessionId,
      userId: user.id,
      surface: "asrs",
    }))
  ) {
    throw new GuardrailError({
      code: "RESOURCE_NOT_FOUND",
      where: "asrs/chat#POST",
      message: "This conversation is not part of ASRS Intelligence.",
      status: 404,
      severity: "medium",
    });
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const query = lastUserMessage ? messageText(lastUserMessage) : "";
  if (!query) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "asrs/chat#POST",
      message: "Enter an FMDS or ASRS engineering question.",
      status: 400,
      severity: "low",
    });
  }

  const evidence = await searchFmdsEvidence({ query, matchCount: 8 });
  const sources = buildFmdsSourceRecords(evidence);
  const system = renderFmdsEvidencePrompt(evidence);
  const modelMessages = await convertToModelMessages(messages);
  const supabase = createServiceClient();
  const history = createChatHistoryWriter(supabase, {
    sessionId,
    userId: user.id,
  });
  const toolTrace: Record<string, unknown>[] = [];

  await history.persistRecordOrThrow(
    {
      role: "user",
      content: query,
      metadata: {
        surface: "asrs",
        corpusRevisionId: evidence.corpus.revisionId,
      },
    },
    "ASRS user message",
  );

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: getLanguageModel(DEFAULT_AI_ASSISTANT_MODEL),
        system,
        messages: modelMessages,
        tools: createAsrsIntelligenceTools({
          revisionId: evidence.corpus.revisionId,
          onTrace: (trace) => toolTrace.push(trace),
        }),
        stopWhen: stepCountIs(5),
        maxOutputTokens: 2400,
        onError: ({ error }) => {
          console.error("[asrs/chat] model stream failed", {
            message: error instanceof Error ? error.message : String(error),
            revisionId: evidence.corpus.revisionId,
          });
        },
      });
      writer.merge(result.toUIMessageStream({ originalMessages: messages }));
    },
    onFinish: async ({ responseMessage }) => {
      const assistantText = messageText(responseMessage).trim();
      if (!assistantText) {
        throw new Error(
          "ASRS Intelligence returned no answer; the response was not saved.",
        );
      }
      await history.persistRecordOrThrow(
        {
          role: "assistant",
          content: assistantText,
          sources: sources as unknown as Json,
          metadata: {
            surface: "asrs",
            corpus: evidence.corpus,
            coverage: evidence.coverage,
            retrieval: "mandatory_revision_scoped_prefetch",
            toolTrace,
          },
        },
        "ASRS assistant message",
      );
      const { error } = await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);
      if (error) {
        throw new Error(
          `Updating the ASRS conversation timestamp failed: ${error.message}`,
        );
      }
    },
    onError: (error) =>
      error instanceof Error
        ? error.message
        : "ASRS Intelligence could not complete this answer.",
  });

  return createUIMessageStreamResponse({ stream });
});
