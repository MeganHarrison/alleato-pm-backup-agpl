import { NextResponse } from "next/server";

import {
  AI_CALL_POLICY,
  fetchWithGuardrails,
} from "@/lib/fetch-with-guardrails";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2";
const TRANSCRIPTION_MODEL =
  process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ?? "gpt-realtime-whisper";

const SITE_SCRIBE_INSTRUCTIONS = `
You are Site Scribe, a passive construction daily-log capture assistant.
The field crew member is doing a natural brain dump about the workday.
Do not interview, coach, interrupt, ask clarifying questions, or drive the conversation.
Do not ask for missing manpower counts, subcontractor names, hours, dates, or topic details during capture.
Treat the user's spoken transcript as the source of truth, then refine it into the most useful daily-log structure for later review.
If structured fields are missing or ambiguous, leave numeric fields null when allowed, use the best available label when obvious, and assign low confidence.
Required manpower targets are subcontractor name, worker count, and hours on site, but missing values must be handled in review instead of by spoken questions.
Extract notes using only these topic tags: Delivery, Inspection, Safety, Visitor, Issue, Progress, Equipment, Other.
Preserve important wording from the transcript in notes, but convert rambling narration into concise job-report language.
Use the capture_daily_log_update tool whenever you identify or revise structured daily-log data.
Include confidence scores between 0 and 1 for each extracted field.
`.trim();

export const POST = withApiGuardrails(
  "site-scribe/realtime-session#POST",
  async ({ requestId }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "site-scribe/realtime-session#POST",
        message: "Authentication required to start a Site Scribe session.",
        status: 401,
        severity: "medium",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new GuardrailError({
        code: "CONFIGURATION_ERROR",
        where: "site-scribe/realtime-session#POST",
        message:
          "OPENAI_API_KEY is required to mint a Site Scribe Realtime session.",
        status: 503,
        severity: "high",
      });
    }

    const response = await fetchWithGuardrails(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        requestId,
        where: "site-scribe/realtime-session#POST",
        dependency: "openai-realtime",
        timeoutMs: AI_CALL_POLICY.timeoutMs,
        retries: AI_CALL_POLICY.maxRetries,
        backoffMs: AI_CALL_POLICY.backoffMs,
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: REALTIME_MODEL,
            audio: {
              input: {
                transcription: {
                  model: TRANSCRIPTION_MODEL,
                },
                turn_detection: {
                  type: "server_vad",
                  interrupt_response: false,
                },
              },
              output: {
                voice: "verse",
              },
            },
            instructions: SITE_SCRIBE_INSTRUCTIONS,
            tools: [
              {
                type: "function",
                name: "capture_daily_log_update",
                description:
                  "Send structured daily-log fields refined from the user's voice brain dump.",
                parameters: {
                  type: "object",
                  properties: {
                    summary: { type: "string" },
                    manpower: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          subcontractorName: { type: "string" },
                          workerCount: { type: "number" },
                          hoursWorked: { type: "number" },
                          confidence: { type: "object" },
                        },
                        required: ["subcontractorName", "confidence"],
                      },
                    },
                    notes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          tag: {
                            type: "string",
                            enum: [
                              "Delivery",
                              "Inspection",
                              "Safety",
                              "Visitor",
                              "Issue",
                              "Progress",
                              "Equipment",
                              "Other",
                            ],
                          },
                          text: { type: "string" },
                          confidence: { type: "object" },
                        },
                        required: ["tag", "text", "confidence"],
                      },
                    },
                  },
                  required: ["summary"],
                },
              },
            ],
            tool_choice: "auto",
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "site-scribe/realtime-session#POST",
        message: `OpenAI Realtime session minting failed with ${response.status}.`,
        details: text.slice(0, 500),
        status: 502,
        severity: "high",
      });
    }

    const data = await response.json();

    return NextResponse.json({
      ...data,
      model: REALTIME_MODEL,
      transcriptionModel: TRANSCRIPTION_MODEL,
    });
  },
);
