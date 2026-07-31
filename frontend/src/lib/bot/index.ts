/**
 * Chat SDK bot instance — single codebase for Slack, Teams, and Telegram.
 *
 * Wires incoming platform messages to the C-Suite AI orchestrator via bot-core.
 * Each platform auto-detects credentials from environment variables.
 *
 * Required env vars:
 *   SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
 *   TEAMS_APP_ID, TEAMS_APP_PASSWORD
 *   TELEGRAM_BOT_TOKEN
 *   DATABASE_URL (for state-pg) or POSTGRES_URL
 */

import { Chat, toAiMessages } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import {
  streamBotResponse,
  persistChatMessage,
  runPostResponseTasks,
} from "@/lib/ai/bot-core";
import type { BotLearningUsageSummary } from "@/lib/ai/bot-core";
import { recordAgentLearningUsages } from "@/lib/ai/services/agent-learning-service";
import { serviceDb } from "@/lib/supabase/service-db";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Adapter setup — only register adapters whose credentials are present
// ---------------------------------------------------------------------------

const adapters: Record<string, ReturnType<typeof createSlackAdapter | typeof createTeamsAdapter | typeof createTelegramAdapter>> = {};

if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET) {
  adapters.slack = createSlackAdapter();
}

if (process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD) {
  adapters.teams = createTeamsAdapter();
}

if (process.env.TELEGRAM_BOT_TOKEN) {
  adapters.telegram = createTelegramAdapter();
}

// ---------------------------------------------------------------------------
// State adapter — memory state for serverless (thread state is ephemeral;
// we persist conversation history in our own Supabase chat_messages table)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bot instance
// ---------------------------------------------------------------------------

export const bot = new Chat({
  userName: "alleato",
  adapters,
  state: createMemoryState(),
  // Force-release locks so new messages interrupt long-running AI responses
  onLockConflict: "force",
  // Streaming update interval for post+edit fallback (Teams, Telegram)
  streamingUpdateIntervalMs: 600,
  fallbackStreamingPlaceholderText: "Thinking...",
  logger: "warn",
});

// ---------------------------------------------------------------------------
// User mapping — resolve platform user to Supabase user ID
// ---------------------------------------------------------------------------

async function resolveUserId(platformUserId: string): Promise<string> {

  const { data: mapping } = await serviceDb.from("bot_user_mappings")
    .select("supabase_user_id")
    .eq("platform_user_id", platformUserId)
    .maybeSingle();

  // "system" is a sentinel meaning "not linked" — callers must check for it
  return mapping?.supabase_user_id ?? "system";
}

