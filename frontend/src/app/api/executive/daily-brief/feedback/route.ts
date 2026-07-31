export const dynamic = "force-dynamic";

import { z } from "zod";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { logger } from "@/lib/logger";
import { serviceDb } from "@/lib/supabase/service-db";

/**
 * Records a viewer's judgment on a single Daily Executive Brief item into the
 * shared AI learning loop (`ai_feedback_events`). This is the human signal that
 * later feeds candidate → review → apply — it does NOT itself mutate the packet.
 *
 * Signals map to the standard feedback vocabulary:
 *   - positive  → "Accurate"
 *   - negative  → "Inaccurate / not true"
 *   - completed → "Done / resolved"
 *
 * Items on the brief carry a stable, position-independent key (see `itemKey` in
 * build-brief.ts) which is used as the feedback subject id so signals for the
 * same item accumulate across days.
 */
const briefFeedbackSchema = z.object({
  subjectId: z.string().trim().min(1).max(128),
  signal: z.enum(["positive", "negative", "completed"]),
  title: z.string().trim().max(240).nullable().optional(),
  project: z.string().trim().max(160).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const POST = withApiGuardrails(
  "api.executive.daily-brief.feedback.POST",
  async ({ request }) => {
    // Gate on the same capability as the page and every sibling
    // /api/executive/daily-brief/* route — a user who can't see the brief must
    // not be able to write feedback into the shared AI learning loop.
    const { user } = await requireCurrentUserExecutiveDetail("api.executive.daily-brief.feedback.POST");

    const body = await parseJsonBody(
      request,
      briefFeedbackSchema,
      "api.executive.daily-brief.feedback.POST",
    );

        const { data, error } = await serviceDb.from("ai_feedback_events")
      .insert({
        event_family: "packet_quality",
        event_type: "daily_brief_item_feedback",
        signal: body.signal,
        subject_type: "daily_brief_item",
        subject_id: body.subjectId,
        surface: "daily-brief",
        free_text: body.note ?? null,
        user_id: user.id,
        after_snapshot: {
          title: body.title ?? null,
          project: body.project ?? null,
          signal: body.signal,
        },
      })
      .select("id")
      .single();

    if (error) {
      // Preserve the raw Supabase error for operators (server-only) — the
      // generic GuardrailError below would otherwise drop it from telemetry.
      logger.error({
        msg: "[daily-brief.feedback] insert into ai_feedback_events failed",
        data: error,
      });
      throw new GuardrailError({
        code: "DB_INSERT_FAILED",
        where: "api.executive.daily-brief.feedback.POST",
        // Client gets a generic message so DB internals (table/constraint/
        // connection details) don't leak into the response envelope.
        message: "Failed to record brief feedback.",
        status: 500,
      });
    }

    return Response.json({ success: true, eventId: data.id });
  },
);
