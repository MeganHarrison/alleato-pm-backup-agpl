import {
  createOutlookIntakeServiceClient,
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  buildRuleSuggestion,
  matchAttributionRule,
  type ActiveAttributionRule,
  type RuleMatch,
  type RankedProjectMatch,
  type RuleSuggestion,
} from "./attribution-rule-match";

export type InboxContentType = "meeting" | "email" | "teams" | "document" | "task";
export type InboxSourceTable = "document_metadata" | "outlook_email_intake" | "tasks";

export interface InboxItem {
  /** Stable unique key across both source tables (`table:id`). */
  rowKey: string;
  sourceTable: InboxSourceTable;
  itemId: string;
  contentType: InboxContentType;
  title: string;
  from: string | null;
  occurredAt: string | null;
  preview: string | null;
  suggestedProjectId: number | null;
  suggestedProjectName: string | null;
  suggestedConfidence: number | null;
  suggestionReason: string | null;
  reviewStatus: "suggested" | "manual_review" | "undefined";
  confidenceReasons: string[];
  evidence: string[];
  alternativeProjects: Array<{
    projectId: number;
    projectName: string | null;
    confidence: number;
  }>;
  chainMessageCount: number;
}

export interface InboxProject {
  id: number;
  name: string;
}

export interface LoadInboxResult {
  items: InboxItem[];
  projects: InboxProject[];
  /** True total of unassigned items across both sources (not just this page). */
  totalUnassigned: number;
  /** Whether more pages exist after this one. */
  hasMore: boolean;
  /** Offset to pass for the next page. */
  nextOffset: number;
  errorMessage: string | null;
}

export interface LoadInboxOptions {
  offset?: number;
  limit?: number;
}

/** Default page size for the date-ordered union worklist. */
export const INBOX_PAGE_SIZE = 200;
/**
 * Offset-based pagination over a two-table union over-fetches `offset + limit`
 * from each source. Cap the window so a pathological deep offset can't issue an
 * unbounded scan. In practice items get assigned (and disappear), so the live
 * unassigned offset stays small.
 */
const MAX_WINDOW = 5_000;
const CANDIDATE_CHUNK = 200;

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}

