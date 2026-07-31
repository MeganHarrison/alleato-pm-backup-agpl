import "server-only";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com";

export type RecentTeamsMessage = {
  id: string;
  mailbox: string;
  chatId: string;
  chatLabel: string;
  chatType: string | null;
  createdDateTime: string | null;
  lastModifiedDateTime: string | null;
  senderName: string | null;
  senderEmail: string | null;
  content: string;
  participants: string[];
};

export type RecentTeamsMessagesResult = {
  status: "checked" | "skipped" | "failed";
  rows: RecentTeamsMessage[];
  checkedMailboxes: string[];
  warning?: string;
};

type GraphCollection<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
};

type GraphEnvResult =
  | {
      ok: true;
      clientId: string;
      clientSecret: string;
      tenantId: string;
    }
  | {
      ok: false;
      missing: string[];
    };

type GraphChat = {
  id?: string;
  chatType?: string;
  topic?: string | null;
  members?: Array<{
    displayName?: string | null;
    email?: string | null;
    mail?: string | null;
    userPrincipalName?: string | null;
  }>;
};

type GraphChatMessage = {
  id?: string;
  chatId?: string;
  chatType?: string;
  createdDateTime?: string | null;
  lastModifiedDateTime?: string | null;
  messageType?: string | null;
  from?: {
    user?: {
      displayName?: string | null;
      email?: string | null;
      mail?: string | null;
      userPrincipalName?: string | null;
    };
    application?: {
      displayName?: string | null;
    };
  } | null;
  body?: {
    content?: string | null;
  } | null;
};

function graphEnv(): GraphEnvResult {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const missing = ([
    ["MICROSOFT_CLIENT_ID", clientId],
    ["MICROSOFT_CLIENT_SECRET", clientSecret],
    ["MICROSOFT_TENANT_ID", tenantId],
  ] as const)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (!clientId || !clientSecret || !tenantId) {
    return { ok: false as const, missing };
  }

  return {
    ok: true as const,
    clientId,
    clientSecret,
    tenantId,
  };
}

