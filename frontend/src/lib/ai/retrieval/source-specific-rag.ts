/**
 * Source-specific RAG retrieval — extracted from api/ai-assistant/chat/route.ts
 * so it can be imported by the retrieval executor without pulling in the full route.
 *
 * Extracted verbatim. The original inline copy in chat/route.ts re-exports from here
 * for backward compatibility.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  SourceSpecificRagRequest,
} from "@/lib/ai/detect-rag-request";
import {
  isCommunicationSourceAllowed,
  isDocumentScopeAllowed,
  readDocumentBusinessAreaScope,
  resolveCommunicationSourceType,
  type ToolScope,
} from "@/lib/ai/tools/guardrails";
import {
  fetchRecentTeamsMessagesFromGraph,
  type RecentTeamsMessagesResult,
} from "@/lib/microsoft-graph/recent-teams-messages";
import {
  listOutlookInboxMessages,
  type ListOutlookMessagesResult,
} from "@/lib/microsoft-graph/mail";
import { buildMeetingSignalBuckets } from "@/lib/ai/meeting-insight-signals";
import { createRagServiceClient } from "@/lib/supabase/service";

export type SourceSpecificRagRow = {
  id: string;
  title: string | null;
  source: string | null;
  category: string | null;
  type: string | null;
  date: string | null;
  created_at: string | null;
  action_items?: unknown;
  content: string | null;
  decisions?: unknown;
  key_topics?: unknown;
  raw_text?: string | null;
  summary?: string | null;
  summary_bullets?: unknown;
  topics_discussed?: unknown;
  overview?: string | null;
  project_id: number | null;
  business_area_id: number | null;
};

const MEETING_SELECT =
  "id,title,source,category,type,date,created_at,content,raw_text,summary,overview,summary_bullets,decisions,action_items,key_topics,topics_discussed,project_id,business_area_id";
const SOURCE_SELECT =
  "id,title,source,category,type,date,created_at,content,summary,overview,project_id,business_area_id";

export type SourceSpecificRagAnswer = {
  content: string;
  trace: Record<string, unknown>;
  rows: SourceSpecificRagRow[];
};

type SourceSpecificRagFormatOptions = {
  liveTeams?: RecentTeamsMessagesResult | null;
  liveEmails?: ListOutlookMessagesResult | null;
  liveCommunicationsAllowed?: boolean;
};

type RagMetadataClient = Pick<SupabaseClient, "from">;

function formatSourceSpecificDate(row: SourceSpecificRagRow): string {
  const value = row.date ?? row.created_at;
  if (!value) return "unknown date";
  return value.slice(0, 10);
}

function sourceSpecificSnippet(
  row: SourceSpecificRagRow,
  maxLength = 260,
): string {
  const content = sanitizeSourceSpecificSnippetText(
    row,
    preferredSourceSpecificContent(row),
  );
  if (!content) return "No text excerpt stored.";
  return content.length > maxLength
    ? `${content.slice(0, maxLength).trim()}...`
    : content;
}

function needsSourceSpecificContentHydration(
  row: SourceSpecificRagRow,
): boolean {
  return preferredSourceSpecificContent(row).trim().length === 0;
}

function sourceSpecificTitle(row: SourceSpecificRagRow): string {
  return row.title?.trim() || row.id;
}

function teamsEvidenceTitle(title: string): string {
  const normalized = title.trim();
  if (/^Live Teams:\s*19:/i.test(normalized)) {
    return "Teams conversation";
  }
  if (/^Teams DM Conversation:\s*19:/i.test(normalized)) {
    return "Teams conversation";
  }
  return normalized
    .replace(/^Live Teams:\s*/i, "Teams conversation: ")
    .replace(/^Teams DM Conversation:\s*/i, "Teams DM conversation: ");
}

