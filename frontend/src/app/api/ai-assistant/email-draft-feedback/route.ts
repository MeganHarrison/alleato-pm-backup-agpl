export const dynamic = "force-dynamic";

import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { recordEmailDraftFeedback } from "@/lib/ai/services/feedback-event-service";
import { getApiRouteUser } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const DEFAULT_BRANDON_VOICE_PROFILE_PATH =
  "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md";
const DEFAULT_BRANDON_VOICE_PROFILE_VERSION = "2026-05-19";

const emailDraftFeedbackSchema = z.object({
  mailboxUserId: z.string().email(),
  graphDraftMessageId: z.string().trim().min(1),
  graphSourceMessageId: z.string().trim().min(1).nullable().optional(),
  conversationId: z.string().trim().min(1).nullable().optional(),
  subject: z.string().trim().max(500).nullable().optional(),
  sessionId: z.string().trim().min(1).nullable().optional(),
  signal: z.enum(["good", "bad", "accepted", "edited", "ignored"]),
  reasonCategory: z
    .enum([
      "too_formal",
      "too_long",
      "too_short",
      "too_soft",
      "too_direct",
      "wrong_tone",
      "wrong_assumption",
      "missing_context",
      "good_tone",
      "good_structure",
      "other",
    ])
    .nullable()
    .optional(),
  feedbackText: z.string().trim().max(4000).nullable().optional(),
  draftSnapshot: z.unknown().optional(),
  finalSnapshot: z.unknown().optional(),
  voiceProfilePath: z
    .string()
    .trim()
    .min(1)
    .default(DEFAULT_BRANDON_VOICE_PROFILE_PATH),
  voiceProfileVersion: z
    .string()
    .trim()
    .min(1)
    .default(DEFAULT_BRANDON_VOICE_PROFILE_VERSION),
  metadata: z.unknown().optional(),
});

function toJson(value: unknown): Json {
  return value === undefined ? {} : (value as Json);
}

export const POST = withApiGuardrails(
  "/api/ai-assistant/email-draft-feedback#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/ai-assistant/email-draft-feedback#POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    const body = await parseJsonBody(
      request,
      emailDraftFeedbackSchema,
      "/api/ai-assistant/email-draft-feedback#POST",
    );

    const event = await recordEmailDraftFeedback({
      userId: user.id,
      mailboxUserId: body.mailboxUserId,
      graphDraftMessageId: body.graphDraftMessageId,
      graphSourceMessageId: body.graphSourceMessageId ?? null,
      conversationId: body.conversationId ?? null,
      subject: body.subject ?? null,
      sessionId: body.sessionId ?? null,
      signal: body.signal,
      reasonCategory: body.reasonCategory ?? null,
      feedbackText: body.feedbackText ?? null,
      draftSnapshot: toJson(body.draftSnapshot),
      finalSnapshot: toJson(body.finalSnapshot),
      voiceProfilePath: body.voiceProfilePath,
      voiceProfileVersion: body.voiceProfileVersion,
      metadata: toJson(body.metadata),
    });

    return Response.json({
      success: true,
      eventId: event.id,
      storedIn: "ai_feedback_events",
      voiceProfilePath: body.voiceProfilePath,
      voiceProfileVersion: body.voiceProfileVersion,
    });
  },
);
