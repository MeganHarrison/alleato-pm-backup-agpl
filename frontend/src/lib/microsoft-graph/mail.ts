import "server-only";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com";

export type OutlookMailRecipient = {
  email: string;
  name?: string;
};

export type OutlookMailDraftInput = {
  mailboxUserId?: string | null;
  subject: string;
  body: string;
  toRecipients: OutlookMailRecipient[];
  ccRecipients?: OutlookMailRecipient[];
  bccRecipients?: OutlookMailRecipient[];
  replyToGraphMessageId?: string | null;
  importance?: "low" | "normal" | "high";
};

export type OutlookMailDraftResult = {
  id: string;
  subject: string;
  webLink: string | null;
  mailboxUserId: string;
  recipientCount: number;
  mode: "new_message" | "reply";
};

export type OutlookLiveMessage = {
  id: string;
  conversationId: string | null;
  subject: string;
  fromName: string | null;
  fromEmail: string | null;
  toList: string[];
  ccList: string[];
  receivedAt: string;
  bodyPreview: string | null;
  hasAttachments: boolean;
  webLink: string | null;
  importance: string | null;
  isRead: boolean | null;
  mailbox: string;
};

export type ListOutlookMessagesInput = {
  mailboxUserId?: string | null;
  sinceIso?: string | null;
  limit?: number;
};

export type ListOutlookMessagesResult =
  | {
      ok: true;
      source: "microsoft_graph_live";
      mailboxUserId: string;
      fetchedAt: string;
      messages: OutlookLiveMessage[];
      truncated: boolean;
    }
  | {
      ok: false;
      source: "microsoft_graph_live";
      mailboxUserId?: string;
      error: string;
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

type GraphTokenClaims = {
  roles?: unknown;
  scp?: unknown;
};

type GraphMailPermissionStatus = {
  ok: boolean;
  roles: string[];
  scopes: string[];
};

type GraphMessageResponse = {
  id?: string;
  subject?: string | null;
  webLink?: string | null;
};

const GRAPH_MAIL_WRITE_PERMISSIONS = new Set([
  "Mail.ReadWrite",
  "Mail.ReadWrite.Shared",
]);

const GRAPH_MAIL_READ_PERMISSIONS = new Set([
  "Mail.Read",
  "Mail.Read.Shared",
  "Mail.ReadBasic",
  "Mail.ReadBasic.Shared",
  "Mail.ReadWrite",
  "Mail.ReadWrite.Shared",
]);

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

  if (!clientId || !clientSecret || !tenantId) return { ok: false, missing };
  return { ok: true, clientId, clientSecret, tenantId };
}

function fallbackMailboxUserId(): string | null {
  const configured =
    process.env.MICROSOFT_MAIL_USER ??
    process.env.OUTLOOK_MAIL_USER ??
    process.env.MICROSOFT_CALENDAR_USER ??
    process.env.OUTLOOK_CALENDAR_USER ??
    process.env.MICROSOFT_SYNC_USERS?.split(",")[0];
  const normalized = configured?.trim().toLowerCase();
  return normalized || null;
}

export function resolveOutlookMailboxUserId(mailboxUserId?: string | null): string {
  const resolved = mailboxUserId?.trim().toLowerCase() || fallbackMailboxUserId();
  if (!resolved) {
    throw new Error(
      [
        "Outlook mailbox is not configured.",
        "Cause: draftOutlookEmail needs mailboxUserId or MICROSOFT_MAIL_USER / OUTLOOK_MAIL_USER / MICROSOFT_SYNC_USERS.",
        "Detection gap: the assistant could previously talk about email drafts without a real Graph mailbox target.",
        "Prevention: require an explicit mailbox before creating Outlook mail drafts.",
      ].join(" "),
    );
  }
  return resolved;
}

