import { Chat, ThreadImpl, type SerializedThread, type PostableCard } from "chat";
import type { Json } from "@/types/database.types";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createMemoryState } from "@chat-adapter/state-memory";
import { after } from "next/server";
import pg from "pg";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  generateBotResponse,
  persistChatMessage,
  runPostResponseTasks,
} from "@/lib/ai/bot-core";
import type { Thread, Message } from "chat";

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _chat: Chat | null = null;

export function resetTeamsChat(): void {
  _chat = null;
}

export function getTeamsChat(): Chat {
  if (_chat) return _chat;

  const appId = process.env.TEAMS_APP_ID;
  if (!appId) throw new Error("TEAMS_APP_ID is not set");
  const appPassword = process.env.TEAMS_APP_PASSWORD;
  if (!appPassword) throw new Error("TEAMS_APP_PASSWORD is not set");

  const teamsAdapter = createTeamsAdapter({
    appId,
    appPassword,
    appTenantId: process.env.TEAMS_APP_TENANT_ID,
    appType: process.env.TEAMS_APP_TENANT_ID ? "SingleTenant" : "MultiTenant",
  });

  // Use Postgres state if BOT_STATE_DATABASE_URL is configured, otherwise fall
  // back to in-memory state. Memory state works for DM bots (no subscription
  // features needed) and avoids Supabase pooler connection issues in Vercel.
  const stateUrl = process.env.BOT_STATE_DATABASE_URL;
  const state = stateUrl
    ? createPostgresState({
        client: new pg.Pool({ connectionString: stateUrl, ssl: { rejectUnauthorized: false } }),
        keyPrefix: "alleato-bot",
      })
    : createMemoryState();

  const chat = new Chat({
    adapters: { teams: teamsAdapter },
    state,
    userName: "Alleato AI",
  });

  chat.onNewMention(async (thread, message) => {
    await handleMessage(thread, message, "mention");
  });

  chat.onDirectMessage(async (thread, message) => {
    await handleMessage(thread, message, "dm");
  });

  chat.onSubscribedMessage(async (thread, message) => {
    await handleMessage(thread, message, "mention");
  });

  // Register as singleton so ThreadImpl.fromJSON can use lazy adapter resolution
  chat.registerSingleton();

  _chat = chat;
  return chat;
}

// ---------------------------------------------------------------------------
// Proactive messaging — post to a user's DM or last channel thread
// ---------------------------------------------------------------------------

async function resolveTeamsThread(supabaseUserId: string, preferDm = true) {
  getTeamsChat();

  const { data: ref } = await serviceDb.from("teams_conversation_refs")
    .select("thread_json")
    .eq("supabase_user_id", supabaseUserId)
    .eq("is_dm", preferDm)
    .maybeSingle();

  const threadJson = ref?.thread_json ?? (
    (await serviceDb.from("teams_conversation_refs")
      .select("thread_json")
      .eq("supabase_user_id", supabaseUserId)
      .maybeSingle()
    ).data?.thread_json
  );

  if (!threadJson) {
    throw new Error(`No Teams conversation ref found for user ${supabaseUserId}`);
  }

  return ThreadImpl.fromJSON(threadJson as unknown as SerializedThread);
}

export async function sendProactiveMessage(
  supabaseUserId: string,
  text: string,
  preferDm = true,
): Promise<unknown> {
  const thread = await resolveTeamsThread(supabaseUserId, preferDm);
  return thread.post(text);
}

export async function sendProactiveCard(
  supabaseUserId: string,
  card: PostableCard,
  preferDm = true,
): Promise<unknown> {
  const thread = await resolveTeamsThread(supabaseUserId, preferDm);
  return thread.post(card);
}

// ---------------------------------------------------------------------------
// Core message handler
// ---------------------------------------------------------------------------

const TEAMS_MAX_CHARS = 25_000;

function chunkText(text: string): string[] {
  if (text.length <= TEAMS_MAX_CHARS) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    // Break at last newline within the limit to avoid mid-sentence splits
    const slice = remaining.slice(0, TEAMS_MAX_CHARS);
    const breakAt = slice.lastIndexOf("\n");
    const end = breakAt > TEAMS_MAX_CHARS * 0.5 ? breakAt : TEAMS_MAX_CHARS;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  return chunks;
}