function syncUsers(): string[] {
  return Array.from(
    new Set(
      (process.env.MICROSOFT_SYNC_USERS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

async function getGraphToken(): Promise<string> {
  const env = graphEnv();
  if (!env.ok) {
    throw new Error(`Missing Microsoft Graph env vars: ${env.missing.join(", ")}`);
  }

  const response = await fetch(`${TOKEN_URL}/${env.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.clientId,
      client_secret: env.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!response.ok) {
    throw new Error(`Graph token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Graph token request returned no access_token");
  }
  return data.access_token;
}

async function graphGet<T>(pathOrUrl: string, token: string): Promise<T> {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body ? `: ${body.slice(0, 500)}` : "";
    throw new Error(`Graph GET failed ${response.status} ${response.statusText}${detail}`);
  }
  return (await response.json()) as T;
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

function identityParts(input: {
  displayName?: string | null;
  email?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
} | null | undefined): string[] {
  if (!input) return [];
  return [input.displayName, input.email, input.mail, input.userPrincipalName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function chatLabel(chat: GraphChat): { label: string; participants: string[]; chatType: string | null } {
  const participants = Array.from(new Set((chat.members ?? []).flatMap(identityParts)));
  const names = Array.from(
    new Set(
      (chat.members ?? [])
        .map((member) => member.displayName?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const topic = chat.topic?.trim();
  if (topic) {
    return { label: topic, participants, chatType: chat.chatType ?? null };
  }
  if (names.length > 0) {
    return {
      label: names.length > 4 ? `${names.slice(0, 4).join(", ")} +${names.length - 4}` : names.join(", "),
      participants,
      chatType: chat.chatType ?? null,
    };
  }
  return { label: chat.id?.slice(0, 16) ?? "Unknown Teams chat", participants, chatType: chat.chatType ?? null };
}

async function loadChatLabels(mailbox: string, token: string): Promise<Map<string, ReturnType<typeof chatLabel>>> {
  const labels = new Map<string, ReturnType<typeof chatLabel>>();
  const select = "$select=id,chatType,topic";
  const expand = "$expand=members($select=displayName,email,mail,userPrincipalName)";
  const encodedMailbox = encodeURIComponent(mailbox);

  for (const path of [
    `/users/${encodedMailbox}/chats?${select}&${expand}`,
    `/users/${encodedMailbox}/chats?${select}`,
  ]) {
    try {
      const data = await graphGet<GraphCollection<GraphChat>>(path, token);
      for (const chat of data.value ?? []) {
        if (!chat.id) continue;
        labels.set(chat.id, chatLabel(chat));
      }
      return labels;
    } catch (error) {
      if (path.includes("$expand=")) continue;
      throw error;
    }
  }

  return labels;
}

function queryTokens(query: string | null | undefined): string[] {
  const normalized = (query ?? "").toLowerCase();
  const emailTokens = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
  const words = normalized
    .replace(/[^a-z0-9@._%+-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .filter(
      (word) =>
        ![
          "teams",
          "team",
          "messages",
          "message",
          "recent",
          "latest",
          "today",
          "thread",
          "with",
          "from",
          "show",
          "what",
          "pull",
        ].includes(word),
    );
  return Array.from(new Set([...emailTokens, ...words]));
}

function messageMatchesQuery(message: RecentTeamsMessage, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = [
    message.chatLabel,
    message.senderName,
    message.senderEmail,
    message.content,
    ...message.participants,
  ]
    .join(" ")
    .toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

function startIsoFromDate(date: string | undefined): string {
  if (date) return `${date}T00:00:00.000Z`;
  const fallback = new Date();
  fallback.setUTCDate(fallback.getUTCDate() - 7);
  return fallback.toISOString();
}

function endIsoFromDate(date: string | undefined): string {
  if (date) return `${date}T23:59:59.999Z`;
  return new Date().toISOString();
}

export async function fetchRecentTeamsMessagesFromGraph(params: {
  startDate?: string;
  endDate?: string;
  query?: string;
  limit: number;
}): Promise<RecentTeamsMessagesResult> {
  const env = graphEnv();
  if (!env.ok) {
    return {
      status: "skipped",
      rows: [],
      checkedMailboxes: [],
      warning: `Microsoft Graph is not configured: ${env.missing.join(", ")}`,
    };
  }

  const mailboxes = syncUsers();
  if (mailboxes.length === 0) {
    return {
      status: "skipped",
      rows: [],
      checkedMailboxes: [],
      warning: "MICROSOFT_SYNC_USERS is empty, so no Teams mailboxes are available for live retrieval.",
    };
  }

  try {
    const token = await getGraphToken();
    const startIso = startIsoFromDate(params.startDate);
    const endIso = endIsoFromDate(params.endDate);
    const tokens = queryTokens(params.query);
    const rows: RecentTeamsMessage[] = [];

    for (const mailbox of mailboxes.slice(0, 12)) {
      const labels = await loadChatLabels(mailbox, token).catch(() => new Map<string, ReturnType<typeof chatLabel>>());
      const path =
        `/users/${encodeURIComponent(mailbox)}/chats/getAllMessages` +
        `?$top=50&$filter=${encodeURIComponent(`lastModifiedDateTime gt ${startIso} and lastModifiedDateTime lt ${endIso}`)}`;
      const data = await graphGet<GraphCollection<GraphChatMessage>>(path, token);

      for (const item of data.value ?? []) {
        if (!item.id || !item.chatId || item.messageType !== "message") continue;
        const content = stripHtml(item.body?.content);
        if (!content) continue;
        const label = labels.get(item.chatId) ?? {
          label: item.chatId.slice(0, 16),
          participants: [],
          chatType: item.chatType ?? null,
        };
        const sender = item.from?.user ?? null;
        const message: RecentTeamsMessage = {
          id: item.id,
          mailbox,
          chatId: item.chatId,
          chatLabel: label.label,
          chatType: label.chatType ?? item.chatType ?? null,
          createdDateTime: item.createdDateTime ?? null,
          lastModifiedDateTime: item.lastModifiedDateTime ?? null,
          senderName: sender?.displayName ?? item.from?.application?.displayName ?? null,
          senderEmail: sender?.email ?? sender?.mail ?? sender?.userPrincipalName ?? null,
          content,
          participants: Array.from(new Set([...label.participants, ...identityParts(sender), mailbox])),
        };
        if (messageMatchesQuery(message, tokens)) {
          rows.push(message);
        }
      }
    }

    rows.sort((a, b) => {
      const aTime = Date.parse(a.createdDateTime ?? a.lastModifiedDateTime ?? "");
      const bTime = Date.parse(b.createdDateTime ?? b.lastModifiedDateTime ?? "");
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });

    return {
      status: "checked",
      rows: rows.slice(0, Math.max(1, params.limit)),
      checkedMailboxes: mailboxes,
    };
  } catch (error) {
    return {
      status: "failed",
      rows: [],
      checkedMailboxes: mailboxes,
      warning: error instanceof Error ? error.message : "Unknown Microsoft Graph Teams retrieval failure",
    };
  }
}
