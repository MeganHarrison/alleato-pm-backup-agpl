import { z } from "zod";

import { requireAdmin } from "@/app/api/admin/_shared";
import {
  assembleAssistantPromptDiagnostics,
  redactSystemPrompt,
} from "@/lib/ai/prompt-diagnostics";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.ai-assistant.prompt-diagnostics#POST";

const requestSchema = z.object({
  messageText: z.string().min(1).max(10_000),
  selectedProjectId: z.number().int().positive().optional(),
  sessionId: z.string().min(1).max(120).optional(),
  councilMode: z.boolean().optional(),
  isFirstTurn: z.boolean().optional(),
  includeSourceHealth: z.boolean().optional(),
  includeFullPrompt: z.boolean().optional(),
});

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  await requireAdmin(WHERE);

  const user = await getApiRouteUser();
  if (!user) {
    return Response.json(
      {
        success: false,
        error: "Authenticated admin user could not be resolved.",
      },
      { status: 401 },
    );
  }

  const input = requestSchema.parse(await request.json());
  const diagnostics = await assembleAssistantPromptDiagnostics({
    userId: user.id,
    messageText: input.messageText,
    selectedProjectId: input.selectedProjectId,
    sessionId: input.sessionId,
    councilMode: input.councilMode,
    isFirstTurn: input.isFirstTurn,
    includeSourceHealth: input.includeSourceHealth,
    supabase: input.includeSourceHealth ? createServiceClient() : undefined,
  });

  return Response.json(
    {
      success: true,
      generatedAt: new Date().toISOString(),
      promptHash: diagnostics.promptHash,
      charCount: diagnostics.charCount,
      approxTokenCount: diagnostics.approxTokenCount,
      sections: diagnostics.sections,
      additionalContextBlockIds: diagnostics.additionalContextBlockIds,
      redactedPrompt: redactSystemPrompt(diagnostics.prompt),
      ...(input.includeFullPrompt ? { fullPrompt: diagnostics.prompt } : {}),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
});
