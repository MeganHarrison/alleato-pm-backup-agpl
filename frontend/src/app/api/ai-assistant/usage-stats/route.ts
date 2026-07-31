import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { estimateCostWithFallback, extractModelId } from "@/lib/ai/model-pricing";

/**
 * GET /api/ai-assistant/usage-stats
 *
 * Returns aggregated AI usage statistics for the admin observability page.
 * Includes token counts, estimated costs, feedback tallies, and recent conversations.
 */
export const GET = withApiGuardrails(
  "ai-assistant/usage-stats#GET",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/usage-stats#GET",
        message: "Authentication required.",
      });
    }

    const supabase = createServiceClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all assistant messages with metadata (contains usage data)
    const { data: assistantMessages, error: msgError } = await serviceDb.from("chat_history")
      .select("id, session_id, metadata, created_at")
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(500);

    if (msgError) throw new Error(`chat_history(assistant) query failed: ${msgError.message}`);

    // Fetch feedback entries — scoped to last 30 days to prevent unbounded growth
    const { data: feedbackEntries, error: fbError } = await serviceDb.from("chat_history")
      .select("metadata")
      .eq("role", "system")
      .gte("created_at", thirtyDaysAgo)
      .limit(500);

    if (fbError) throw new Error(`chat_history(feedback) query failed: ${fbError.message}`);

    // Fetch conversations for titles
    const { data: conversations, error: convError } = await serviceDb.from("conversations")
      .select("session_id, title, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(20);

    if (convError) throw new Error(`conversations query failed: ${convError.message}`);

    // Count total conversations
    const { count: totalConversations, error: convCountError } = await serviceDb.from("conversations")
      .select("id", { count: "exact", head: true });

    if (convCountError) throw new Error(`conversations count query failed: ${convCountError.message}`);

    // Count total messages
    const { count: totalMessages, error: msgCountError } = await serviceDb.from("chat_history")
      .select("id", { count: "exact", head: true })
      .in("role", ["user", "assistant"]);

    if (msgCountError) throw new Error(`chat_history count query failed: ${msgCountError.message}`);

    // Single pass: aggregate token usage and estimate cost per message
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let messagesWithUsage = 0;
    let estimatedCost = 0;
    let messagesWithUnknownModel = 0;

    const sessionTokens: Record<string, number> = {};
    const sessionMessageCounts: Record<string, number> = {};

    for (const msg of assistantMessages ?? []) {
      const meta = msg.metadata as Record<string, unknown> | null;
      const usage = meta?.usage as {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      } | null;
      const sid = msg.session_id as string;

      sessionMessageCounts[sid] = (sessionMessageCounts[sid] ?? 0) + 1;

      if (usage) {
        const inTokens = usage.inputTokens ?? 0;
        const outTokens = usage.outputTokens ?? 0;
        totalInputTokens += inTokens;
        totalOutputTokens += outTokens;
        messagesWithUsage++;

        if (usage.totalTokens) {
          sessionTokens[sid] = (sessionTokens[sid] ?? 0) + usage.totalTokens;
        }

        const modelId = extractModelId(meta);
        const { cost, matchedModel } = estimateCostWithFallback(modelId, inTokens, outTokens);
        estimatedCost += cost;
        if (!matchedModel) messagesWithUnknownModel++;
      }
    }

    const totalTokens = totalInputTokens + totalOutputTokens;

    // Tally feedback
    let feedbackUp = 0;
    let feedbackDown = 0;

    for (const entry of feedbackEntries ?? []) {
      const meta = entry.metadata as Record<string, unknown> | null;
      if (meta?.type === "feedback") {
        if (meta.feedback === "up") feedbackUp++;
        if (meta.feedback === "down") feedbackDown++;
      }
    }

    // Build recent conversations list
    const recentConversations = (conversations ?? []).slice(0, 10).map((conv) => ({
      session_id: conv.session_id,
      title: conv.title ?? "Untitled",
      messageCount: sessionMessageCounts[conv.session_id] ?? 0,
      totalTokens: sessionTokens[conv.session_id] ?? 0,
      lastMessageAt: conv.last_message_at ?? "",
    }));

    return Response.json({
      totalConversations: totalConversations ?? 0,
      totalMessages: totalMessages ?? 0,
      totalTokens,
      estimatedCost,
      feedbackUp,
      feedbackDown,
      avgTokensPerMessage:
        messagesWithUsage > 0 ? Math.round(totalTokens / messagesWithUsage) : 0,
      recentConversations,
      totalInputTokens,
      totalOutputTokens,
      messagesWithUnknownModel,
    });
  },
);