async function getGraphToken(): Promise<string> {
  const env = graphEnv();
  if (env.ok === false) {
    throw new Error(
      [
        `Missing Microsoft Graph env vars: ${env.missing.join(", ")}.`,
        "Cause: Outlook mail drafting requires Microsoft Graph application credentials.",
        "Detection gap: email actions were not previously checked against Graph runtime configuration.",
        "Prevention: fail before attempting the write when Graph credentials are incomplete.",
      ].join(" "),
    );
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
    throw new Error(`Microsoft Graph token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Microsoft Graph token request returned no access_token.");
  }
  return data.access_token;
}

function decodeGraphTokenClaims(accessToken: string): GraphTokenClaims {
  const [, payload] = accessToken.split(".");
  if (!payload) return {};

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GraphTokenClaims;
  } catch {
    return {};
  }
}

export function getGraphMailPermissionStatus(accessToken: string): GraphMailPermissionStatus {
  const claims = decodeGraphTokenClaims(accessToken);
  const roles = Array.isArray(claims.roles)
    ? claims.roles.filter((role): role is string => typeof role === "string")
    : [];
  const scopes = typeof claims.scp === "string"
    ? claims.scp.split(/\s+/).filter(Boolean)
    : [];
  const granted = new Set([...roles, ...scopes]);

  return {
    ok: [...GRAPH_MAIL_WRITE_PERMISSIONS].some((permission) => granted.has(permission)),
    roles,
    scopes,
  };
}

export function assertGraphMailWritePermission(accessToken: string): void {
  const status = getGraphMailPermissionStatus(accessToken);
  if (status.ok) return;

  const granted = [...status.roles, ...status.scopes].sort();
  throw new Error(
    [
      "Microsoft Graph mail write permission is not configured.",
      "Cause: draftOutlookEmail needs application permission Mail.ReadWrite for the configured Microsoft app registration.",
      `Detected Graph permissions: ${granted.length ? granted.join(", ") : "none"}.`,
      "Detection gap: Graph token acquisition can succeed for calendar or Teams scopes while mail drafting still fails with 403 ErrorAccessDenied.",
      "Prevention: validate mail-write permission before attempting Outlook draft creation.",
    ].join(" "),
  );
}

function assertGraphMailReadPermission(accessToken: string): void {
  const status = getGraphMailPermissionStatus(accessToken);
  const hasRead =
    status.roles.some((role) => GRAPH_MAIL_READ_PERMISSIONS.has(role)) ||
    status.scopes.some((scope) => GRAPH_MAIL_READ_PERMISSIONS.has(scope));
  if (hasRead) return;

  const granted = [...status.roles, ...status.scopes].sort();
  throw new Error(
    [
      "Microsoft Graph mail read permission is not configured.",
      "Cause: live Outlook inbox reads require Mail.Read, Mail.ReadBasic, or Mail.ReadWrite for the configured Microsoft app registration.",
      `Detected Graph permissions: ${granted.length ? granted.join(", ") : "none"}.`,
      "Detection gap: synced database email reads can appear healthy while live Graph inbox reads are not authorized.",
      "Prevention: validate mail-read permission before attempting live Outlook retrieval.",
    ].join(" "),
  );
}

type GraphMailRecipient = {
  emailAddress?: {
    address?: string | null;
    name?: string | null;
  } | null;
};

type GraphMailMessage = {
  id?: string;
  conversationId?: string | null;
  subject?: string | null;
  from?: GraphMailRecipient | null;
  toRecipients?: GraphMailRecipient[] | null;
  ccRecipients?: GraphMailRecipient[] | null;
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  hasAttachments?: boolean | null;
  webLink?: string | null;
  importance?: string | null;
  isRead?: boolean | null;
};

function recipientEmails(recipients: GraphMailRecipient[] | null | undefined) {
  return (recipients ?? [])
    .map((recipient) => recipient.emailAddress?.address?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
}

function normalizeLiveMessage(
  message: GraphMailMessage,
  mailboxUserId: string,
): OutlookLiveMessage | null {
  if (!message.id || !message.receivedDateTime) return null;
  return {
    id: message.id,
    conversationId: message.conversationId ?? null,
    subject: message.subject?.trim() || "(no subject)",
    fromName: message.from?.emailAddress?.name ?? null,
    fromEmail: message.from?.emailAddress?.address?.trim().toLowerCase() ?? null,
    toList: recipientEmails(message.toRecipients),
    ccList: recipientEmails(message.ccRecipients),
    receivedAt: message.receivedDateTime,
    bodyPreview: message.bodyPreview?.trim() || null,
    hasAttachments: message.hasAttachments === true,
    webLink: message.webLink ?? null,
    importance: message.importance ?? null,
    isRead: typeof message.isRead === "boolean" ? message.isRead : null,
    mailbox: mailboxUserId,
  };
}

function normalizeRecipients(recipients: OutlookMailRecipient[]) {
  return recipients.map((recipient) => {
    const address = recipient.email.trim().toLowerCase();
    if (!address) throw new Error("Every Outlook mail recipient needs an email address.");
    return {
      emailAddress: {
        address,
        name: recipient.name?.trim() || address,
      },
    };
  });
}

export function buildOutlookMailMessagePayload(input: OutlookMailDraftInput) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error("Outlook draft subject is required.");
  if (!body) throw new Error("Outlook draft body is required.");
  if (!input.toRecipients.length && !input.replyToGraphMessageId) {
    throw new Error("Outlook draft needs at least one recipient unless it is a reply draft.");
  }

  return {
    subject,
    importance: input.importance ?? "normal",
    body: {
      contentType: "HTML",
      content: body.replace(/\n/g, "<br />"),
    },
    toRecipients: normalizeRecipients(input.toRecipients),
    ccRecipients: normalizeRecipients(input.ccRecipients ?? []),
    bccRecipients: normalizeRecipients(input.bccRecipients ?? []),
  };
}

export async function listOutlookInboxMessages(
  input: ListOutlookMessagesInput,
): Promise<ListOutlookMessagesResult> {
  let mailboxUserId: string;
  try {
    mailboxUserId = resolveOutlookMailboxUserId(input.mailboxUserId);
  } catch (error) {
    return {
      ok: false,
      source: "microsoft_graph_live",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let token: string;
  try {
    token = await getGraphToken();
    assertGraphMailReadPermission(token);
  } catch (error) {
    return {
      ok: false,
      source: "microsoft_graph_live",
      mailboxUserId,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const params = new URLSearchParams({
    $select:
      "id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,webLink,importance,isRead",
    $orderby: "receivedDateTime desc",
    $top: String(limit),
  });
  if (input.sinceIso) {
    params.set("$filter", `receivedDateTime ge ${input.sinceIso}`);
  }

  const response = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailboxUserId)}/mailFolders/inbox/messages?${params.toString()}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        Prefer: 'outlook.body-content-type="text", outlook.timezone="America/New_York"',
      },
    },
  );

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    return {
      ok: false,
      source: "microsoft_graph_live",
      mailboxUserId,
      error: `Microsoft Graph Outlook inbox read failed: ${response.status} ${response.statusText}${responseBody ? `: ${responseBody.slice(0, 500)}` : ""}`,
    };
  }

  const data = (await response.json()) as {
    value?: GraphMailMessage[];
    "@odata.nextLink"?: string;
  };
  return {
    ok: true,
    source: "microsoft_graph_live",
    mailboxUserId,
    fetchedAt: new Date().toISOString(),
    messages: (data.value ?? [])
      .map((message) => normalizeLiveMessage(message, mailboxUserId))
      .filter((message): message is OutlookLiveMessage => Boolean(message)),
    truncated: Boolean(data["@odata.nextLink"]),
  };
}

export type OutlookReplyMessage = {
  id: string;
  internetMessageId: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toList: string[];
  ccList: string[];
  subject: string;
  bodyText: string;
  receivedAt: string;
};

export type ListOutlookReplyMessagesResult =
  | { ok: true; mailboxUserId: string; messages: OutlookReplyMessage[]; truncated: boolean }
  | { ok: false; mailboxUserId?: string; error: string };

type GraphRecipient = { emailAddress?: { name?: string | null; address?: string | null } };

function recipientAddresses(recipients: GraphRecipient[] | undefined): string[] {
  return (recipients ?? [])
    .map((r) => r.emailAddress?.address?.trim())
    .filter((a): a is string => Boolean(a));
}

/**
 * Read inbox messages from the RFI reply mailbox with the FULL body and
 * recipient lists — needed to extract the tokenized reply address and the
 * subcontractor's typed answer. Distinct from `listOutlookInboxMessages`, which
 * only returns `bodyPreview`.
 */
export async function listOutlookReplyMessages(
  input: ListOutlookMessagesInput,
): Promise<ListOutlookReplyMessagesResult> {
  let mailboxUserId: string;
  try {
    mailboxUserId = resolveOutlookMailboxUserId(input.mailboxUserId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  let token: string;
  try {
    token = await getGraphToken();
    assertGraphMailReadPermission(token);
  } catch (error) {
    return {
      ok: false,
      mailboxUserId,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const params = new URLSearchParams({
    $select:
      "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,body",
    $orderby: "receivedDateTime desc",
    $top: String(limit),
  });
  if (input.sinceIso) {
    params.set("$filter", `receivedDateTime ge ${input.sinceIso}`);
  }

  const response = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailboxUserId)}/mailFolders/inbox/messages?${params.toString()}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    },
  );

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    return {
      ok: false,
      mailboxUserId,
      error: `Microsoft Graph reply-mailbox read failed: ${response.status} ${response.statusText}${responseBody ? `: ${responseBody.slice(0, 500)}` : ""}`,
    };
  }

  const data = (await response.json()) as {
    value?: Array<{
      id?: string;
      internetMessageId?: string | null;
      subject?: string | null;
      from?: GraphRecipient;
      toRecipients?: GraphRecipient[];
      ccRecipients?: GraphRecipient[];
      receivedDateTime?: string | null;
      body?: { content?: string | null } | null;
    }>;
    "@odata.nextLink"?: string;
  };

  const messages: OutlookReplyMessage[] = (data.value ?? [])
    .filter((m): m is { id: string } & typeof m => Boolean(m.id))
    .map((m) => ({
      id: m.id as string,
      internetMessageId: m.internetMessageId ?? null,
      fromEmail: m.from?.emailAddress?.address ?? null,
      fromName: m.from?.emailAddress?.name ?? null,
      toList: recipientAddresses(m.toRecipients),
      ccList: recipientAddresses(m.ccRecipients),
      subject: m.subject ?? "",
      bodyText: m.body?.content ?? "",
      receivedAt: m.receivedDateTime ?? "",
    }));

  return {
    ok: true,
    mailboxUserId,
    messages,
    truncated: Boolean(data["@odata.nextLink"]),
  };
}

export function buildOutlookMailDraftAdaptiveCard(params: {
  title: string;
  mailboxUserId: string;
  recipientLabel: string;
  status: "draft" | "created" | "blocked";
  mode: "new_message" | "reply";
  openUrl?: string | null;
}) {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: params.title,
        weight: "Bolder",
        size: "Medium",
        wrap: true,
      },
      {
        type: "FactSet",
        facts: [
          { title: "Mailbox", value: params.mailboxUserId },
          { title: "Recipients", value: params.recipientLabel },
          { title: "Mode", value: params.mode === "reply" ? "Reply draft" : "New message draft" },
          { title: "Status", value: params.status },
        ],
      },
    ],
    actions: params.openUrl
      ? [
          {
            type: "Action.OpenUrl",
            title: "Open in Outlook",
            url: params.openUrl,
          },
        ]
      : [],
  };
}

export async function createOutlookMailDraft(
  input: OutlookMailDraftInput,
): Promise<OutlookMailDraftResult> {
  const mailboxUserId = resolveOutlookMailboxUserId(input.mailboxUserId);
  const token = await getGraphToken();
  assertGraphMailWritePermission(token);

  const mode = input.replyToGraphMessageId ? "reply" : "new_message";
  const payload = buildOutlookMailMessagePayload(input);
  const endpoint = input.replyToGraphMessageId
    ? `${GRAPH_BASE}/users/${encodeURIComponent(mailboxUserId)}/messages/${encodeURIComponent(input.replyToGraphMessageId)}/createReply`
    : `${GRAPH_BASE}/users/${encodeURIComponent(mailboxUserId)}/mailFolders/drafts/messages`;
  const body = input.replyToGraphMessageId
    ? undefined
    : JSON.stringify(payload);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    const detail = responseBody ? `: ${responseBody.slice(0, 500)}` : "";
    throw new Error(`Microsoft Graph Outlook draft create failed: ${response.status} ${response.statusText}${detail}`);
  }

  const draft = (await response.json()) as GraphMessageResponse;
  if (!draft.id) {
    throw new Error("Microsoft Graph Outlook draft create returned no message id.");
  }

  if (input.replyToGraphMessageId) {
    const patchResponse = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(mailboxUserId)}/messages/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        importance: input.importance ?? "normal",
        body: payload.body,
      }),
    });

    if (!patchResponse.ok) {
      const responseBody = await patchResponse.text().catch(() => "");
      const detail = responseBody ? `: ${responseBody.slice(0, 500)}` : "";
      throw new Error(`Microsoft Graph Outlook reply draft update failed: ${patchResponse.status} ${patchResponse.statusText}${detail}`);
    }
  }

  return {
    id: draft.id,
    subject: draft.subject ?? input.subject,
    webLink: draft.webLink ?? null,
    mailboxUserId,
    recipientCount: input.toRecipients.length + (input.ccRecipients?.length ?? 0) + (input.bccRecipients?.length ?? 0),
    mode,
  };
}
