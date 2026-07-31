import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AI_CALL_POLICY,
  fetchWithGuardrails,
} from "@/lib/fetch-with-guardrails";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  SITE_SCRIBE_NOTE_TAGS,
  type SiteScribeStructuredLog,
} from "@/lib/site-scribe/types";

const REFINE_MODEL =
  process.env.OPENAI_SITE_SCRIBE_REFINE_MODEL ?? "gpt-5.4-mini";

const transcriptSegmentSchema = z.object({
  id: z.string(),
  speaker: z.enum(["crew", "assistant"]),
  text: z.string(),
  startMs: z.number(),
  endMs: z.number().optional(),
  final: z.boolean(),
});

const requestSchema = z.object({
  transcript: z.array(transcriptSegmentSchema).min(1),
  structuredLog: z.object({
    summary: z.string(),
    manpower: z.array(z.unknown()),
    notes: z.array(z.unknown()),
    photos: z.array(z.unknown()),
    fieldConfidence: z.record(z.string(), z.number()),
  }),
});

const refinedLogSchema = z.object({
  summary: z.string(),
  manpower: z.array(
    z.object({
      subcontractorName: z.string(),
      workerCount: z.number().nullable(),
      hoursWorked: z.number().nullable(),
      sourceAudioStartMs: z.number().nullable(),
      sourceAudioEndMs: z.number().nullable(),
      confidence: z.object({
        subcontractorName: z.number().min(0).max(1),
        workerCount: z.number().min(0).max(1),
        hoursWorked: z.number().min(0).max(1),
      }),
    }),
  ),
  notes: z.array(
    z.object({
      tag: z.enum(SITE_SCRIBE_NOTE_TAGS),
      text: z.string(),
      sourceAudioStartMs: z.number().nullable(),
      sourceAudioEndMs: z.number().nullable(),
      confidence: z.object({
        tag: z.number().min(0).max(1),
        text: z.number().min(0).max(1),
      }),
    }),
  ),
});

interface ResponsesApiTextContent {
  type?: string;
  text?: string;
}

interface ResponsesApiOutputItem {
  type?: string;
  content?: ResponsesApiTextContent[];
}

interface ResponsesApiResponse {
  output_text?: string;
  output?: ResponsesApiOutputItem[];
}

const structuredLogJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description: "Concise daily-log summary in job-report language.",
    },
    manpower: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          subcontractorName: { type: "string" },
          workerCount: { type: ["number", "null"] },
          hoursWorked: { type: ["number", "null"] },
          sourceAudioStartMs: { type: ["number", "null"] },
          sourceAudioEndMs: { type: ["number", "null"] },
          confidence: {
            type: "object",
            additionalProperties: false,
            properties: {
              subcontractorName: { type: "number" },
              workerCount: { type: "number" },
              hoursWorked: { type: "number" },
            },
            required: ["subcontractorName", "workerCount", "hoursWorked"],
          },
        },
        required: [
          "subcontractorName",
          "workerCount",
          "hoursWorked",
          "sourceAudioStartMs",
          "sourceAudioEndMs",
          "confidence",
        ],
      },
    },
    notes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tag: { type: "string", enum: SITE_SCRIBE_NOTE_TAGS },
          text: { type: "string" },
          sourceAudioStartMs: { type: ["number", "null"] },
          sourceAudioEndMs: { type: ["number", "null"] },
          confidence: {
            type: "object",
            additionalProperties: false,
            properties: {
              tag: { type: "number" },
              text: { type: "number" },
            },
            required: ["tag", "text"],
          },
        },
        required: [
          "tag",
          "text",
          "sourceAudioStartMs",
          "sourceAudioEndMs",
          "confidence",
        ],
      },
    },
  },
  required: ["summary", "manpower", "notes"],
} as const;

function extractOutputText(response: ResponsesApiResponse) {
  if (response.output_text?.trim()) return response.output_text;

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function buildTranscriptText(
  transcript: z.infer<typeof transcriptSegmentSchema>[],
) {
  return transcript
    .filter((segment) => segment.speaker === "crew" && segment.text.trim())
    .map((segment) => `[${segment.startMs}ms] ${segment.text.trim()}`)
    .join("\n");
}

export const POST = withApiGuardrails(
  "site-scribe/refine-log#POST",
  async ({ request, requestId }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "site-scribe/refine-log#POST",
        message: "Authentication required to refine a Site Scribe log.",
        status: 401,
        severity: "medium",
      });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: "INVALID_SITE_SCRIBE_REFINE_PAYLOAD",
          message: "Site Scribe refine payload is invalid.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const transcriptText = buildTranscriptText(parsed.data.transcript);
    if (!transcriptText) {
      return NextResponse.json(
        {
          code: "EMPTY_TRANSCRIPT",
          message:
            "Transcript must include at least one crew narration segment.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new GuardrailError({
        code: "CONFIGURATION_ERROR",
        where: "site-scribe/refine-log#POST",
        message:
          "OPENAI_API_KEY is required to refine a Site Scribe transcript.",
        status: 503,
        severity: "high",
      });
    }

    const response = await fetchWithGuardrails(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        requestId,
        where: "site-scribe/refine-log#POST",
        dependency: "openai",
        timeoutMs: AI_CALL_POLICY.timeoutMs,
        retries: AI_CALL_POLICY.maxRetries,
        backoffMs: AI_CALL_POLICY.backoffMs,
        body: JSON.stringify({
          model: REFINE_MODEL,
          instructions:
            "Convert a construction field crew brain dump into a structured daily log. Do not invent missing counts, hours, subcontractor names, or events. Use null and low confidence for missing or ambiguous values. Preserve the user's meaning while tightening wording for job-report review.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(
                    {
                      transcript: transcriptText,
                      currentDraft: parsed.data.structuredLog,
                    },
                    null,
                    2,
                  ),
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "site_scribe_refined_log",
              strict: true,
              schema: structuredLogJsonSchema,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "site-scribe/refine-log#POST",
        message: `Site Scribe transcript refinement failed with ${response.status}.`,
        details: text.slice(0, 500),
        status: 502,
        severity: "high",
      });
    }

    const data = (await response.json()) as ResponsesApiResponse;
    const outputText = extractOutputText(data);
    const json = JSON.parse(outputText) as unknown;
    const refined = refinedLogSchema.parse(json);

    const structuredLog: SiteScribeStructuredLog = {
      summary: refined.summary,
      manpower: refined.manpower.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
      })),
      notes: refined.notes.map((note) => ({
        ...note,
        id: crypto.randomUUID(),
      })),
      photos: [],
      fieldConfidence: {
        summary: refined.summary.trim() ? 0.82 : 0,
      },
    };

    return NextResponse.json({ structuredLog });
  },
);