function buildUnlinkedAccountMessage(platform: string, platformUserId: string): string {
  const label = platform === "slack" ? "Slack" : platform === "teams" ? "Teams" : platform;
  return [
    `I can see this ${label} message, but I cannot answer with Alleato project context yet.`,
    "",
    `No Alleato user is linked for \`${platformUserId}\`. Link this chat account from Alleato Settings > Integrations, or ask an admin to add a \`bot_user_mappings\` row for that platform user ID.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Telegram account linking helpers
// ---------------------------------------------------------------------------

/**
 * Redeem a link code sent via /start <code>.
 * Creates a bot_user_mappings row and returns the user's display name on success.
 */
async function redeemTelegramLinkCode(
  code: string,
  telegramChatId: string,
  telegramUsername?: string,
): Promise<{ ok: true; displayName: string } | { ok: false; reason: string }> {

  const { data: row } = await serviceDb.from("telegram_link_codes")
    .select("user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (!row) return { ok: false, reason: "Code not found. Generate a new one from Settings > Integrations." };
  if (row.used_at) return { ok: false, reason: "This code has already been used. Generate a new one." };
  if (new Date(row.expires_at) < new Date()) return { ok: false, reason: "This code expired. Generate a new one — they last 10 minutes." };

  const platformUserId = `telegram:${telegramChatId}`;

  // Upsert mapping (user may be re-linking)
  const { error: mappingError } = await serviceDb.from("bot_user_mappings")
    .upsert(
      {
        platform: "telegram",
        platform_user_id: platformUserId,
        supabase_user_id: row.user_id,
        display_name: telegramUsername ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform_user_id" },
    );

  if (mappingError) return { ok: false, reason: "Database error. Please try again." };

  // Mark code as used
  await serviceDb.from("telegram_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  // Fetch display name from user profile
  const { data: profile } = await serviceDb.from("user_profiles")
    .select("full_name, first_name")
    .eq("id", row.user_id)
    .maybeSingle() as unknown as { data: { full_name?: string | null; first_name?: string | null } | null };

  const displayName =
    profile?.full_name ?? profile?.first_name ?? telegramUsername ?? "there";

  return { ok: true, displayName };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * New @mention — first message in a thread.
 * Subscribe to the thread and respond with the AI agent.
 */
bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await thread.startTyping();

  const platformUserId = `${thread.adapter.name}:${message.author?.userId ?? "unknown"}`;
  const userId = await resolveUserId(platformUserId);
  if (userId === "system") {
    await thread.post(buildUnlinkedAccountMessage(thread.adapter.name, platformUserId));
    return;
  }
  const sessionId = `bot-${nanoid(12)}`;

  // Persist the user message for memory continuity
  await persistChatMessage({
    sessionId,
    userId,
    role: "user",
    content: message.text,
  });

  // Store session ID in thread state for follow-up messages
  await thread.setState({ sessionId, userId });

  // Stream the AI response
  let learningUsage: BotLearningUsageSummary | undefined;
  const { result, toolTrace } = await streamBotResponse({
    userId,
    messageText: message.text,
    sessionId,
    onLearningUsage: (usage) => {
      learningUsage = usage;
    },
  });

  // Post the streaming response — Chat SDK handles post+edit fallback
  await thread.post(result.stream);

  // Persist the assistant response
  const fullText = await result.text;
  await persistChatMessage({
    sessionId,
    userId,
    role: "assistant",
    content: fullText,
    metadata: {
      tool_trace: toolTrace,
      model: "openai/gpt-5.4",
      architecture: "csuite",
      channel: thread.adapter.name,
    },
  });

  if (learningUsage?.learnings.length) {
    await recordAgentLearningUsages({
      sessionId,
      userId,
      messageText: message.text,
      learnings: learningUsage.learnings,
    });
  }

  // Background memory tasks
  await runPostResponseTasks(sessionId, userId);
});

/**
 * Direct messages — same as mention but for DM threads.
 * Intercepts /start <code> and /unlink before routing to AI.
 */
bot.onDirectMessage(async (thread, message) => {
  await thread.subscribe();

  const text = message.text?.trim() ?? "";
  const telegramChatId = message.author?.userId ?? "unknown";
  const telegramUsername = (message.author as unknown as { displayName?: string })?.displayName;

  // /start <code> — account linking
  if (text.startsWith("/start ") || text.startsWith("/link ")) {
    const code = text.split(" ")[1]?.trim();
    if (!code) {
      await thread.post("Send the full link command with your code, e.g. `/link ABC12345`.");
      return;
    }
    const result = await redeemTelegramLinkCode(code, telegramChatId, telegramUsername);
    if (result.ok) {
      await thread.post(
        `✅ Linked! Hi ${result.displayName} — your Telegram account is now connected to Alleato.\n\nJust send me a message and I'll answer questions about your projects, budgets, and more.`,
      );
    } else {
      await thread.post(`❌ ${result.reason}`);
    }
    return;
  }

  // /start with no code — prompt to link
  if (text === "/start") {
    const platformUserId = `telegram:${telegramChatId}`;
        const { data: mapping } = await serviceDb.from("bot_user_mappings")
      .select("supabase_user_id")
      .eq("platform_user_id", platformUserId)
      .maybeSingle();

    if (mapping) {
      await thread.post("You're already linked! Just send me a message.");
    } else {
      await thread.post(
        "👋 To use the Alleato AI assistant here, link your account first:\n\n1. Open Alleato → Settings → Integrations\n2. Click **Connect** next to Telegram\n3. A deep link will open this chat with your code automatically",
      );
    }
    return;
  }

  // /unlink — remove mapping
  if (text === "/unlink") {
    const platformUserId = `telegram:${telegramChatId}`;
        await serviceDb.from("bot_user_mappings")
      .delete()
      .eq("platform_user_id", platformUserId);
    await thread.post("Your Telegram account has been unlinked from Alleato.");
    return;
  }

  await thread.startTyping();

  const platformUserId = `${thread.adapter.name}:${message.author?.userId ?? "unknown"}`;
  const userId = await resolveUserId(platformUserId);

  // If no mapping, prompt to link instead of falling back to admin
  if (userId === "system") {
    await thread.post(
      "I don't recognise your account yet.\n\nGo to Settings → Integrations in Alleato and click **Connect** next to Telegram to link your account.",
    );
    return;
  }

  const sessionId = `bot-${nanoid(12)}`;

  await persistChatMessage({
    sessionId,
    userId,
    role: "user",
    content: message.text,
  });

  await thread.setState({ sessionId, userId });

  let learningUsage: BotLearningUsageSummary | undefined;
  const { result, toolTrace } = await streamBotResponse({
    userId,
    messageText: message.text,
    sessionId,
    onLearningUsage: (usage) => {
      learningUsage = usage;
    },
  });

  await thread.post(result.stream);

  const fullText = await result.text;
  await persistChatMessage({
    sessionId,
    userId,
    role: "assistant",
    content: fullText,
    metadata: {
      tool_trace: toolTrace,
      model: "openai/gpt-5.4",
      architecture: "csuite",
      channel: thread.adapter.name,
    },
  });

  if (learningUsage?.learnings.length) {
    await recordAgentLearningUsages({
      sessionId,
      userId,
      messageText: message.text,
      learnings: learningUsage.learnings,
    });
  }

  await runPostResponseTasks(sessionId, userId);
});

