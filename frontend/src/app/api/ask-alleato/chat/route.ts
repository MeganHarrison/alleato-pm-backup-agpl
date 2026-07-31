import { after } from "next/server";

import { handleChatV2 } from "@/app/api/ai-assistant/chat/handler-v2";
import { flushLangfuse } from "@/instrumentation";
import { AI_ASSISTANT_SURFACES } from "@/lib/ai/assistant-surface";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const maxDuration = 300;

export const POST = withApiGuardrails(
  "ask-alleato/chat#POST",
  async ({ request }) => {
    after(() => flushLangfuse());
    return handleChatV2({
      request,
      assistantSurface: AI_ASSISTANT_SURFACES.askAlleato,
      conversationSurface: "ask_alleato",
    });
  },
);