async function storeConversationRef(
  supabaseUserId: string,
  thread: Thread,
  isDm: boolean,
): Promise<void> {
  try {
        await serviceDb.from("teams_conversation_refs").upsert(
      {
        supabase_user_id: supabaseUserId,
        thread_json: thread.toJSON() as unknown as Json,
        is_dm: isDm,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "supabase_user_id,is_dm" },
    );
  } catch (err) {
    console.error("[teams-bot] failed to store conversation ref", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Per-checkpoint debug log — durable signal that bypasses Vercel post-response
// log capture. Each checkpoint becomes a row in bot_debug_log we can query
// directly to see exactly which step succeeded for any given message. Wraps
// errors so a debug write failure can never break the bot.
async function logCheckpoint(
  checkpoint: string,
  ctx: {
    teamsUserId?: string;
    supabaseUserId?: string | null;
    threadId?: string;
    messagePreview?: string;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  try {
        await serviceDb.from("bot_debug_log").insert({
      platform: "teams",
      checkpoint,
      platform_user_id: ctx.teamsUserId ?? null,
      supabase_user_id: ctx.supabaseUserId ?? null,
      thread_id: ctx.threadId ?? null,
      message_preview: ctx.messagePreview ?? null,
      extra: (ctx.extra ?? {}) as Json,
    });
  } catch (error) {
    console.error("[teams-bot] debug log insert failed", {
      checkpoint,
      teamsUserId: ctx.teamsUserId ?? null,
      supabaseUserId: ctx.supabaseUserId ?? null,
      threadId: ctx.threadId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleMessage(
  thread: Thread,
  message: Message,
  source: "mention" | "dm",
): Promise<void> {
  const teamsUserIdEarly = message.author.userId;
  const messageTextEarly = message.text.trim();
  const previewEarly = messageTextEarly.slice(0, 200);

  // Capture every field the SDK exposes on author so we can identify a stable
  // join key (AAD object ID, email, etc.) for users whose channel-specific
  // userId rotates across Teams clients. Stored in bot_debug_log.extra.
  const authorAny = message.author as unknown as Record<string, unknown>;
  const authorSnapshot = {
    userId: message.author.userId,
    userName: message.author.userName,
    fullName: message.author.fullName,
    aadObjectId: authorAny.aadObjectId ?? authorAny.aad_object_id ?? null,
    email: authorAny.email ?? authorAny.upn ?? null,
    tenantId: authorAny.tenantId ?? null,
    role: authorAny.role ?? null,
    allKeys: Object.keys(authorAny),
  };

  console.log("[teams-bot] handleMessage called", {
    source,
    threadId: thread.id,
    userId: teamsUserIdEarly,
    textPreview: messageTextEarly.slice(0, 80),
  });

  await logCheckpoint("enter", {
    teamsUserId: teamsUserIdEarly,
    threadId: thread.id,
    messagePreview: previewEarly,
    extra: { source, authorSnapshot },
  });

  try {
    const teamsUserId = message.author.userId;
    const displayName = message.author.fullName;
    const messageText = message.text.trim();
    const isDm = source === "dm";

    // Ping test — bypasses all DB/AI to confirm basic Teams messaging works
    if (messageText.toLowerCase() === "ping") {
      console.log("[teams-bot] ping received, sending pong");
      await logCheckpoint("ping", { teamsUserId, threadId: thread.id });
      await thread.post("pong 🏓");
      await logCheckpoint("ping_posted", { teamsUserId, threadId: thread.id });
      return;
    }


    let supabaseUserId: string | null = null;
    let resolvedVia: "platform_user_id" | "aad_object_id" | "email_auto_link" | null = null;

    // 1. Primary lookup: platform_user_id (channel-specific Teams ID)
    // Retry up to 3 times with 3s delay — transient DB overload (503) during
    // the 30-min sync cron should resolve within seconds, not require the user
    // to re-link or get an error prompt.
    let mapping: { supabase_user_id: string } | null = null;
    let mappingErr: { message: string; code: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
      const result = await serviceDb.from("bot_user_mappings")
        .select("supabase_user_id")
        .eq("platform", "teams")
        .eq("platform_user_id", teamsUserId)
        .maybeSingle();
      if (!result.error) {
        mapping = result.data;
        mappingErr = null;
        break;
      }
      mappingErr = result.error as { message: string; code: string };
    }

    // All retries exhausted — DB still unreachable. Return a transient error
    // rather than falling through to "I don't recognize you".
    if (mappingErr) {
      await logCheckpoint("db_error_on_mapping_lookup", {
        teamsUserId,
        threadId: thread.id,
        extra: { error: mappingErr.message, code: mappingErr.code },
      });
      await thread.post(
        "⚠️ I'm having trouble connecting to the database right now. Please try again in a moment.",
      );
      return;
    }

    if (mapping) {
      supabaseUserId = mapping.supabase_user_id;
      resolvedVia = "platform_user_id";
    }

    // 2. Self-healing fallback: AAD object ID (stable across clients).
    //    If primary missed but the SDK gave us aadObjectId, find the user
    //    by joining against ANY of their existing platform_user_id rows
    //    that we previously stored. If found, AUTO-INSERT the new
    //    platform_user_id as an additional row so this lookup succeeds
    //    cheaply next time and the user never sees the "I don't recognize"
    //    prompt again on this client.
    if (!supabaseUserId) {
      const aadId = typeof authorSnapshot.aadObjectId === "string"
        ? authorSnapshot.aadObjectId
        : null;
      if (aadId) {
        // Look for any existing teams mapping whose platform_user_id ends
        // with the AAD GUID — that's how Brandon's original row was stored
        // (`29:<aad-guid>`). This gives us a free join key for legacy rows.
        const { data: byAad } = await serviceDb.from("bot_user_mappings")
          .select("supabase_user_id")
          .eq("platform", "teams")
          .like("platform_user_id", `%${aadId}%`)
          .maybeSingle();
        if (byAad) {
          supabaseUserId = byAad.supabase_user_id;
          resolvedVia = "aad_object_id";
          // Add a row with the current platform_user_id so this fast-path
          // works next time without the LIKE scan.
          await serviceDb.from("bot_user_mappings").insert({
            platform: "teams",
            platform_user_id: teamsUserId,
            supabase_user_id: supabaseUserId,
            display_name: displayName || null,
          });
          await logCheckpoint("self_healed_via_aad", {
            teamsUserId,
            supabaseUserId,
            threadId: thread.id,
            extra: { aadId },
          });
        }
      }
    }

    // 3. Original fallback: auto-link by email if userName looks like one
    if (!supabaseUserId) {
      const email = message.author.userName?.includes("@")
        ? message.author.userName
        : (typeof authorSnapshot.email === "string" ? authorSnapshot.email : null);

      if (email) {
        const { data: userRecord } = await serviceDb.from("user_profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (userRecord) {
          supabaseUserId = userRecord.id;
          resolvedVia = "email_auto_link";
          const { error: insertErr } = await serviceDb.from("bot_user_mappings").insert({
            platform: "teams",
            platform_user_id: teamsUserId,
            supabase_user_id: supabaseUserId,
            display_name: displayName || null,
          });
          if (insertErr) {
            console.error("[teams-bot] auto-link insert failed", { error: insertErr.message });
          }
        }
      }
    }

    await logCheckpoint("mapping_resolved", {
      teamsUserId,
      supabaseUserId,
      threadId: thread.id,
      extra: { mapped: !!mapping, hasUserId: !!supabaseUserId, resolvedVia },
    });

    // Catch any "link ..." attempt up front so a malformed code (e.g. "link foo"
    // — too short) doesn't fall through to the AI handler. Falling through is
    // a silent UX failure: user types "link" expecting linking, gets a chatbot
    // reply instead of a clear error.
    if (/^link(\s|$)/i.test(messageText)) {
      await logCheckpoint("link_branch", { teamsUserId, threadId: thread.id });
      const linkMatch = messageText.match(/^link\s+([A-Za-z0-9_-]{6,12})$/i);
      if (linkMatch) {
        await handleLinkCommand(thread, teamsUserId, displayName, linkMatch[1]);
      } else {
        await thread.post(
          "❌ Invalid or expired code. Generate a new one in **Settings → Profile → Microsoft Teams**.",
        );
      }
      return;
    }

    if (!supabaseUserId) {
      await logCheckpoint("not_linked_prompt", { teamsUserId, threadId: thread.id });
      await thread.post(
        "👋 I don't recognize your account yet. To link your Alleato account:\n\n" +
          "1. Open **Settings → Profile → Microsoft Teams** in Alleato\n" +
          "2. Copy your link code\n" +
          "3. Send me: `link <your-code>`",
      );
      return;
    }

    // Capture as const — supabaseUserId is non-null past the guard above
    const userId = supabaseUserId;

    // Store conversation ref for proactive messaging (fire-and-forget)
    after(async () => {
      await storeConversationRef(userId, thread, isDm);
    });

    await thread.startTyping().catch(() => undefined);

    // Scope session to user+thread so channel convos and DMs stay isolated
    const sessionId = `teams:${supabaseUserId}:${thread.id}`;

    await logCheckpoint("before_persist_user", {
      teamsUserId,
      supabaseUserId,
      threadId: thread.id,
      extra: { sessionId },
    });

    await persistChatMessage({
      sessionId,
      userId: supabaseUserId,
      role: "user",
      content: messageText,
      metadata: { platform: "teams", teamsUserId, threadId: thread.id },
    });

    await logCheckpoint("after_persist_user", {
      teamsUserId,
      supabaseUserId,
      threadId: thread.id,
    });

    const result = await generateBotResponse({
      userId: supabaseUserId,
      messageText,
      sessionId,
      platform: "teams",
    });

    await logCheckpoint("after_generate", {
      teamsUserId,
      supabaseUserId,
      threadId: thread.id,
      extra: {
        responseLength: result.text.length,
        responseSource: result.responseSource,
        rawTextLength: result.rawTextLength,
        toolCallCount: result.toolTrace.length,
      },
    });

    await persistChatMessage({
      sessionId,
      userId: supabaseUserId,
      role: "assistant",
      content: result.text,
      metadata: {
        platform: "teams",
        model: "strategist",
        toolCallCount: result.toolTrace.length,
        responseSource: result.responseSource,
        rawTextLength: result.rawTextLength,
        usage: result.usage,
      },
    });

    await logCheckpoint("after_persist_assistant", {
      teamsUserId,
      supabaseUserId,
      threadId: thread.id,
    });

    // Send response, chunking if needed
    const chunks = chunkText(result.text);
    for (const chunk of chunks) {
      await thread.post(chunk);
    }

    await logCheckpoint("after_post", {
      teamsUserId,
      supabaseUserId,
      threadId: thread.id,
      extra: { chunkCount: chunks.length },
    });

    after(async () => {
      await runPostResponseTasks(sessionId, userId);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const name = err instanceof Error ? err.name : undefined;
    console.error("[teams-bot] unhandled error in handleMessage", {
      error: msg,
      threadId: thread.id,
    });
    await logCheckpoint("error", {
      teamsUserId: teamsUserIdEarly,
      threadId: thread.id,
      messagePreview: previewEarly,
      extra: { error: msg, stack, name },
    });
    await thread
      .post("❌ Something went wrong. Please try again in a moment.")
      .catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// /link <code> command
// ---------------------------------------------------------------------------

async function handleLinkCommand(
  thread: Thread,
  teamsUserId: string,
  displayName: string,
  code: string,
): Promise<void> {

  const { data: linkCode, error: lookupError } = await serviceDb.from("teams_link_codes")
    .select("user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) {
    console.error("[teams-bot] failed to look up link code", { code, error: lookupError.message });
    await thread.post("❌ Something went wrong verifying your code. Please try again.");
    return;
  }

  if (!linkCode) {
    await thread.post("❌ That code is invalid. Please generate a new one in **Settings → Profile → Microsoft Teams**.");
    return;
  }

  if (linkCode.used_at) {
    await thread.post("❌ That code has already been used. Please generate a new one.");
    return;
  }

  if (new Date(linkCode.expires_at) < new Date()) {
    await thread.post("❌ That code has expired (codes are valid for 10 minutes). Please generate a new one.");
    return;
  }

  const { error: markUsedError } = await serviceDb.from("teams_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  if (markUsedError) {
    console.error("[teams-bot] failed to mark link code used", { code, error: markUsedError.message });
    await thread.post("❌ Something went wrong linking your account. Please try again.");
    return;
  }

  const { error: upsertError } = await serviceDb.from("bot_user_mappings").upsert(
    {
      platform: "teams",
      platform_user_id: teamsUserId,
      supabase_user_id: linkCode.user_id,
      display_name: displayName || null,
    },
    { onConflict: "platform,platform_user_id" },
  );

  if (upsertError) {
    console.error("[teams-bot] failed to create bot_user_mappings", {
      error: upsertError.message,
      teamsUserId,
    });
    await thread.post("❌ Something went wrong linking your account. Please try again or contact support.");
    return;
  }

  await thread.post("✅ Your Alleato account is now linked! You can ask me anything about your projects.");
}
