import { z } from "zod";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "ai-assistant/speech#POST";
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(4_000),
  voice: z
    .enum([
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "fable",
      "nova",
      "onyx",
      "sage",
      "shimmer",
      "verse",
      "marin",
      "cedar",
    ])
    .optional(),
});

async function readUpstreamError(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return { status: response.status };

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { status: response.status, raw: text.slice(0, 500) };
  }
}

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Authentication required to create assistant speech.",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: WHERE,
      message: "OPENAI_API_KEY is required to read AI assistant responses aloud.",
      details: {
        missing: "OPENAI_API_KEY",
        prevention:
          "Keep speech generation server-side so the OpenAI key is never exposed in the browser.",
      },
    });
  }

  const body = await parseJsonBody(request, requestSchema, WHERE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(OPENAI_SPEECH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: body.voice ?? "coral",
        input: body.text,
        instructions:
          "Speak like a polished executive strategist: clear, composed, warm, and concise. Do not sound theatrical.",
        response_format: "mp3",
      }),
    });
  } catch (error) {
    throw new GuardrailError({
      code:
        error instanceof DOMException && error.name === "AbortError"
          ? "UPSTREAM_TIMEOUT"
          : "UPSTREAM_FAILURE",
      where: WHERE,
      status: 502,
      message:
        "OpenAI speech generation failed before audio was returned.",
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      status: response.status,
      message: "OpenAI rejected the speech generation request.",
      details: await readUpstreamError(response),
    });
  }

  const audio = await response.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
});