/**
 * Follow-up messages in subscribed threads — multi-turn conversation.
 */
bot.onSubscribedMessage(async (thread, message) => {
  await thread.startTyping();

  // Recover session state
  const state = (await thread.state) as {
    sessionId?: string;
    userId?: string;
  } | null;
  const platformUserId = `${thread.adapter.name}:${message.author?.userId ?? "unknown"}`;
  const userId = state?.userId ?? (await resolveUserId(platformUserId));
  if (userId === "system") {
    await thread.post(buildUnlinkedAccountMessage(thread.adapter.name, platformUserId));
    return;
  }
  const sessionId = state?.sessionId ?? `bot-${nanoid(12)}`;

  // Persist user message
  await persistChatMessage({
    sessionId,
    userId,
    role: "user",
    content: message.text,
  });

  // Build conversation history from thread messages
  const threadMessages = [];
  for await (const msg of thread.allMessages) {
    threadMessages.push(msg);
  }
  const conversationHistory = await toAiMessages(threadMessages);

  // Stream the AI response with full conversation context
  let learningUsage: BotLearningUsageSummary | undefined;
  const { result, toolTrace } = await streamBotResponse({
    userId,
    messageText: message.text,
    sessionId,
    conversationHistory,
    onLearningUsage: (usage) => {
      learningUsage = usage;
    },
  });

  await thread.post(result.stream);

  const fullText = await result.text;
  await persistChatMessage({
    sessionId,
    userId,
    role: "assistant",
    content: fullText,
    metadata: {
      tool_trace: toolTrace,
      model: "openai/gpt-5.4",
      architecture: "csuite",
      channel: thread.adapter.name,
    },
  });

  if (learningUsage?.learnings.length) {
    await recordAgentLearningUsages({
      sessionId,
      userId,
      messageText: message.text,
      learnings: learningUsage.learnings,
    });
  }

  await runPostResponseTasks(sessionId, userId);
});
