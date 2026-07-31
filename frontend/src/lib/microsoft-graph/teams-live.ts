import "server-only";

/**
 * Live Teams reads from Microsoft Graph (source of truth) for the Teams Messages
 * UI. Two operations:
 *  - listLiveTeamsConversations(): enumerate every chat across the configured
 *    mailboxes (with members + last-message preview) → the conversation list.
 *    This surfaces ALL conversations, unlike getAllMessages which only returns
 *    the most-recent N messages and silently drops quieter chats.
 *  - getLiveChatMessages(chatId): the full thread, fetched lazily on selection.
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com";

type GraphEnv =
  | { ok: true; clientId: string; clientSecret: string; tenantId: string }
  | { ok: false; missing: string[] };

function graphEnv(): GraphEnv {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const missing = (
    [
      ["MICROSOFT_CLIENT_ID", clientId],
      ["MICROSOFT_CLIENT_SECRET", clientSecret],
      ["MICROSOFT_TENANT_ID", tenantId],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (!clientId || !clientSecret || !tenantId) return { ok: false, missing };
  return { ok: true, clientId, clientSecret, tenantId };
}

function syncUsers(): string[] {
  return Array.from(
    new Set(
      (process.env.MICROSOFT_SYNC_USERS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

async function getToken(env: Extract<GraphEnv, { ok: true }>): Promise<string> {
  const res = await fetch(`${TOKEN_URL}/${env.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.clientId,
      client_secret: env.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Graph token returned no access_token");
  return data.access_token;
}

async function graphGet<T>(pathOrUrl: string, token: string): Promise<T> {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph GET ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function stripHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

type GraphMember = { displayName?: string | null };
type GraphPreview = {
  createdDateTime?: string | null;
  body?: { content?: string | null } | null;
  from?: { user?: { displayName?: string | null } | null } | null;
};
type GraphChat = {
  id?: string;
  topic?: string | null;
  members?: GraphMember[];
  lastMessagePreview?: GraphPreview | null;
};

export type LiveConversationSummary = {
  id: string;
  title: string;
  participants: string[];
  preview: string;
  lastActivity: string | null;
};

function chatTitle(names: string[], topic: string | null | undefined, id: string): string {
  if (topic?.trim()) return topic.trim();
  if (names.length === 0) return "Teams chat";
  return names.length > 4 ? `${names.slice(0, 4).join(", ")} +${names.length - 4}` : names.join(", ");
}

type ConversationListResult = {
  conversations: LiveConversationSummary[];
  checkedMailboxes: string[];
  warning?: string;
};

export async function listLiveTeamsConversations(): Promise<ConversationListResult> {
  const env = graphEnv();
  if (!env.ok) {
    return { conversations: [], checkedMailboxes: [], warning: `Microsoft Graph not configured: ${env.missing.join(", ")}` };
  }
  const mailboxes = syncUsers();
  if (mailboxes.length === 0) {
    return { conversations: [], checkedMailboxes: [], warning: "MICROSOFT_SYNC_USERS is empty." };
  }

  const token = await getToken(env);
  const byId = new Map<string, LiveConversationSummary>();

  await Promise.all(
    mailboxes.slice(0, 14).map(async (mailbox) => {
      let next: string | null = `/users/${encodeURIComponent(mailbox)}/chats?$expand=members,lastMessagePreview&$top=50`;
      let pages = 0;
      while (next && pages < 4) {
        let data: { value?: GraphChat[]; "@odata.nextLink"?: string };
        try {
          data = await graphGet(next, token);
        } catch {
          break;
        }
        for (const chat of data.value ?? []) {
          if (!chat.id) continue;
          const names = Array.from(
            new Set((chat.members ?? []).map((m) => m.displayName?.trim()).filter((n): n is string => Boolean(n))),
          );
          const lmp = chat.lastMessagePreview ?? null;
          const lastActivity = lmp?.createdDateTime ?? null;
          const fromName = lmp?.from?.user?.displayName ?? null;
          const previewText = stripHtml(lmp?.body?.content);
          const summary: LiveConversationSummary = {
            id: chat.id,
            title: chatTitle(names, chat.topic, chat.id),
            participants: names,
            preview: previewText ? (fromName ? `${fromName}: ${previewText}` : previewText) : "",
            lastActivity,
          };
          const existing = byId.get(chat.id);
          if (!existing || (lastActivity && (!existing.lastActivity || lastActivity > existing.lastActivity))) {
            byId.set(chat.id, summary);
          }
        }
        next = data["@odata.nextLink"] ?? null;
        pages++;
      }
    }),
  );

  const conversations = Array.from(byId.values())
    .filter((c) => c.lastActivity)
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));

  return { conversations, checkedMailboxes: mailboxes };
}

export type LiveChatMessage = { id: string; sender: string; timestamp: string; text: string };

export async function getLiveChatMessages(chatId: string): Promise<LiveChatMessage[]> {
  const env = graphEnv();
  if (!env.ok) return [];
  const token = await getToken(env);

  type GraphMessage = {
    id?: string;
    messageType?: string | null;
    createdDateTime?: string | null;
    lastModifiedDateTime?: string | null;
    from?: { user?: { displayName?: string | null } | null; application?: { displayName?: string | null } | null } | null;
    body?: { content?: string | null } | null;
  };

  const data = await graphGet<{ value?: GraphMessage[] }>(
    `/chats/${encodeURIComponent(chatId)}/messages?$top=50`,
    token,
  );

  return (data.value ?? [])
    .filter((m) => m.messageType === "message" && stripHtml(m.body?.content))
    .map((m) => ({
      id: m.id ?? "",
      sender: m.from?.user?.displayName ?? m.from?.application?.displayName ?? "Unknown",
      timestamp: m.createdDateTime ?? m.lastModifiedDateTime ?? "",
      text: stripHtml(m.body?.content),
    }))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
