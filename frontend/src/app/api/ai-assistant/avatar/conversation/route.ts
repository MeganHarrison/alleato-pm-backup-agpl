import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails, parseJsonBody, validateResponseContract } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "ai-assistant/avatar/conversation#POST";
const TAVUS_CONVERSATIONS_URL = "https://tavusapi.com/v2/conversations";

const requestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  selectedProjectId: z.number().int().positive().nullable().optional(),
  selectedProjectName: z.string().min(1).max(160).nullable().optional(),
});

const tavusResponseSchema = z.object({
  conversation_id: z.string().min(1),
  conversation_name: z.string().optional().nullable(),
  conversation_url: z.string().url(),
  status: z.string().optional().nullable(),
  meeting_token: z.string().optional().nullable(),
});

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: WHERE,
      status: 503,
      message:
        "Tavus avatar is not configured. Set TAVUS_API_KEY, TAVUS_PERSONA_ID, and TAVUS_REPLICA_ID before starting a live avatar session.",
      details: {
        missing: key,
        prevention:
          "Keep Tavus credentials server-side only and verify the replica is ready in Tavus before enabling the avatar for the team.",
      },
    });
  }
  return value;
}

async function readUpstreamBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function buildConversationContext(input: z.infer<typeof requestSchema>, email?: string | null): string {
  const projectContext = input.selectedProjectName
    ? `The selected project context is ${input.selectedProjectName}.`
    : "No single project is selected, so start from portfolio-level strategy and ask which project to drill into when needed.";

  return [
    "You are Alleato's live AI strategist in a face-to-face video conversation.",
    "Sound like a sharp executive operator and construction project manager, not a chatbot reading a report.",
    "Be warm, polished, quick-witted, and a little funny when it helps adoption, but never flirty, insulting, or distracting.",
    "Use short spoken responses first, then offer to go deeper. Avoid markdown, long lists, and screen-reader-style narration.",
    "When data is thin or you are uncertain, say so directly and ask the one question that would let you give a stronger recommendation.",
    "You cannot click buttons, submit forms, send emails, or change Alleato records from this Tavus room. Tell the user what you recommend they do next.",
    projectContext,
    input.sessionId ? `The related Alleato assistant chat session is ${input.sessionId}.` : "",
    email ? `The signed-in Alleato user is ${email}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Authentication required to start a Tavus avatar session.",
    });
  }

  const body = await parseJsonBody(request, requestSchema, WHERE);
  const apiKey = requiredEnv("TAVUS_API_KEY");
  const personaId = requiredEnv("TAVUS_PERSONA_ID");
  const replicaId = requiredEnv("TAVUS_REPLICA_ID");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(TAVUS_CONVERSATIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        persona_id: personaId,
        replica_id: replicaId,
        conversation_name: body.selectedProjectName
          ? `Alleato AI Strategist - ${body.selectedProjectName}`
          : "Alleato AI Strategist",
        conversational_context: buildConversationContext(body, user.email),
        max_participants: 2,
        memory_stores: [`alleato-user-${user.id}`],
        properties: {
          enable_closed_captions: true,
          max_call_duration: 1800,
          participant_left_timeout: 60,
          participant_absent_timeout: 120,
        },
      }),
    });
  } catch (error) {
    throw new GuardrailError({
      code: error instanceof DOMException && error.name === "AbortError"
        ? "UPSTREAM_TIMEOUT"
        : "UPSTREAM_FAILURE",
      where: WHERE,
      status: 502,
      message:
        "Tavus did not start the avatar session. Check Tavus API availability and the configured persona/replica IDs.",
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  const upstreamBody = await readUpstreamBody(response);
  if (!response.ok) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      status: response.status,
      message:
        "Tavus rejected the avatar session request. Verify TAVUS_PERSONA_ID, TAVUS_REPLICA_ID, and that the replica is ready.",
      details: upstreamBody,
    });
  }

  const conversation = validateResponseContract(
    tavusResponseSchema,
    upstreamBody,
    WHERE,
  );

  return NextResponse.json({
    conversationId: conversation.conversation_id,
    conversationName: conversation.conversation_name ?? "Alleato AI Strategist",
    conversationUrl: conversation.conversation_url,
    meetingToken: conversation.meeting_token ?? null,
    status: conversation.status ?? "active",
  });
});