function deriveDocContentType(
  type: string | null,
  category: string | null,
): InboxContentType {
  const t = (type ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (t === "meeting" || t.includes("meeting")) return "meeting";
  if (t.startsWith("teams") || c === "teams_message" || c.includes("teams")) {
    return "teams";
  }
  return "document";
}

function truncate(value: string | null | undefined, max = 240): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

interface BestCandidate {
  projectId: number;
  projectName: string | null;
  confidence: number;
  reasoning: string | null;
}

type EnrichedSuggestion = BestCandidate & {
  reviewStatus: "suggested" | "manual_review" | "undefined";
  confidenceReasons: string[];
  evidence: string[];
  alternativeProjects: Array<{
    projectId: number;
    projectName: string | null;
    confidence: number;
  }>;
};

/**
 * Wrap a raw RAG attribution candidate in the enriched suggestion shape used by
 * the inbox. RAG candidates carry no review status, confidence reasons, evidence,
 * or ranked alternatives, so those fields default to the same empty values the
 * inbox previously applied at the callsite.
 */
function enrichBestCandidate(candidate: BestCandidate): EnrichedSuggestion {
  return {
    ...candidate,
    reviewStatus: "undefined",
    confidenceReasons: [],
    evidence: [],
    alternativeProjects: [],
  };
}

/** Convert a learned-rule match into the suggestion shape used by the inbox. */
function matchToSuggestion(
  match: RuleMatch | null,
  projectNameById: Map<number, string>,
): EnrichedSuggestion | null {
  if (!match) return null;
  return {
    projectId: match.projectId,
    projectName: projectNameById.get(match.projectId) ?? null,
    confidence: match.confidence,
    reasoning: `Matched ${match.ruleType.replace("_", " ")} rule “${match.pattern}”`,
    reviewStatus: "suggested",
    confidenceReasons: [],
    evidence: [`Matched ${match.ruleType.replace("_", " ")} rule ${match.pattern}`],
    alternativeProjects: [],
  };
}

function rankMatchesToAlternatives(
  topMatches: RankedProjectMatch[],
  projectNameById: Map<number, string>,
) {
  return topMatches.slice(0, 3).map((match) => ({
    projectId: match.projectId,
    projectName: projectNameById.get(match.projectId) ?? null,
    confidence: match.confidence,
  }));
}

function suggestionFromRuleSuggestion(
  suggestion: RuleSuggestion,
  projectNameById: Map<number, string>,
): EnrichedSuggestion | null {
  if (suggestion.suggestedProjectId == null && suggestion.topMatches.length === 0) {
    return {
      projectId: 0,
      projectName: null,
      confidence: suggestion.confidence ?? 0,
      reasoning: suggestion.summary,
      reviewStatus: suggestion.status,
      confidenceReasons: suggestion.confidenceReasons,
      evidence: suggestion.evidence,
      alternativeProjects: [],
    };
  }

  const primaryId = suggestion.suggestedProjectId ?? suggestion.topMatches[0]?.projectId ?? 0;
  return {
    projectId: primaryId,
    projectName: projectNameById.get(primaryId) ?? null,
    confidence: suggestion.confidence ?? 0,
    reasoning: suggestion.summary,
    reviewStatus: suggestion.status,
    confidenceReasons: suggestion.confidenceReasons,
    evidence: suggestion.evidence,
    alternativeProjects: rankMatchesToAlternatives(suggestion.topMatches, projectNameById),
  };
}

type DocRow = {
  id: string;
  title: string | null;
  file_name: string | null;
  type: string | null;
  category: string | null;
  host_email: string | null;
  organizer_email: string | null;
  participants: string | null;
  overview: string | null;
  summary: string | null;
  date: string | null;
  created_at: string | null;
};

type EmailRow = {
  id: number;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  body_text: string | null;
  to_list: string[] | null;
  cc_list: string[] | null;
  conversation_id: string | null;
  received_at: string | null;
  created_at: string | null;
};

type EmailThreadContext = {
  messageCount: number;
  participants: string[];
  relatedTitles: string[];
  content: string | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  description: string | null;
  source_system: string | null;
  created_at: string | null;
  project_id: number | null;
  project_ids: number[] | null;
  document_metadata: {
    title: string | null;
    project_id: number | null;
    date: string | null;
    created_at: string | null;
  } | null;
};

type WindowEntry =
  | { kind: "doc"; occurredAt: string | null; row: DocRow }
  | { kind: "email"; occurredAt: string | null; row: EmailRow }
  | { kind: "task"; occurredAt: string | null; row: TaskRow };

function timestamp(value: string | null): number {
  return value ? Date.parse(value) : 0;
}

function humanizeSourceLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .replace(/[_-]+/g, " ")
    .trim();
  if (!normalized) return null;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildEmailThreadContext(messages: EmailRow[]): EmailThreadContext {
  const sorted = [...messages].sort(
    (a, b) => timestamp(a.received_at ?? a.created_at) - timestamp(b.received_at ?? b.created_at),
  );
  const participants = [...new Set(
    sorted.flatMap((message) => [
      message.from_email,
      ...(message.to_list ?? []),
      ...(message.cc_list ?? []),
    ].filter((value): value is string => Boolean(value))),
  )];
  const relatedTitles = [...new Set(
    sorted
      .map((message) => message.subject?.trim())
      .filter((value): value is string => Boolean(value)),
  )];
  const content = sorted
    .map((message) => message.body_text?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 8)
    .join("\n");

  return {
    messageCount: sorted.length,
    participants,
    relatedTitles,
    content: content || null,
  };
}

export async function loadInboxItems(
  options: LoadInboxOptions = {},
): Promise<LoadInboxResult> {
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, Math.min(500, options.limit ?? INBOX_PAGE_SIZE));
  const windowLimit = Math.min(offset + limit, MAX_WINDOW);

  const supabase = createServiceClient();
  const intakeSupabase = createOutlookIntakeServiceClient();

  const [
    docCountResult,
    emailCountResult,
    taskCountResult,
    docsResult,
    emailsResult,
    tasksResult,
    projectsResult,
    rulesResult,
  ] = await Promise.all([
    serviceDb.from("document_metadata")
      .select("id", { count: "exact", head: true })
      .is("project_id", null)
      .is("deleted_at", null),
    intakeSupabase
      .from("outlook_email_intake")
      .select("id", { count: "exact", head: true })
      .is("project_id", null)
      .neq("match_status", "ignored")
      .is("deleted_at", null),
    serviceDb.from("tasks")
      .select("id", { count: "exact", head: true })
      .is("project_id", null)
      .or("project_ids.is.null,project_ids.eq.{}"),
    serviceDb.from("document_metadata")
      .select(
        "id, title, file_name, type, category, host_email, organizer_email, participants, overview, summary, date, created_at",
      )
      .is("project_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(windowLimit),
    intakeSupabase
      .from("outlook_email_intake")
      .select(
        "id, subject, from_email, from_name, body_text, to_list, cc_list, conversation_id, received_at, created_at",
      )
      .is("project_id", null)
      .neq("match_status", "ignored")
      .is("deleted_at", null)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(windowLimit),
    serviceDb.from("tasks")
      .select(`
        id,
        title,
        description,
        source_system,
        created_at,
        project_id,
        project_ids,
        document_metadata:tasks_metadata_id_fkey (
          title,
          project_id,
          date,
          created_at
        )
      `)
      .is("project_id", null)
      .or("project_ids.is.null,project_ids.eq.{}")
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(windowLimit),
    serviceDb.from("projects").select("id, name").eq("archived", false).order("name"),
    serviceDb.from("project_attribution_rules")
      .select("project_id, rule_type, pattern_normalized, confidence, priority")
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(5_000),
  ]);

  const errorMessage =
    docsResult.error?.message ??
    emailsResult.error?.message ??
    tasksResult.error?.message ??
    projectsResult.error?.message ??
    null;

  const totalUnassigned =
    (docCountResult.count ?? 0) + (emailCountResult.count ?? 0) + (taskCountResult.count ?? 0);

  const projects: InboxProject[] = (projectsResult.data ?? [])
    .filter((p): p is { id: number; name: string } => p.id != null && p.name != null)
    .map((p) => ({ id: p.id, name: p.name }));

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  // Learned attribution rules drive suggestions for items without a candidate
  // (notably emails). A rules-table failure must not break the inbox.
  const activeRules: ActiveAttributionRule[] = (rulesResult.data ?? [])
    .filter((rule) => rule.project_id != null && rule.pattern_normalized)
    .map((rule) => ({
      projectId: rule.project_id,
      ruleType: rule.rule_type,
      patternNormalized: rule.pattern_normalized,
      confidence: rule.confidence ?? 0.9,
      priority: rule.priority ?? 50,
    }));

  // Merge both sources into one date-ordered stream, then slice to the page.
  const windowEntries: WindowEntry[] = [
    ...((docsResult.data ?? []) as DocRow[]).map(
      (row): WindowEntry => ({
        kind: "doc",
        occurredAt: row.date ?? row.created_at ?? null,
        row,
      }),
    ),
    ...((emailsResult.data ?? []) as EmailRow[]).map(
      (row): WindowEntry => ({
        kind: "email",
        occurredAt: row.received_at ?? row.created_at ?? null,
        row,
      }),
    ),
    ...((tasksResult.data ?? []) as TaskRow[]).map(
      (row): WindowEntry => ({
        kind: "task",
        occurredAt: row.created_at ?? row.document_metadata?.date ?? row.document_metadata?.created_at ?? null,
        row,
      }),
    ),
  ].sort((a, b) => timestamp(b.occurredAt) - timestamp(a.occurredAt));

  const pageEntries = windowEntries.slice(offset, offset + limit);

  const pageEmailRows = pageEntries
    .filter((entry): entry is Extract<WindowEntry, { kind: "email" }> => entry.kind === "email")
    .map((entry) => entry.row);
  const pageConversationIds = [...new Set(
    pageEmailRows
      .map((row) => row.conversation_id)
      .filter((value): value is string => Boolean(value)),
  )];

  const emailThreadByConversationId = new Map<string, EmailThreadContext>();
  if (pageConversationIds.length > 0) {
    for (const ids of chunk(pageConversationIds, 100)) {
      const { data: threadRows } = await intakeSupabase
        .from("outlook_email_intake")
        .select(
          "id, subject, from_email, from_name, body_text, to_list, cc_list, conversation_id, received_at, created_at",
        )
        .in("conversation_id", ids)
        .is("deleted_at", null)
        .order("received_at", { ascending: true, nullsFirst: false })
        .limit(2_000);

      const rowsByConversation = new Map<string, EmailRow[]>();
      for (const row of (threadRows ?? []) as EmailRow[]) {
        if (!row.conversation_id) continue;
        const existing = rowsByConversation.get(row.conversation_id) ?? [];
        existing.push(row);
        rowsByConversation.set(row.conversation_id, existing);
      }

      for (const [conversationId, rows] of rowsByConversation) {
        emailThreadByConversationId.set(conversationId, buildEmailThreadContext(rows));
      }
    }
  }

  // Enrich only this page's documents with RAG attribution candidates.
  const pageDocIds = pageEntries
    .filter((entry): entry is Extract<WindowEntry, { kind: "doc" }> => entry.kind === "doc")
    .map((entry) => entry.row.id);

  const bestByDoc = new Map<string, BestCandidate>();
  if (pageDocIds.length > 0) {
    try {
      const rag = createRagServiceClient();
      for (const ids of chunk(pageDocIds, CANDIDATE_CHUNK)) {
        const { data: candidates } = await rag
          .from("document_attribution_candidates")
          .select(
            "source_document_id, candidate_project_id, candidate_project_name, confidence, reasoning, status",
          )
          .in("source_document_id", ids)
          .in("status", ["pending_review", "auto_assigned"]);

        for (const candidate of candidates ?? []) {
          if (!candidate.candidate_project_id) continue;
          const existing = bestByDoc.get(candidate.source_document_id);
          if (existing && existing.confidence >= candidate.confidence) continue;
          bestByDoc.set(candidate.source_document_id, {
            projectId: candidate.candidate_project_id,
            projectName: candidate.candidate_project_name,
            confidence: candidate.confidence,
            reasoning: candidate.reasoning,
          });
        }
      }
    } catch (ragError) {
      console.error("[assignment-inbox] RAG candidate lookup failed", ragError);
    }
  }

  const items: InboxItem[] = pageEntries.map((entry) => {
    if (entry.kind === "doc") {
      const doc = entry.row;
      const title = doc.title ?? doc.file_name ?? "Untitled";
      const fromEmail = doc.host_email ?? doc.organizer_email ?? null;
      const candidate = bestByDoc.get(doc.id) ?? null;
      const suggestion: EnrichedSuggestion | null =
        (candidate && enrichBestCandidate(candidate)) ??
        matchToSuggestion(
          matchAttributionRule({ fromEmail, title }, activeRules),
          projectNameById,
        );
      return {
        rowKey: `document_metadata:${doc.id}`,
        sourceTable: "document_metadata",
        itemId: doc.id,
        contentType: deriveDocContentType(doc.type, doc.category),
        title,
        from: fromEmail ?? doc.participants ?? null,
        occurredAt: entry.occurredAt,
        preview: truncate(doc.overview ?? doc.summary ?? doc.participants),
        suggestedProjectId: suggestion?.projectId ?? null,
        suggestedProjectName: suggestion?.projectName ?? null,
        suggestedConfidence: suggestion?.confidence ?? null,
        suggestionReason: suggestion?.reasoning ?? null,
        reviewStatus: suggestion?.reviewStatus ?? "undefined",
        confidenceReasons: suggestion?.confidenceReasons ?? [],
        evidence: suggestion?.evidence ?? [],
        alternativeProjects: suggestion?.alternativeProjects ?? [],
        chainMessageCount: 1,
      };
    }

    if (entry.kind === "task") {
      const task = entry.row;
      const suggestedProjectId = task.document_metadata?.project_id ?? null;
      const suggestedProjectName =
        suggestedProjectId != null ? projectNameById.get(suggestedProjectId) ?? null : null;
      const title = task.title ?? task.description ?? "Untitled task";
      const sourceLabel = humanizeSourceLabel(task.source_system);

      return {
        rowKey: `tasks:${task.id}`,
        sourceTable: "tasks",
        itemId: task.id,
        contentType: "task",
        title,
        from: sourceLabel ? `Task from ${sourceLabel}` : "Generated task",
        occurredAt: entry.occurredAt,
        preview: truncate(task.description),
        suggestedProjectId,
        suggestedProjectName,
        suggestedConfidence: suggestedProjectId != null ? 1 : null,
        suggestionReason:
          suggestedProjectId != null
            ? "Task source record is already linked to this project."
            : "This task is still missing a project assignment.",
        reviewStatus: suggestedProjectId != null ? "suggested" : "undefined",
        confidenceReasons: [],
        evidence:
          suggestedProjectId != null && task.document_metadata?.title
            ? [`Source record: ${task.document_metadata.title}`]
            : [],
        alternativeProjects: [],
        chainMessageCount: 1,
      };
    }

    const email = entry.row;
    const chainContext = email.conversation_id
      ? emailThreadByConversationId.get(email.conversation_id) ?? null
      : null;
    const ruleSuggestion = buildRuleSuggestion(
      {
        fromEmail: email.from_email,
        title: email.subject,
        bodyText: chainContext?.content ?? email.body_text,
        participants: chainContext?.participants ?? [
          email.from_email,
          ...(email.to_list ?? []),
          ...(email.cc_list ?? []),
        ].filter((value): value is string => Boolean(value)),
        relatedTitles: chainContext?.relatedTitles ?? [email.subject].filter(Boolean) as string[],
      },
      activeRules,
    );
    const suggestion =
      suggestionFromRuleSuggestion(ruleSuggestion, projectNameById) ??
      matchToSuggestion(
        matchAttributionRule(
          { fromEmail: email.from_email, title: email.subject },
          activeRules,
        ),
        projectNameById,
      );
    return {
      rowKey: `outlook_email_intake:${email.id}`,
      sourceTable: "outlook_email_intake",
      itemId: String(email.id),
      contentType: "email",
      title: email.subject ?? "(no subject)",
      from: email.from_name ?? email.from_email ?? null,
      occurredAt: entry.occurredAt,
      preview: truncate(email.body_text),
      suggestedProjectId:
        suggestion?.reviewStatus === "suggested" ? suggestion.projectId : null,
      suggestedProjectName:
        suggestion?.reviewStatus === "suggested" ? suggestion.projectName ?? null : null,
      suggestedConfidence: suggestion?.confidence ?? null,
      suggestionReason: suggestion?.reasoning ?? null,
      reviewStatus: suggestion?.reviewStatus ?? "undefined",
      confidenceReasons: suggestion?.confidenceReasons ?? [],
      evidence: suggestion?.evidence ?? [],
      alternativeProjects: suggestion?.alternativeProjects ?? [],
      chainMessageCount: chainContext?.messageCount ?? 1,
    };
  });

  const nextOffset = offset + limit;
  const hasMore = nextOffset < totalUnassigned && nextOffset < MAX_WINDOW;

  return {
    items,
    projects,
    totalUnassigned,
    hasMore,
    nextOffset,
    errorMessage,
  };
}
