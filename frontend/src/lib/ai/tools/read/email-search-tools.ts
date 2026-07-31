import { tool } from "ai";
import {
  withTrace as _withTrace,
} from "../tool-utils";
import {
  getRecentEmailsDescription,
  getRecentEmailsInputSchema,
  searchEmailsDescription,
  searchEmailsInputSchema,
} from "@/lib/ai/tool-descriptors";
import { fetchWithPolicy } from "@/lib/guardrails/dependency";
import { GuardrailError } from "@/lib/guardrails/errors";
import { triageEmailForOperator } from "@/lib/ai/email-operator-policy";
import { searchDocumentChunksByCategory } from "./shared-search-helpers";
import type { OperationalToolInternals, CreateOperationalToolsOptions } from "./operational-internals";

// ---------------------------------------------------------------------------
// Email-specific types and helpers
// ---------------------------------------------------------------------------

type RecentEmailDirection = "mailbox" | "to" | "from" | "to_or_from";

type RecentEmailRow = {
  id: number | string;
  subject: string;
  from_name: string | null;
  from_email: string | null;
  to_list: string[] | null;
  cc_list: string[] | null;
  received_at: string | null;
  mailbox_user_id: string;
  body_text: string | null;
  has_attachments: boolean | null;
  project_id: number | null;
  web_link: string | null;
  graph_message_id: string;
  conversation_id: string | null;
  match_status: string | null;
  source_metadata: Record<string, unknown> | null;
};

type LiveOutlookInboxResult =
  | {
      ok: true;
      source: "microsoft_graph_live";
      mailbox_user_id: string;
      fetched_at: string;
      count: number;
      messages: RecentEmailRow[];
      truncated: boolean;
    }
  | {
      ok: false;
      source: "microsoft_graph_live";
      error: string;
    };

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateOperationalToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This operational knowledge source failed during retrieval. Explain the gap plainly and use other available sources before asking for more detail.",
  );
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  const match = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  return match?.[0] ?? null;
}

function getPrimarySyncedMailbox(): string | null {
  return (
    normalizeEmail(process.env.AI_ASSISTANT_DEFAULT_OUTLOOK_MAILBOX) ??
    normalizeEmail(process.env.OUTLOOK_OPERATOR_MAILBOX) ??
    normalizeEmail(process.env.MICROSOFT_SYNC_USERS?.split(",")[0])
  );
}

function backendUrl(): string {
  const value = (
    process.env.BACKEND_URL ||
    process.env.PYTHON_BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "")
  )
    .replace(/\/+$/, "")
    .trim();

  try {
    new URL(value);
  } catch {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "ai-assistant.getRecentEmails.live-inbox",
      message: "Missing or invalid backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL.",
      status: 503,
    });
  }

  return value;
}

function backendAdminApiKey(): string {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  if (!apiKey) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "ai-assistant.getRecentEmails.live-inbox",
      message: "ADMIN_API_KEY is required to read Outlook live inbox through the backend.",
      status: 503,
    });
  }
  return apiKey;
}

function isCompanyMailbox(email: string): boolean {
  const domains = (process.env.COMPANY_EMAIL_DOMAINS ?? "alleatogroup.com")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  return domains.some((domain) => email.endsWith(`@${domain}`));
}

function includesEmail(
  values: string[] | null | undefined,
  email: string,
): boolean {
  return (
    Array.isArray(values) &&
    values.some((value) => normalizeEmail(value) === email)
  );
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const hour = lookup.hour === "24" ? "00" : lookup.hour;
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(hour),
    Number(lookup.minute),
    Number(lookup.second),
  );
  return asUtc - date.getTime();
}

function startOfBusinessDay(daysBack: number, timeZone: string): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const localMidnightGuess = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day) - daysBack,
    0,
    0,
    0,
  );
  const guessDate = new Date(localMidnightGuess);
  return new Date(
    localMidnightGuess - getTimeZoneOffsetMs(guessDate, timeZone),
  );
}

function emailMatchesDirection(
  row: RecentEmailRow,
  participantEmail: string,
  direction: RecentEmailDirection,
): boolean {
  if (direction === "mailbox") {
    return normalizeEmail(row.mailbox_user_id) === participantEmail;
  }

  const sentByParticipant = normalizeEmail(row.from_email) === participantEmail;
  const sentToParticipant =
    includesEmail(row.to_list, participantEmail) ||
    includesEmail(row.cc_list, participantEmail);

  if (direction === "from") return sentByParticipant;
  if (direction === "to") return sentToParticipant;
  return (
    sentByParticipant ||
    sentToParticipant ||
    normalizeEmail(row.mailbox_user_id) === participantEmail
  );
}