function teamsEvidenceSourceLabel(row: SourceSpecificRagRow): string {
  const date = formatSourceSpecificDate(row);
  if (isLiveTeamsMessage(row)) {
    return `Live Microsoft Graph Teams message, ${date}`;
  }
  if (isCanonicalTeamsConversation(row)) {
    return `Synced Teams conversation, ${date}`;
  }
  return `Teams source row, ${date}`;
}

function isCanonicalTeamsConversation(row: SourceSpecificRagRow): boolean {
  return (
    row.category === "teams_message" && row.type === "teams_dm_conversation"
  );
}

function isLiveTeamsMessage(row: SourceSpecificRagRow): boolean {
  return row.type === "teams_live_message";
}

function sanitizeSourceSpecificSnippetText(
  row: SourceSpecificRagRow,
  value: string,
): string {
  let text = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');

  if (isCanonicalTeamsConversation(row) || isLiveTeamsMessage(row)) {
    text = text
      .replace(/\[Teams Direct Message Conversation:[^\]]+\]\s*/gi, "")
      .replace(/\[message:[^\]]+\]\s*/gi, "")
      .replace(/\b19:[A-Za-z0-9._-]{6,}/g, "Teams conversation")
      .replace(/\bChat:\s*Teams conversation\b/gi, "")
      .replace(/\bMailbox:\s*\S+/gi, "")
      .replace(/\bParticipants:\s*/gi, "Participants: ");
  }

  return text.replace(/\s+/g, " ").trim();
}

function preferredSourceSpecificContent(row: SourceSpecificRagRow): string {
  if (isLiveTeamsMessage(row)) {
    const liveMessageLine = (row.content ?? "")
      .split("\n")
      .map((line) => line.trim())
      .findLast((line) => line.includes(": "));
    return liveMessageLine ?? row.content ?? "";
  }
  if (isCanonicalTeamsConversation(row)) {
    return row.overview ?? row.summary ?? row.content ?? row.raw_text ?? "";
  }
  return row.content ?? row.summary ?? row.overview ?? row.raw_text ?? "";
}

async function hydrateRowsFromRagMetadata(
  rows: SourceSpecificRagRow[],
  ragSupabase: RagMetadataClient,
): Promise<SourceSpecificRagRow[]> {
  const ids = rows
    .filter((row) => row.source !== "microsoft_graph_live")
    .filter(needsSourceSpecificContentHydration)
    .map((row) => row.id);

  if (ids.length === 0) return rows;

  const { data, error } = await ragSupabase
    .from("rag_document_metadata")
    .select("id, content, raw_text, summary, overview")
    .in("id", ids);

  if (error) {
    throw new Error(
      `Failed to hydrate Teams RAG metadata content: ${error.message}`,
    );
  }

  const byId = new Map(
    (
      (data ?? []) as Array<{
        id: string;
        content: string | null;
        raw_text: string | null;
        summary: string | null;
        overview: string | null;
      }>
    ).map((row) => [row.id, row]),
  );

  return rows.map((row) => {
    if (!needsSourceSpecificContentHydration(row)) return row;
    const ragRow = byId.get(row.id);
    if (!ragRow) return row;
    return {
      ...row,
      content: row.content ?? ragRow.content ?? ragRow.raw_text ?? null,
      summary: row.summary ?? ragRow.summary ?? null,
      overview: row.overview ?? ragRow.overview ?? null,
      raw_text: row.raw_text ?? ragRow.raw_text ?? null,
    };
  });
}

function compareTeamsRows(
  a: SourceSpecificRagRow,
  b: SourceSpecificRagRow,
): number {
  const rank = (row: SourceSpecificRagRow): number => {
    if (isLiveTeamsMessage(row)) return 0;
    if (isCanonicalTeamsConversation(row)) return 1;
    return 2;
  };

  const rankDiff = rank(a) - rank(b);
  if (rankDiff !== 0) return rankDiff;

  const dateA = a.date ?? a.created_at ?? "";
  const dateB = b.date ?? b.created_at ?? "";
  return dateB.localeCompare(dateA);
}

