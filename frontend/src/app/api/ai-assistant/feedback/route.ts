import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { ingestThumbsFeedbackLearning } from "@/lib/ai/services/agent-learning-service";
import { recordAiFeedbackEvent } from "@/lib/ai/services/feedback-event-service";
import { scoreUserFeedback } from "@/lib/ai/langfuse-trace";
import {
  extractLangfuseTraceIdFromMetadata,
  normalizeLangfuseTraceId,
} from "@/lib/ai/langfuse-feedback";
import { toSessionUuid } from "@/lib/ai/session-id";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database.types";

/**
 * POST /api/ai-assistant/feedback
 *
 * Persists user feedback (thumbs up/down) on AI-generated responses.
 *
 * Accepts feedback from any AI surface, not just chat:
 *   - `surface` — which AI surface produced the content (chat, daily_digest,
 *     insight_card, etc.). Used as a scope tag for learning extraction so the
 *     learning loop knows which retrieval/prompt path the issue came from.
 *   - `subjectType` / `subjectId` — what kind of content was rated.
 *   - `reasonCategory` / `reason` — optional categorical + free-text reason
 *     when feedback is "down". Used to extract richer agent_learnings.
 *
 * Always writes:
 *   - One row to `chat_history` (for assistant-chat compatibility).
 *   - One row to `ai_feedback_events` (the unified feedback ledger).
 *   - On "down": one row to `agent_learnings` via ingestThumbsFeedbackLearning,
 *     so the model sees a prevention prompt next time.
 */
export const POST = withApiGuardrails(
  "/api/ai-assistant/feedback#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/ai-assistant/feedback#POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    const body = await request.json();
    const {
      sessionId,
      messageId,
      traceId,
      feedback,
      messageContent,
      surface,
      subjectType,
      subjectId,
      projectId,
      reasonCategory,
      reason,
      contentSnapshot,
    } = body as {
      sessionId?: string | null;
      messageId?: string;
      traceId?: string | null;
      feedback: "up" | "down";
      messageContent?: string;
      surface?: string;
      subjectType?: string;
      subjectId?: string | null;
      projectId?: number | null;
      reasonCategory?: string | null;
      reason?: string | null;
      contentSnapshot?: Record<string, unknown>;
    };

    if (!feedback) {
      return new Response("feedback is required", { status: 400 });
    }

    // Resolve effective surface/subject. Defaults preserve the original
    // assistant-only behavior for callers that don't pass these fields.
    const effectiveSurface = surface ?? "ai_assistant";
    const effectiveSubjectType = subjectType ?? "assistant_message";
    // chat_history requires a sessionId. For non-chat surfaces (insight cards,
    // digests) sessionId is optional — we only write chat_history when present.
    const hasChatSession = Boolean(sessionId);

    const supabase = createServiceClient();
    const sessionUuid = hasChatSession ? toSessionUuid(sessionId!) : null;
    const directLangfuseTraceId = normalizeLangfuseTraceId(traceId);

    // Only write chat_history for chat-style sessions. Insight/digest surfaces
    // don't belong in chat_history (and don't have a session id anyway).
    let chatHistoryId: string | null = null;
    if (hasChatSession && sessionUuid) {
      const { data, error } = await serviceDb.from("chat_history")
        .insert({
          session_id: sessionUuid,
          user_id: user.id,
          role: "system",
          content: `[feedback:${feedback}]`,
          metadata: {
            type: "feedback",
            feedback,
            messageId: messageId ?? subjectId ?? null,
            langfuseTraceId: directLangfuseTraceId,
            messageContent: messageContent?.slice(0, 500) ?? null,
            originalSessionId: sessionId,
            reasonCategory: reasonCategory ?? null,
            reason: reason ?? null,
            surface: effectiveSurface,
            timestamp: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "/api/ai-assistant/feedback#POST",
          message:
            error?.message ?? "Feedback chat_history insert returned no row.",
        });
      }
      chatHistoryId = data.id;
    }

    await recordAiFeedbackEvent({
      userId: user.id,
      projectId: projectId ?? null,
      sessionId: sessionUuid,
      sourceTable: chatHistoryId ? "chat_history" : null,
      sourceRecordId: chatHistoryId,
      eventType: "assistant_feedback_recorded",
      eventFamily: "assistant_response",
      surface: effectiveSurface,
      subjectType: effectiveSubjectType,
      subjectId: messageId ?? subjectId ?? null,
      signal: feedback === "up" ? "positive" : "negative",
      reasonCategory: reasonCategory ?? null,
      freeText: reason ?? messageContent?.slice(0, 1000) ?? null,
      sourceContext: {
        messageId: messageId ?? subjectId ?? null,
        langfuseTraceId: directLangfuseTraceId,
        messageContent: messageContent?.slice(0, 500) ?? null,
        contentSnapshot: (contentSnapshot ?? null) as Json,
      },
      metadata: {
        feedback,
        chatHistoryId,
        originalSessionId: sessionId ?? null,
        surface: effectiveSurface,
        subjectType: effectiveSubjectType,
        subjectId: subjectId ?? null,
        langfuseTraceId: directLangfuseTraceId,
        reasonCategory: reasonCategory ?? null,
        visibility: "team",
      },
    });

    // Mirror the thumbs onto the originating Langfuse trace as a `user_feedback`
    // score. Prefer the request trace id emitted from chat history metadata; keep
    // the DB lookup fallback for older clients and non-reloaded message states.
    if (directLangfuseTraceId || (messageId && sessionUuid)) {
      try {
        let resolvedTraceId = directLangfuseTraceId;
        if (!resolvedTraceId && messageId && sessionUuid) {
          const { data: assistantRows } = await serviceDb.from("chat_history")
            .select("metadata")
            .eq("session_id", sessionUuid)
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(30);
          const match = (assistantRows ?? []).find(
            (row) =>
              (row.metadata as Record<string, unknown> | null)
                ?.response_message_id === messageId,
          );
          resolvedTraceId = extractLangfuseTraceIdFromMetadata(match?.metadata);
        }
        if (resolvedTraceId) {
          await scoreUserFeedback({
            traceId: resolvedTraceId,
            feedback,
            comment: reason ?? reasonCategory ?? null,
          });
        }
      } catch (langfuseError) {
        logger.error({
          msg: "[Feedback] Langfuse user_feedback score failed:",
          data: langfuseError,
        });
      }
    }

    // Extract a learning when the user marks the response negatively. This
    // creates an agent_learnings row that gets injected into future prompts
    // for the same surface so the AI avoids the pattern that was flagged.
    if (feedback === "down") {
      try {
        await ingestThumbsFeedbackLearning({
          sessionId: sessionId ?? "no-session",
          feedback,
          messageContent,
          surface: effectiveSurface,
          reasonCategory: reasonCategory ?? null,
          reason: reason ?? null,
          projectId: projectId ?? null,
        });
      } catch (learningError) {
        logger.error({
          msg: "[Feedback] Learning ingestion failed:",
          data: learningError,
        });
      }
    } else {
      // Still update usage outcomes for thumbs-up so retrieval learnings have
      // signal even when the response was good.
      try {
        await ingestThumbsFeedbackLearning({
          sessionId: sessionId ?? "no-session",
          feedback,
          messageContent,
          surface: effectiveSurface,
          reasonCategory: null,
          reason: null,
          projectId: projectId ?? null,
        });
      } catch (learningError) {
        logger.error({
          msg: "[Feedback] Positive feedback ingestion failed:",
          data: learningError,
        });
      }
    }

    return Response.json({ success: true });
  },
);
