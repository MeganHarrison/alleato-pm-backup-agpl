import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isTrackableVideoLesson } from "@/lib/analytics/video-tracking";

const WHERE = "api.engagement.learning-progress#POST";
const ProgressSchema = z.object({
  contentItemId: z.string().uuid(),
  checkpoint: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(90)]),
  positionSeconds: z.number().finite().min(0).max(86_400),
  watchedSeconds: z.number().finite().min(0).max(120),
  appSessionId: z.string().uuid().optional(),
});

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Sign in before recording lesson progress.", status: 401 });
  }
  const input = await parseJsonBody(request, ProgressSchema, WHERE);

  // Service role writes only after a cookie-scoped read proves the learner is
  // permitted to view this canonical content item.
  const viewerDb = await createClient();
  const { data: visibleContent, error: visibilityError } = await viewerDb
    .from("knowledge_content_item")
    .select("id, content_kind, source_type")
    .eq("id", input.contentItemId)
    .maybeSingle();
  if (visibilityError) throw new GuardrailError({ code: "DATABASE_ERROR", where: WHERE, details: visibilityError.message });
  if (!isTrackableVideoLesson(visibleContent)) {
    throw new GuardrailError({ code: "FORBIDDEN", where: WHERE, message: "This lesson is unavailable for video-progress tracking.", status: 403 });
  }

  const { data, error } = await createServiceClient().rpc("record_video_learning_progress", {
    p_content_item_id: input.contentItemId,
    p_learner_id: user.id,
    p_checkpoint: input.checkpoint,
    p_position_seconds: Math.round(input.positionSeconds),
    p_watched_seconds: Math.round(input.watchedSeconds),
    p_app_session_id: input.appSessionId ?? null,
  });
  if (error) throw new GuardrailError({ code: "DATABASE_ERROR", where: WHERE, details: error.message });
  const result = data?.[0];
  return NextResponse.json({ checkpoint: result?.checkpoint, completed: result?.completed });
});