function groupTeamsRows(rows: SourceSpecificRagRow[]): Array<{
  key: string;
  title: string;
  date: string;
  rows: SourceSpecificRagRow[];
}> {
  const groups = new Map<
    string,
    { key: string; title: string; date: string; rows: SourceSpecificRagRow[] }
  >();

  for (const row of rows) {
    const title = sourceSpecificTitle(row);
    const date = formatSourceSpecificDate(row);
    const key = `${title}::${date}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, { key, title, date, rows: [row] });
    }
  }

  return [...groups.values()].sort((a, b) => {
    const liveA = a.rows.some(isLiveTeamsMessage);
    const liveB = b.rows.some(isLiveTeamsMessage);
    if (liveA !== liveB) return liveA ? -1 : 1;

    const canonicalA = a.rows.some(isCanonicalTeamsConversation);
    const canonicalB = b.rows.some(isCanonicalTeamsConversation);
    if (canonicalA !== canonicalB) return canonicalA ? -1 : 1;

    return b.date.localeCompare(a.date);
  });
}

function formatSourceSpecificRagContent(
  request: SourceSpecificRagRequest,
  rows: SourceSpecificRagRow[],
  options: SourceSpecificRagFormatOptions = {},
): string {
  const liveTeams = options.liveTeams ?? null;
  const liveEmails = options.liveEmails ?? null;
  const liveCommunicationsAllowed =
    options.liveCommunicationsAllowed !== false;
  const sourceLine =
    request.kind === "recent_emails"
      ? liveCommunicationsAllowed
        ? `Source checked: live Microsoft Graph Outlook inbox first, then Supabase document_metadata/document_chunks-backed email index.`
        : `Source checked: authorized Supabase document_metadata/document_chunks-backed email index; live Microsoft Graph Outlook was skipped by permissions.`
      : request.kind === "recent_teams_discussions"
        ? liveCommunicationsAllowed
          ? `Source checked: live Microsoft Graph Teams messages first, then Supabase document_metadata/document_chunks-backed Teams index.`
          : `Source checked: authorized Supabase document_metadata/document_chunks-backed Teams index; live Microsoft Graph Teams was skipped by permissions.`
        : `Source checked: ${request.label} in Supabase document_metadata/document_chunks-backed source index.`;
  const liveLine =
    request.kind === "recent_emails" && liveEmails
      ? liveEmails.ok
        ? `- Live Microsoft Graph Outlook retrieval checked ${liveEmails.mailboxUserId} and returned ${liveEmails.messages.length} live row(s).`
        : `- Live Microsoft Graph Outlook retrieval failed: ${liveEmails.error}.`
      : request.kind === "recent_teams_discussions" && liveTeams
        ? liveTeams.status === "checked"
          ? `- Live Microsoft Graph Teams retrieval checked ${liveTeams.checkedMailboxes.length} mailbox(es) and returned ${liveTeams.rows.length} live row(s).`
          : `- Live Microsoft Graph Teams retrieval ${liveTeams.status}: ${liveTeams.warning ?? "no detail returned"}.`
        : null;
  if (rows.length === 0) {
    const windowLabel = request.date
      ? ` for ${request.date}`
      : request.startDate && request.endDate
        ? ` from ${request.startDate} through ${request.endDate}`
        : "";
    return [
      `**${request.label}**`,
      "",
      `I did not find matching ${request.label.toLowerCase()}${windowLabel}.`,
      "",
      `**Observability**`,
      `- ${sourceLine}`,
      ...(liveLine ? [liveLine] : []),
      "- Retrieval returned 0 rows, so I am not inventing a list.",
      "",
      "**Next Step**",
      "- Check the sync/vectorization health for this source before using it for an owner-ready update.",
    ].join("\n");
  }

  if (request.kind === "recent_teams_discussions") {
    const conversationGroups = groupTeamsRows(rows);
    return [
      `## Teams Message Evidence For Synthesis (${request.startDate} to ${request.endDate})`,
      "",
      "Use these Teams snippets as evidence. Do not copy this section verbatim; synthesize the main operational themes, risks, decisions, and follow-ups for the user.",
      `Freshness: ${sourceLine}`,
      ...(liveLine ? [liveLine.replace(/^- /, "Freshness detail: ")] : []),
      `Retrieval coverage: Retrieved ${rows.length} Teams row(s) from live Microsoft Graph and the document_metadata/document_chunks-backed Teams index.`,
      "",
      ...conversationGroups.slice(0, request.limit).map((group, index) => {
        const examples = group.rows
          .slice(0, 3)
          .map((row) => sourceSpecificSnippet(row, 180))
          .join(" | ");
        const sourceLabels = group.rows
          .slice(0, 3)
          .map(teamsEvidenceSourceLabel)
          .join("; ");
        return `${index + 1}. **${teamsEvidenceTitle(group.title)}** - ${group.date}. Evidence: ${examples} Source context: ${sourceLabels}.`;
      }),
      "",
      `Coverage note: ${rows.length} Teams row(s) grouped into ${conversationGroups.length} conversation/day bucket(s). If the evidence is too thin for an owner-ready answer, say that directly.`,
    ].join("\n");
  }

  const heading =
    request.kind === "meetings_on_date"
      ? `Meetings Conducted on ${request.date}`
      : request.kind === "recent_meetings"
        ? "Recent Meetings"
        : request.kind === "recent_emails"
          ? "Recent Outlook Emails"
          : "Most Recent OneDrive Documents";

  // For recent_meetings, include a content snippet so the model can ground its answer
  const rowFormatter =
    request.kind === "recent_meetings"
      ? (row: SourceSpecificRagRow, index: number) =>
          `${index + 1}. **${sourceSpecificTitle(row)}** — ${formatSourceSpecificDate(row)}\n   ${sourceSpecificSnippet(row, 300)} [Source: ${row.id}]`
      : (row: SourceSpecificRagRow, index: number) =>
          `${index + 1}. **${sourceSpecificTitle(row)}** — ${formatSourceSpecificDate(row)} [Source: ${row.id}]`;

  const meetingSignals =
    request.kind === "recent_meetings" || request.kind === "meetings_on_date"
      ? buildMeetingSignalBuckets(rows)
      : null;
  const meetingSignalLines = meetingSignals
    ? [
        "",
        "**Meeting Insights**",
        meetingSignals.decisions.length > 0
          ? `- Decisions: ${meetingSignals.decisions.slice(0, 3).join(" ")}`
          : "- Decisions: no explicit decision sentences found in the matched rows.",
        meetingSignals.promises.length > 0
          ? `- Follow-ups: ${meetingSignals.promises.slice(0, 3).join(" ")}`
          : "- Follow-ups: no explicit follow-up sentences found in the matched rows.",
        meetingSignals.risks.length > 0
          ? `- Risks: ${meetingSignals.risks.slice(0, 3).join(" ")}`
          : "- Risks: no explicit risk sentences found in the matched rows.",
      ]
    : [];

  return [
    `**${heading}**`,
    "",
    ...rows
      .slice(0, request.limit)
      .map((row, index) => rowFormatter(row, index)),
    ...meetingSignalLines,
    "",
    `**Observability**`,
    `- ${sourceLine}`,
    ...(liveLine ? [liveLine] : []),
    `- Retrieved ${rows.length} row(s) from ${request.label}; answer titles/dates are copied from Supabase rows.`,
    "",
    "**Next Step**",
    "- Use this same source-specific check as a regression gate so generic source questions cannot fall back to tool discovery only.",
  ].join("\n");
}