function isDisplayableRecentEmail(row: RecentEmailRow): boolean {
  if (row.match_status === "ignored") {
    return false;
  }

  const classification = row.source_metadata?.intake_classification;
  if (!classification || typeof classification !== "object") {
    return true;
  }

  const action = (classification as { action?: unknown }).action;
  return action !== "skip" && action !== "quarantine";
}

function groupRecentEmailsByThread(rows: RecentEmailRow[], limit: number) {
  const groups = new Map<string, RecentEmailRow[]>();
  for (const row of rows) {
    const key = row.conversation_id ?? row.graph_message_id ?? String(row.id);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([threadKey, groupRows]) => {
      const sorted = groupRows.sort((a, b) => {
        const aTime = a.received_at ? Date.parse(a.received_at) : 0;
        const bTime = b.received_at ? Date.parse(b.received_at) : 0;
        return bTime - aTime;
      });
      const latest = sorted[0];
      const senders = Array.from(
        new Set(
          sorted
            .map((row) => normalizeEmail(row.from_email))
            .filter((email): email is string => Boolean(email)),
        ),
      );
      const recipients = Array.from(
        new Set(
          sorted
            .flatMap((row) => [...(row.to_list ?? []), ...(row.cc_list ?? [])])
            .map((email) => normalizeEmail(email))
            .filter((email): email is string => Boolean(email)),
        ),
      );

      return {
        threadKey,
        messageCount: sorted.length,
        latestId: latest.id,
        latestGraphMessageId: latest.graph_message_id,
        conversationId: latest.conversation_id,
        latestSubject: latest.subject,
        latestReceivedAt: latest.received_at,
        latestFromName: latest.from_name,
        latestFromEmail: latest.from_email,
        mailbox: latest.mailbox_user_id,
        senders,
        recipients,
        latestPreview: latest.body_text
          ? latest.body_text.slice(0, 280).replace(/\s+/g, " ").trim()
          : null,
        operatorTriage: triageEmailForOperator({
          subject: latest.subject,
          fromName: latest.from_name,
          fromEmail: latest.from_email,
          preview: latest.body_text,
          bodyText: latest.body_text,
          hasAttachments: sorted.some((row) => row.has_attachments === true),
        }),
        hasAttachments: sorted.some((row) => row.has_attachments === true),
        projectIds: Array.from(
          new Set(
            sorted
              .map((row) => row.project_id)
              .filter((id): id is number => typeof id === "number"),
          ),
        ),
        webLinks: sorted
          .map((row) => row.web_link)
          .filter((link): link is string => Boolean(link)),
        messageIds: sorted.map((row) => row.id),
        messages: sorted.slice(0, 4).map((row) => ({
          id: row.id,
          graphMessageId: row.graph_message_id,
          conversationId: row.conversation_id,
          subject: row.subject,
          fromName: row.from_name,
          fromEmail: row.from_email,
          toList: row.to_list,
          ccList: row.cc_list,
          receivedAt: row.received_at,
          bodyText: row.body_text,
          hasAttachments: row.has_attachments,
          projectId: row.project_id,
          webLink: row.web_link,
        })),
      };
    })
    .sort((a, b) => {
      const aTime = a.latestReceivedAt ? Date.parse(a.latestReceivedAt) : 0;
      const bTime = b.latestReceivedAt ? Date.parse(b.latestReceivedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

function formatRecentEmailRows(
  data: RecentEmailRow[],
  limit: number,
  groupByThread: boolean,
) {
  const emails = data.slice(0, limit).map((e) => ({
    id: e.id,
    graphMessageId: e.graph_message_id,
    conversationId: e.conversation_id,
    subject: e.subject,
    fromName: e.from_name,
    fromEmail: e.from_email,
    from: e.from_name
      ? `${e.from_name} <${e.from_email}>`
      : (e.from_email ?? "Unknown"),
    toList: e.to_list,
    ccList: e.cc_list,
    to: Array.isArray(e.to_list) ? e.to_list.join(", ") : e.to_list,
    receivedAt: e.received_at,
    mailbox: e.mailbox_user_id,
    bodyText: e.body_text,
    preview: e.body_text
      ? e.body_text.slice(0, 200).replace(/\s+/g, " ").trim()
      : null,
    hasAttachments: e.has_attachments,
    projectId: e.project_id,
    webLink: e.web_link,
    operatorTriage: triageEmailForOperator({
      subject: e.subject,
      fromName: e.from_name,
      fromEmail: e.from_email,
      preview: e.body_text,
      bodyText: e.body_text,
      hasAttachments: e.has_attachments,
    }),
  }));

  const threads = groupByThread ? groupRecentEmailsByThread(data, limit) : [];

  return { emails, threads };
}

async function readLiveOutlookInbox(input: {
  mailboxUserId: string;
  sinceIso: string;
  limit: number;
}): Promise<LiveOutlookInboxResult> {
  try {
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Admin-Api-Key": backendAdminApiKey(),
    });
    const response = await fetchWithPolicy(
      `ai-assistant-live-inbox-${Date.now()}`,
      "ai-assistant.getRecentEmails.live-inbox",
      "backend.graph.outlook.live-inbox",
      `${backendUrl()}/api/graph/outlook/live-inbox`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          mailbox_user_id: input.mailboxUserId,
          since_iso: input.sinceIso,
          limit: input.limit,
        }),
        cache: "no-store",
      },
      {
        timeoutMs: 15_000,
        maxRetries: 0,
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        source: "microsoft_graph_live",
        error: `Backend live Outlook inbox read failed: ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 400)}` : ""}`,
      };
    }

    const payload = (await response.json()) as {
      source?: string;
      mailbox_user_id?: string;
      fetched_at?: string;
      count?: number;
      messages?: RecentEmailRow[];
      truncated?: boolean;
    };
    return {
      ok: true,
      source: "microsoft_graph_live",
      mailbox_user_id: payload.mailbox_user_id ?? input.mailboxUserId,
      fetched_at: payload.fetched_at ?? new Date().toISOString(),
      count: payload.count ?? payload.messages?.length ?? 0,
      messages: payload.messages ?? [],
      truncated: Boolean(payload.truncated),
    };
  } catch (error) {
    return {
      ok: false,
      source: "microsoft_graph_live",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEmailSearchReadTools(internals: OperationalToolInternals) {
  const { userId, options, supabase, ragSupabase, guardrails, requireAdminForCommunications } = internals;

  return {
    // -----------------------------------------------------------------
    // 16. getRecentEmails — Date-based email retrieval from Outlook intake
    // -----------------------------------------------------------------

    getRecentEmails: tool({
      description: getRecentEmailsDescription,
      inputSchema: getRecentEmailsInputSchema,
      execute: withTrace(
        "getRecentEmails",
        options,
        async ({
          daysBack = 1,
          mailboxFilter,
          participantEmail,
          direction = "mailbox",
          timeZone = "America/New_York",
          groupByThread = true,
          limit = 50,
        }) => {
          const access = await requireAdminForCommunications("Email");
          if (!access.ok) return { error: access.error };

          const normalizedMailboxFilter = normalizeEmail(mailboxFilter);
          const normalizedParticipantEmail = normalizeEmail(participantEmail);
          let currentUserEmail: string | null = null;

          if (!normalizedMailboxFilter && !normalizedParticipantEmail) {
            const { data: userData, error: userError } =
              await supabase.auth.admin.getUserById(userId);
            if (userError) {
              return {
                error: `Could not resolve the signed-in user's email: ${userError.message}`,
              };
            }
            currentUserEmail = normalizeEmail(userData.user?.email);
          }

	        let mailboxResolutionNote: string | null = null;
	        let effectiveParticipantEmail =
	          normalizedParticipantEmail ??
	          normalizedMailboxFilter ??
	          currentUserEmail;
	        const effectiveDirection: RecentEmailDirection =
	          normalizedParticipantEmail ? direction : "mailbox";

	        const primarySyncedMailbox = getPrimarySyncedMailbox();
	        if (
	          !normalizedMailboxFilter &&
	          !normalizedParticipantEmail &&
	          currentUserEmail &&
	          primarySyncedMailbox &&
	          currentUserEmail !== primarySyncedMailbox &&
	          !isCompanyMailbox(currentUserEmail)
	        ) {
	          effectiveParticipantEmail = primarySyncedMailbox;
	          mailboxResolutionNote =
	            `The signed-in account ${currentUserEmail} is not a company-synced Outlook mailbox, so I used the primary synced operator mailbox ${primarySyncedMailbox}.`;
	        }

	        if (!effectiveParticipantEmail) {
	          return {
              error:
                "Could not resolve a mailbox or participant email for this email lookup. Ask for a specific mailbox or sign in with a synced mailbox account.",
            };
          }

          const safeDaysBack =
            Number.isFinite(daysBack) && daysBack >= 0
              ? Math.floor(daysBack)
              : 1;
          const safeLimit =
            Number.isFinite(limit) && limit > 0
              ? Math.min(Math.floor(limit), 100)
              : 50;
          const since = startOfBusinessDay(
            safeDaysBack,
            timeZone || "America/New_York",
          );
          const fetchLimit = Math.min(Math.max(safeLimit * 6, 100), 600);
          const liveGraphResult =
            effectiveDirection === "mailbox"
              ? await readLiveOutlookInbox({
                  mailboxUserId: effectiveParticipantEmail,
                  sinceIso: since.toISOString(),
                  limit: Math.min(fetchLimit, 100),
                })
              : null;

          if (liveGraphResult?.ok) {
            const liveData = liveGraphResult.messages;
            const { emails, threads } = formatRecentEmailRows(
              liveData,
              safeLimit,
              groupByThread,
            );
            const rangeLabel =
              safeDaysBack === 0
                ? "today"
                : `the last ${safeDaysBack} day${safeDaysBack === 1 ? "" : "s"}`;
            const dataCutoffNote = `Queried Microsoft Graph live at ${new Date(
              liveGraphResult.fetched_at,
            ).toLocaleString("en-US", {
              timeZone: "America/New_York",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })} ET.`;

            return {
              source: "microsoft_graph_live",
              emails,
              threads,
              count: liveData.length,
              threadCount: groupByThread ? threads.length : undefined,
              summary: groupByThread
                ? `Found ${liveData.length} live Outlook email${liveData.length === 1 ? "" : "s"} in ${threads.length} thread${threads.length === 1 ? "" : "s"} received ${rangeLabel} for ${effectiveParticipantEmail} (${effectiveDirection}).`
                : `Found ${liveData.length} live Outlook email${liveData.length === 1 ? "" : "s"} received ${rangeLabel} for ${effectiveParticipantEmail} (${effectiveDirection}).`,
              dataCutoffNote,
              mailboxResolutionNote,
              appliedFilter: {
                email: effectiveParticipantEmail,
                direction: effectiveDirection,
                since: since.toISOString(),
                timeZone,
              },
              graphLive: {
                fetchedAt: liveGraphResult.fetched_at,
                truncated: liveGraphResult.truncated,
              },
            };
          }

          const emailSelect =
            "id, subject, from_name, from_email, to_list, cc_list, received_at, mailbox_user_id, body_text, has_attachments, project_id, web_link, graph_message_id, conversation_id, match_status, source_metadata";

          const buildEmailQuery = (sinceIso?: string) => {
            let query = ragSupabase
              .from("outlook_email_intake")
              .select(emailSelect)
              .is("deleted_at", null)
              .neq("match_status", "ignored")
              .order("received_at", { ascending: false })
              .limit(fetchLimit);

            if (sinceIso) {
              query = query.gte("received_at", sinceIso);
            }

            if (effectiveDirection === "mailbox") {
              query = query.eq("mailbox_user_id", effectiveParticipantEmail);
            }

            return query;
          };

          const [emailResult, syncStateResult] = await Promise.all([
            buildEmailQuery(since.toISOString()),
            ragSupabase
              .from("graph_sync_state")
              .select("last_sync_at")
              .eq("source", "outlook_email")
              .eq("resource_id", effectiveParticipantEmail)
              .order("last_sync_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          if (emailResult.error) {
            return {
              error: `Failed to fetch emails: ${emailResult.error.message}`,
            };
          }

          const data = ((emailResult.data ?? []) as RecentEmailRow[]).filter(
            (row) =>
              isDisplayableRecentEmail(row) &&
              emailMatchesDirection(
                row,
                effectiveParticipantEmail,
                effectiveDirection,
              ),
          );
          const lastSyncedAt = syncStateResult.data?.last_sync_at ?? null;
          const graphLiveError =
            liveGraphResult && !liveGraphResult.ok
              ? liveGraphResult.error
              : "not available for this filter";
          const dataCutoffNote = lastSyncedAt
            ? `Microsoft Graph live inbox read failed (${graphLiveError}). Falling back to synced Outlook rows. Outlook email sync last completed ${new Date(lastSyncedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET. Syncs run hourly, so emails received after that sync may not appear yet.`
            : `Microsoft Graph live inbox read failed (${graphLiveError}). Outlook email sync time is unknown, so emails received since the last completed sync may not appear.`;

          if (data.length === 0) {
            if (!lastSyncedAt) {
              return {
                source: "outlook_email_intake_fallback",
                error:
                  `No Outlook sync state exists for ${effectiveParticipantEmail}. This mailbox is not configured or has not completed an Outlook sync; do not treat this as an empty inbox.`,
                emails: [],
                threads: [],
                dataCutoffNote,
                graphLiveError,
                mailboxResolutionNote,
                appliedFilter: {
                  email: effectiveParticipantEmail,
                  direction: effectiveDirection,
                  since: since.toISOString(),
                  timeZone,
                },
              };
            }
            const rangeLabel =
              safeDaysBack === 0
                ? "today"
                : `the last ${safeDaysBack} day${safeDaysBack === 1 ? "" : "s"}`;
            const syncCutoffBeforeRequestedWindow =
              Date.parse(lastSyncedAt) < since.getTime();
            if (syncCutoffBeforeRequestedWindow) {
              const latestResult = await buildEmailQuery();
              if (!latestResult.error) {
                const latestData = (
                  (latestResult.data ?? []) as RecentEmailRow[]
                ).filter(
                  (row) =>
                    isDisplayableRecentEmail(row) &&
                    emailMatchesDirection(
                      row,
                      effectiveParticipantEmail,
                      effectiveDirection,
                    ),
                );

                if (latestData.length > 0) {
                  const { emails, threads } = formatRecentEmailRows(
                    latestData,
                    safeLimit,
                    groupByThread,
                  );
                  const latestReceivedAt =
                    latestData[0]?.received_at ?? lastSyncedAt;
                  return {
                    source: "outlook_email_intake_fallback",
                    emails,
                    threads,
                    count: latestData.length,
                    threadCount: groupByThread ? threads.length : undefined,
                    summary:
                      `No emails are synced in the requested ${rangeLabel} window for ${effectiveParticipantEmail} (${effectiveDirection}). ` +
                      `Because the Outlook sync cutoff is before that window, I returned the latest available synced mailbox messages instead for triage.`,
                    latestAvailableFallback: true,
                    requestedWindowEmpty: true,
                    latestAvailableReceivedAt: latestReceivedAt,
                    dataCutoffNote,
                    graphLiveError,
                    mailboxResolutionNote,
                    appliedFilter: {
                      email: effectiveParticipantEmail,
                      direction: effectiveDirection,
                      since: since.toISOString(),
                      timeZone,
                    },
                  };
                }
              }
            }
            return {
              source: "outlook_email_intake_fallback",
              emails: [],
              threads: [],
              summary: `No emails received ${rangeLabel} for ${effectiveParticipantEmail} (${effectiveDirection}).`,
              dataCutoffNote,
              graphLiveError,
              mailboxResolutionNote,
              appliedFilter: {
                email: effectiveParticipantEmail,
                direction: effectiveDirection,
                since: since.toISOString(),
                timeZone,
              },
            };
          }

          const { emails, threads } = formatRecentEmailRows(
            data,
            safeLimit,
            groupByThread,
          );
          const rangeLabel =
            safeDaysBack === 0
              ? "today"
              : `the last ${safeDaysBack} day${safeDaysBack === 1 ? "" : "s"}`;
          return {
            source: "outlook_email_intake_fallback",
            emails,
            threads,
            count: data.length,
            threadCount: groupByThread ? threads.length : undefined,
            summary: groupByThread
              ? `Found ${data.length} email${data.length === 1 ? "" : "s"} in ${threads.length} thread${threads.length === 1 ? "" : "s"} received ${rangeLabel} for ${effectiveParticipantEmail} (${effectiveDirection}).`
              : `Found ${data.length} email${data.length === 1 ? "" : "s"} received ${rangeLabel} for ${effectiveParticipantEmail} (${effectiveDirection}).`,
            dataCutoffNote,
            graphLiveError,
            mailboxResolutionNote,
            appliedFilter: {
              email: effectiveParticipantEmail,
              direction: effectiveDirection,
              since: since.toISOString(),
              timeZone,
            },
          };
        },
      ),
    }),

    // -----------------------------------------------------------------
    // 17. searchEmails — Semantic topic search across Outlook email content
    // -----------------------------------------------------------------

    searchEmails: tool({
      description: searchEmailsDescription,
      inputSchema: searchEmailsInputSchema,
      execute: withTrace(
        "searchEmails",
        options,
        async ({ query, matchCount }) => {
          const scope = await guardrails.getScope();
          return searchDocumentChunksByCategory({
            supabase: ragSupabase,
            metadataSupabase: supabase,
            query,
            category: "email",
            matchCount: matchCount ?? 8,
            sourceLabel: "email",
            scope,
          });
        },
      ),
    }),
  };
}
