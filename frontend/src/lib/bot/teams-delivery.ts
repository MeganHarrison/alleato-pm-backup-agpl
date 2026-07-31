import { Chat, ThreadImpl, type PostableCard, type SerializedThread } from "chat";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createMemoryState } from "@chat-adapter/state-memory";
import pg from "pg";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Json } from "@/types/database.types";

let teamsDeliveryChat: Chat | null = null;

export function resetTeamsDelivery(): void {
  teamsDeliveryChat = null;
}

export function getTeamsDelivery(): Chat {
  if (teamsDeliveryChat) return teamsDeliveryChat;

  const appId = process.env.TEAMS_APP_ID;
  const appPassword = process.env.TEAMS_APP_PASSWORD;
  if (!appId || !appPassword) {
    throw new Error(
      "Teams delivery is not configured: TEAMS_APP_ID and TEAMS_APP_PASSWORD are required.",
    );
  }

  const stateUrl = process.env.BOT_STATE_DATABASE_URL;
  const chat = new Chat({
    adapters: {
      teams: createTeamsAdapter({
        appId,
        appPassword,
        appTenantId: process.env.TEAMS_APP_TENANT_ID,
        appType: process.env.TEAMS_APP_TENANT_ID
          ? "SingleTenant"
          : "MultiTenant",
      }),
    },
    state: stateUrl
      ? createPostgresState({
          client: new pg.Pool({
            connectionString: stateUrl,
            ssl: { rejectUnauthorized: false },
          }),
          keyPrefix: "alleato-delivery",
        })
      : createMemoryState(),
    userName: "Alleato",
  });
  chat.registerSingleton();
  teamsDeliveryChat = chat;
  return chat;
}

function parseSerializedThread(value: Json): SerializedThread {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored Teams conversation reference is not an object.");
  }

  const adapterName = value.adapterName;
  const channelId = value.channelId;
  const id = value.id;
  const isDM = value.isDM;
  if (
    value._type !== "chat:Thread" ||
    typeof adapterName !== "string" ||
    typeof channelId !== "string" ||
    typeof id !== "string" ||
    typeof isDM !== "boolean"
  ) {
    throw new Error("Stored Teams conversation reference is malformed.");
  }

  return {
    _type: "chat:Thread",
    adapterName,
    channelId,
    id,
    isDM,
  };
}

async function resolveTeamsThread(
  supabaseUserId: string,
  preferDm: boolean,
) {
  getTeamsDelivery();
  const { data: preferred } = await serviceDb
    .from("teams_conversation_refs")
    .select("thread_json")
    .eq("supabase_user_id", supabaseUserId)
    .eq("is_dm", preferDm)
    .maybeSingle();
  const fallback =
    preferred ??
    (
      await serviceDb
        .from("teams_conversation_refs")
        .select("thread_json")
        .eq("supabase_user_id", supabaseUserId)
        .maybeSingle()
    ).data;

  if (!fallback?.thread_json) {
    throw new Error(
      `No Teams conversation reference exists for user ${supabaseUserId}.`,
    );
  }
  return ThreadImpl.fromJSON(parseSerializedThread(fallback.thread_json));
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