export async function buildSourceSpecificRagAnswer(params: {
  supabase: SupabaseClient<Database>;
  ragSupabase?: RagMetadataClient;
  request: SourceSpecificRagRequest;
  scope: ToolScope;
}): Promise<SourceSpecificRagAnswer> {
  const { supabase, request, scope } = params;
  let rows: SourceSpecificRagRow[] = [];
  let liveTeams: RecentTeamsMessagesResult | null = null;
  let liveEmails: ListOutlookMessagesResult | null = null;

  if (
    !scope.isAdmin &&
    scope.allowedProjectIds.length === 0 &&
    scope.allowedBusinessAreaIds.length === 0
  ) {
    const content = [
      `**${request.label}**`,
      "",
      "I cannot run this source-specific query because you do not have access to any projects or Alleato Brain branches in the current database scope.",
      "",
      `**Observability**`,
      `- Project and Business Area scope both resolved to 0 allowed targets for this user.`,
      "",
      "**Next Step**",
      "- Confirm the user has an active project directory membership before expecting project-scoped retrieval to work.",
    ].join("\n");

    return {
      content,
      rows: [],
      trace: {
        tool: "sourceSpecificRagRetrieval",
        input: request,
        output: { blocked: true, reason: "no_document_scope" },
        timestamp: new Date().toISOString(),
      },
    };
  }

  const applyDocumentScope = <
    T extends {
      in: (column: string, values: number[]) => T;
      or: (filters: string) => T;
    },
  >(query: T): T => {
    if (typeof scope.pinnedProjectId === "number") {
      return query.in("project_id", [scope.pinnedProjectId]);
    }
    if (scope.isAdmin) return query;

    const filters: string[] = [];
    if (scope.allowedProjectIds.length > 0) {
      filters.push(`project_id.in.(${scope.allowedProjectIds.join(",")})`);
    }
    if (scope.allowedBusinessAreaIds.length > 0) {
      filters.push(
        `business_area_id.in.(${scope.allowedBusinessAreaIds.join(",")})`,
      );
    }
    return query.or(filters.join(","));
  };

  const applyProjectScope = applyDocumentScope;
  const applyMeetingProjectScope = applyDocumentScope;

  if (request.kind === "meetings_on_date") {
    const { data, error } = await applyProjectScope(
      supabase
        .from("document_metadata")
        .select(MEETING_SELECT)
        .or(
          "source.eq.fireflies,source.eq.Zapier,type.eq.meeting,type.eq.meeting_transcript,category.eq.meeting",
        )
        .gte("date", `${request.date}T00:00:00.000Z`)
        .lte("date", `${request.date}T23:59:59.999Z`)
        .order("date", { ascending: false })
        .limit(request.limit),
    );
    if (error) throw new Error(error.message);
    rows = (data ?? []) as SourceSpecificRagRow[];

    if (rows.length === 0) {
      const { data: createdRows, error: createdError } =
        await applyMeetingProjectScope(
          supabase
            .from("document_metadata")
            .select(MEETING_SELECT)
            .or(
              "source.eq.fireflies,source.eq.Zapier,type.eq.meeting,type.eq.meeting_transcript,category.eq.meeting",
            )
            .gte("created_at", `${request.date}T00:00:00.000Z`)
            .lte("created_at", `${request.date}T23:59:59.999Z`)
            .order("created_at", { ascending: false })
            .limit(request.limit),
        );
      if (createdError) throw new Error(createdError.message);
      rows = (createdRows ?? []) as SourceSpecificRagRow[];
    }
  }

  if (request.kind === "recent_meetings") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const startIso = request.startDate
      ? `${request.startDate}T00:00:00.000Z`
      : cutoff.toISOString();
    const endIso = request.endDate ? `${request.endDate}T23:59:59.999Z` : null;
    let query = applyMeetingProjectScope(
      supabase
        .from("document_metadata")
        .select(MEETING_SELECT)
        .or(
          "source.eq.fireflies,source.eq.Zapier,type.eq.meeting,type.eq.meeting_transcript,category.eq.meeting",
        )
        .gte("date", startIso)
        .order("date", { ascending: false })
        .limit(request.limit),
    );
    if (endIso) query = query.lte("date", endIso);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows = (data ?? []) as SourceSpecificRagRow[];

    if (rows.length === 0) {
      let createdQuery = applyMeetingProjectScope(
        supabase
          .from("document_metadata")
          .select(MEETING_SELECT)
          .or(
            "source.eq.fireflies,source.eq.Zapier,type.eq.meeting,type.eq.meeting_transcript,category.eq.meeting",
          )
          .gte("created_at", startIso)
          .order("created_at", { ascending: false })
          .limit(request.limit),
      );
      if (endIso) createdQuery = createdQuery.lte("created_at", endIso);
      const { data: createdRows, error: createdError } = await createdQuery;
      if (createdError) throw new Error(createdError.message);
      rows = (createdRows ?? []) as SourceSpecificRagRow[];
    }
  }

  if (request.kind === "recent_emails") {
    const fallbackStart = new Date();
    fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 7);
    const sinceIso = request.startDate
      ? `${request.startDate}T00:00:00.000Z`
      : request.date
        ? `${request.date}T00:00:00.000Z`
        : fallbackStart.toISOString();
    if (scope.isAdmin) {
      liveEmails = await listOutlookInboxMessages({
        sinceIso,
        limit: request.limit,
      });
    }

    const { data, error } = await applyProjectScope(
      supabase
        .from("document_metadata")
        .select(SOURCE_SELECT)
        .eq("source", "microsoft_graph")
        .eq("category", "email")
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(request.limit),
    );
    if (error) throw new Error(error.message);
    const storedRows = (data ?? []) as SourceSpecificRagRow[];
    const liveEmailResult = liveEmails?.ok ? liveEmails : null;
    const liveRows: SourceSpecificRagRow[] = liveEmailResult
      ? liveEmailResult.messages.map((message) => ({
          id: `live-outlook:${message.mailbox}:${message.id}`,
          title: message.subject || "(no subject)",
          source: "microsoft_graph_live",
          category: "email",
          type: "outlook_live_message",
          date: message.receivedAt,
          created_at: liveEmailResult.fetchedAt,
          content: [
            "[Live Microsoft Graph Outlook email]",
            `Mailbox: ${message.mailbox}`,
            `From: ${message.fromName ?? "Unknown"} <${message.fromEmail ?? "unknown"}>`,
            `To: ${message.toList.join(", ") || "unknown"}`,
            `Importance: ${message.importance ?? "unknown"}`,
            `Unread: ${message.isRead === false ? "yes" : "no"}`,
            message.bodyPreview ?? "No preview returned.",
          ].join("\n"),
          project_id: null,
          business_area_id: null,
        }))
      : [];
    const seen = new Set<string>();
    rows = [...liveRows, ...storedRows]
      .filter((row) => {
        const key = `${row.title ?? ""}:${row.date ?? ""}:${row.content?.slice(0, 180) ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, request.limit);
  }

  if (request.kind === "recent_onedrive_documents") {
    const { data, error } = await applyProjectScope(
      supabase
        .from("document_metadata")
        .select(SOURCE_SELECT)
        .eq("source", "microsoft_graph")
        .eq("category", "document")
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(request.limit),
    );
    if (error) throw new Error(error.message);
    rows = (data ?? []) as SourceSpecificRagRow[];
  }

  if (request.kind === "recent_teams_discussions") {
    if (scope.isAdmin) {
      liveTeams = await fetchRecentTeamsMessagesFromGraph({
        startDate: request.startDate,
        endDate: request.endDate,
        query: request.query,
        limit: request.limit,
      });
    }

    const { data, error } = await applyProjectScope(
      supabase
        .from("document_metadata")
        .select(SOURCE_SELECT)
        .eq("source", "microsoft_graph")
        .eq("category", "teams_message")
        .gte("date", `${request.startDate}T00:00:00.000Z`)
        .lte("date", `${request.endDate}T23:59:59.999Z`)
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(request.limit),
    );
    if (error) throw new Error(error.message);
    const storedRows = await hydrateRowsFromRagMetadata(
      ((data ?? []) as SourceSpecificRagRow[]).sort(compareTeamsRows),
      params.ragSupabase ?? createRagServiceClient(),
    );
    const liveRows: SourceSpecificRagRow[] = (liveTeams?.rows ?? []).map(
      (message) => ({
        id: `live-teams:${message.mailbox}:${message.id}`,
        title: `Live Teams: ${message.chatLabel}`,
        source: "microsoft_graph_live",
        category: "teams_message",
        type: "teams_live_message",
        date: message.createdDateTime,
        created_at: message.lastModifiedDateTime ?? message.createdDateTime,
        content: [
          `[Live Microsoft Graph Teams message]`,
          `Mailbox: ${message.mailbox}`,
          `Chat: ${message.chatLabel}`,
          `Participants: ${message.participants.join(", ") || "unknown"}`,
          `${message.senderName ?? "Unknown"}: ${message.content}`,
        ].join("\n"),
        project_id: null,
        business_area_id: null,
      }),
    );
    const seen = new Set<string>();
    rows = [...liveRows, ...storedRows]
      .sort(compareTeamsRows)
      .filter((row) => {
        const key = `${row.title ?? ""}:${row.date ?? ""}:${row.content?.slice(0, 180) ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, request.limit);
  }

  rows = rows.filter((row) => {
    const metadata = { business_area_id: row.business_area_id };
    const businessAreaScope = readDocumentBusinessAreaScope(metadata);
    if (businessAreaScope.kind === "invalid") {
      console.error(
        "[sourceSpecificRagRetrieval] rejected malformed Business Area scope",
        {
          documentId: row.id,
          rawBusinessAreaId: businessAreaScope.rawValue,
        },
      );
    }
    return (
      isDocumentScopeAllowed({
        scope,
        projectId: row.project_id,
        metadata,
        requestedProjectId: scope.pinnedProjectId,
      }) &&
      isCommunicationSourceAllowed({
        scope,
        sourceType: resolveCommunicationSourceType({
          category: row.category,
          sourceType: row.type,
        }),
        metadata,
      })
    );
  });

  const content = formatSourceSpecificRagContent(request, rows, {
    liveTeams,
    liveEmails,
    liveCommunicationsAllowed: scope.isAdmin,
  });
  return {
    content,
    rows,
    trace: {
      tool: "sourceSpecificRagRetrieval",
      input: request,
      output: {
        rowCount: rows.length,
        rows: rows.map((row) => ({
          id: row.id,
          title: row.title,
          date: row.date,
          source: row.source,
          category: row.category,
          type: row.type,
          projectId: row.project_id,
          businessAreaId: row.business_area_id,
        })),
        liveTeams: liveTeams
          ? {
              status: liveTeams.status,
              rowCount: liveTeams.rows.length,
              checkedMailboxes: liveTeams.checkedMailboxes,
              warning: liveTeams.warning ?? null,
            }
          : null,
        liveEmails: liveEmails
          ? liveEmails.ok
            ? {
                status: "checked",
                source: liveEmails.source,
                mailboxUserId: liveEmails.mailboxUserId,
                rowCount: liveEmails.messages.length,
                fetchedAt: liveEmails.fetchedAt,
                truncated: liveEmails.truncated,
              }
            : {
                status: "failed",
                source: liveEmails.source,
                mailboxUserId: liveEmails.mailboxUserId ?? null,
                rowCount: 0,
                error: liveEmails.error,
              }
          : null,
      },
      timestamp: new Date().toISOString(),
    },
  };
}
