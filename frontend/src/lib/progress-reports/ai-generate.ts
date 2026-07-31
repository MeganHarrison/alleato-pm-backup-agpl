import { generateText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  createRagServiceClient,
  createServiceClient,
  isRagDatabaseReadsEnabled,
} from "@/lib/supabase/service";
import { buildProgressReportDraft } from "@/lib/progress-reports/report-builder";
import {
  PROGRESS_REPORT_SYSTEM_PROMPT,
  buildProgressReportUserMessage,
} from "@/lib/ai/prompts/progress-report";
import {
  buildAgentLearningContextBlock,
  getSurfaceScopedLearnings,
} from "@/lib/ai/services/agent-learning-service";
import {
  mapDeepReadRecordToSignals,
  type IntelligenceSignal,
} from "@/lib/progress-reports/deep-read-signals";

/**
 * AI progress report enrichment.
 *
 * This file owns the optional narrative rewrite/enrichment pass for the three
 * editable report sections. It does not create report rows. Callers first create
 * or load a report through `server.ts`, then use this function to produce better
 * client-facing copy and persist those fields.
 *
 * Output is deliberately constrained to JSON with exactly:
 * - past_week_highlights
 * - upcoming_week_activities
 * - open_items
 */
const MODEL_ID = "openai/gpt-5.5";

export interface AiGeneratedSections {
  past_week_highlights: string;
  upcoming_week_activities: string;
  open_items: string;
}

type MeetingSourceRow = {
  id: string;
  title: string | null;
  date: string | null;
  summary: string | null;
  overview: string | null;
  action_items: string | null;
  summary_bullets: unknown;
  content: string | null;
  raw_text: string | null;
};

type ProjectReportSuggestionInput = NonNullable<
  Parameters<typeof buildProgressReportUserMessage>[0]["reportSuggestions"]
>[number];

type UntypedSupabaseRows = Record<string, unknown>[];

type UntypedSupabaseQuery = PromiseLike<{
  data: UntypedSupabaseRows | null;
  error: { message: string } | null;
}> & {
  select: (columns?: string) => UntypedSupabaseQuery;
  eq: (column: string, value: unknown) => UntypedSupabaseQuery;
  in: (column: string, values: unknown[]) => UntypedSupabaseQuery;
  or: (filters: string) => UntypedSupabaseQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedSupabaseQuery;
  limit: (count: number) => UntypedSupabaseQuery;
};

type UntypedSupabaseReader = {
  from: (table: string) => UntypedSupabaseQuery;
};

function compactWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function trimForPrompt(value: string | null | undefined, limit: number) {
  const text = compactWhitespace(value);
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanSuggestionText(value: unknown, limit = 260): string | null {
  const text = compactWhitespace(
    typeof value === "string" || typeof value === "number" ? String(value) : "",
  );
  if (!text) return null;
  return trimForPrompt(text, limit);
}

function suggestionItems(value: unknown): string[] {
  return asArray(value)
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        return cleanSuggestionText(item);
      }
      const record = asRecord(item);
      return (
        cleanSuggestionText(record.summary) ||
        cleanSuggestionText(record.title) ||
        cleanSuggestionText(record.description)
      );
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

async function loadProjectReportSuggestions(
  db: ReturnType<typeof createServiceClient>,
  projectId: number,
  weekStart: string,
  weekEnd: string,
): Promise<ProjectReportSuggestionInput[]> {
  const untyped = db as unknown as UntypedSupabaseReader;
  const { data, error } = await untyped
    .from("project_report_suggestions")
    .select("title, report_type, business_date, week_start_date, suggestion_payload, confidence")
    .eq("project_id", projectId)
    .in("status", ["suggested", "reviewing", "applied", "partially_applied"])
    .or(`business_date.gte.${weekStart},week_start_date.gte.${weekStart}`)
    .or(`business_date.lte.${weekEnd},week_start_date.lte.${weekEnd}`)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const payload = asRecord(row.suggestion_payload);
    return {
      title: cleanSuggestionText(row.title, 160) || "Operating-record report suggestion",
      reportType: compactWhitespace(String(row.report_type ?? "")) || "report_suggestion",
      period:
        cleanSuggestionText(row.business_date, 40) ||
        cleanSuggestionText(row.week_start_date, 40),
      summary: cleanSuggestionText(payload.summary, 420),
      updates: suggestionItems(payload.updates || payload.field_activity_signals),
      risks: suggestionItems(payload.risks || payload.open_items),
      financialChanges: suggestionItems(payload.financial_changes),
      scheduleChanges: suggestionItems(payload.schedule_changes),
    };
  });
}

async function loadFullDocumentText(documentIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(documentIds.filter(Boolean)));
  if (ids.length === 0 || !isRagDatabaseReadsEnabled()) return out;

  const rag = createRagServiceClient();
  const partsByDoc = new Map<string, Array<{ index: number; text: string }>>();

  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    const { data, error } = await rag
      .from("document_chunks")
      .select("document_id, chunk_index, text")
      .in("document_id", batch);
    if (error || !data) continue;

    for (const row of data) {
      const documentId = row.document_id;
      const text = row.text;
      if (!documentId || !text) continue;
      if (!partsByDoc.has(documentId)) partsByDoc.set(documentId, []);
      partsByDoc.get(documentId)!.push({ index: row.chunk_index ?? 0, text });
    }
  }

  for (const [documentId, parts] of partsByDoc.entries()) {
    parts.sort((a, b) => a.index - b.index);
    out.set(documentId, trimForPrompt(parts.map((part) => part.text).join("\n"), 12000));
  }

  return out;
}

/**
 * The daily deep read (`project-intelligence/core/compile-daily-executive-brief.mjs`) is the
 * freshest project synthesis in the system. It writes one `company_process`
 * intelligence target (`daily-executive-brief`) whose `current` packet carries a
 * per-project `projectRecords` array — regenerated every run with `whatChanged`,
 * field/schedule/financial reads, active risks, decisions, and health. Progress
 * reports must read THIS, not the older per-project `client_project` insight-card
 * packets (`project_intelligence_synthesis_v1`), which are compiled on a slower,
 * separate cadence and read as stale next to the deep read.
 */
const DAILY_DEEP_READ_TARGET_SLUG = "daily-executive-brief";

/**
 * Reads the current daily-deep-read packet and maps this project's record into
 * signals. Returns `null` when the project has no record in the current packet,
 * letting the caller fall back to the legacy source.
 */
async function loadDeepReadSignals(
  db: ReturnType<typeof createServiceClient>,
  projectId: number,
): Promise<IntelligenceSignal[] | null> {
  const { data: target, error: targetError } = await db
    .from("intelligence_targets")
    .select("id")
    .eq("slug", DAILY_DEEP_READ_TARGET_SLUG)
    .maybeSingle();
  if (targetError || !target?.id) return null;

  const { data: packet, error: packetError } = await (db as unknown as UntypedSupabaseReader)
    .from("intelligence_packets")
    .select("packet_json")
    .eq("target_id", target.id)
    .eq("packet_type", "current")
    .order("generated_at", { ascending: false })
    .limit(1);
  if (packetError || !packet?.length) return null;

  const packetJson = asRecord((packet[0] as Record<string, unknown>).packet_json);
  const record = asArray(packetJson.projectRecords)
    .map(asRecord)
    .find((row) => Number(row.projectId) === projectId);
  if (!record) return null;

  return mapDeepReadRecordToSignals(record);
}

async function loadProjectIntelligenceSignals(
  db: ReturnType<typeof createServiceClient>,
  projectId: number,
): Promise<IntelligenceSignal[]> {
  // Prefer the freshest synthesis: the daily deep read. Only fall back to the
  // legacy per-project insight-card packets when this project has no deep-read
  // record yet (e.g. it was not covered in the latest brief run).
  const deepReadSignals = await loadDeepReadSignals(db, projectId).catch(() => null);
  if (deepReadSignals && deepReadSignals.length > 0) return deepReadSignals;

  const { data: target, error: targetError } = await db
    .from("intelligence_targets")
    .select("id")
    .eq("project_id", projectId)
    .eq("target_type", "client_project")
    .maybeSingle();
  if (targetError || !target?.id) return [];

  const { data: packet, error: packetError } = await db
    .from("intelligence_packets")
    .select("id")
    .eq("target_id", target.id)
    .eq("packet_type", "current")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (packetError || !packet?.id) return [];

  const { data: packetCards, error: packetCardsError } = await db
    .from("intelligence_packet_cards")
    .select("insight_card_id, rank")
    .eq("packet_id", packet.id)
    .order("rank", { ascending: true })
    .limit(8);
  if (packetCardsError || !packetCards?.length) return [];

  const cardIds = packetCards.map((row) => row.insight_card_id);
  const [{ data: cards, error: cardsError }, { data: evidenceRows, error: evidenceError }] =
    await Promise.all([
      db
        .from("insight_cards")
        .select("id, title, summary, why_it_matters, next_action")
        .in("id", cardIds),
      db
        .from("insight_card_evidence")
        .select("insight_card_id, source_type, source_title, excerpt, summary")
        .in("insight_card_id", cardIds)
        .order("created_at", { ascending: false }),
    ]);

  if (cardsError || evidenceError) return [];

  const evidenceByCard = new Map<string, IntelligenceSignal["evidence"]>();
  for (const row of evidenceRows ?? []) {
    const list = evidenceByCard.get(row.insight_card_id) ?? [];
    list.push({
      sourceType: row.source_type,
      sourceTitle: row.source_title,
      excerpt: trimForPrompt(row.excerpt, 300) || null,
      summary: trimForPrompt(row.summary, 300) || null,
    });
    evidenceByCard.set(row.insight_card_id, list);
  }

  const cardsById = new Map((cards ?? []).map((row) => [row.id, row]));
  return packetCards
    .map((packetCard) => {
      const card = cardsById.get(packetCard.insight_card_id);
      if (!card) return null;
      return {
        title: card.title,
        summary: trimForPrompt(card.summary, 500),
        whyItMatters: trimForPrompt(card.why_it_matters, 300) || null,
        nextAction: trimForPrompt(card.next_action, 240) || null,
        evidence: (evidenceByCard.get(card.id) ?? []).slice(0, 3),
      };
    })
    .filter((value): value is IntelligenceSignal => value !== null);
}

/**
 * Generates the three progress report sections using AI.
 * Queries source data fresh from the DB for the given week range.
 * Falls back to most recent project data when nothing falls in range.
 *
 * This is separate from `buildProgressReportDraft()` because the deterministic
 * draft should work without an AI provider, while this pass can use broader
 * context and cleaner prose when the provider succeeds.
 */
export async function generateProgressReportSections({
  projectId,
  weekStart,
  weekEnd,
  systemPromptOverride,
}: {
  projectId: number;
  weekStart: string;
  weekEnd: string;
  /** Bake-off / experimentation hook: replace the base system prompt. */
  systemPromptOverride?: string;
}): Promise<AiGeneratedSections> {
  const db = createServiceClient();

  // Pull source context in parallel. Week-bounded meetings/emails/photos tell
  // the model what actually happened during this report period; financial and
  // workflow counts give it client-visible risk/open-item context.
  const [
    projectResult,
    meetingsResult,
    emailsResult,
    photosResult,
    changeEventsResult,
    changeOrdersResult,
    rfisResult,
    submittalsResult,
  ] = await Promise.all([
    db.from("projects").select("name").eq("id", projectId).single(),
    db
      .from("document_metadata")
      .select("id, title, date, summary, overview, action_items, summary_bullets, content, raw_text")
      .eq("project_id", projectId)
      .eq("type", "meeting")
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date", { ascending: false })
      .limit(10),
    db
      .from("project_emails")
      .select("id, subject, body, body_text, sent_at, received_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .gte("received_at", weekStart)
      .lte("received_at", weekEnd)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(15),
    db
      .from("project_photos")
      .select("id, title, description, location, date_taken")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .gte("date_taken", weekStart)
      .lte("date_taken", weekEnd)
      .order("date_taken", { ascending: false, nullsFirst: false })
      .limit(20),
    db
      .from("change_events")
      .select("id, title, status, created_at")
      .eq("project_id", projectId)
      .in("status", ["pending", "open", "in_review"])
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("change_orders")
      .select("id, status, created_at")
      .eq("project_id", projectId)
      .in("status", ["pending", "submitted"])
      .limit(50),
    db
      .from("rfis")
      .select("id, number, subject, status, date_initiated, due_date")
      .eq("project_id", projectId)
      .gte("date_initiated", weekStart)
      .lte("date_initiated", weekEnd)
      .order("number", { ascending: false })
      .limit(20),
    db
      .from("submittals")
      .select("id, submittal_number, title, status, submission_date, sent_date")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .or(`submission_date.gte.${weekStart},sent_date.gte.${weekStart}`)
      .order("submittal_number", { ascending: false })
      .limit(20),
  ]);

  const projectName =
    (projectResult.data as { name: string | null } | null)?.name ?? "Project";

  // Fall back to recent project data when the week has no rows for a source
  // type. This prevents the AI output from becoming generic just because the
  // selected week was quiet or source dates were not populated cleanly.
  const meetings =
    (meetingsResult.data ?? []).length > 0
      ? (meetingsResult.data ?? [])
      : await db
          .from("document_metadata")
          .select("id, title, date, summary, overview, action_items, summary_bullets, content, raw_text")
          .eq("project_id", projectId)
          .eq("type", "meeting")
          .order("date", { ascending: false })
          .limit(5)
          .then((r) => r.data ?? []);

  const emails =
    (emailsResult.data ?? []).length > 0
      ? (emailsResult.data ?? [])
      : await db
          .from("project_emails")
          .select("id, subject, body, body_text, sent_at, received_at")
          .eq("project_id", projectId)
          .is("deleted_at", null)
          .order("received_at", { ascending: false, nullsFirst: false })
          .limit(8)
          .then((r) => r.data ?? []);

  const photos =
    (photosResult.data ?? []).length > 0
      ? (photosResult.data ?? [])
      : await db
          .from("project_photos")
          .select("id, title, description, location, date_taken")
          .eq("project_id", projectId)
          .is("deleted_at", null)
          .order("date_taken", { ascending: false, nullsFirst: false })
          .limit(10)
          .then((r) => r.data ?? []);

  const meetingRows = meetings as MeetingSourceRow[];
  const transcriptMeetingRows = meetingRows.slice(0, 3);
  const fullTranscriptByMeeting = await loadFullDocumentText(
    transcriptMeetingRows.map((meeting) => meeting.id),
  ).catch(() => new Map<string, string>());
  const transcriptMeetings: Array<{
    title: string | null;
    date: string | null;
    transcript: string;
  }> = transcriptMeetingRows
    .map((meeting) => {
      const transcript =
        fullTranscriptByMeeting.get(meeting.id) ||
        trimForPrompt(meeting.content, 6000) ||
        trimForPrompt(meeting.raw_text, 6000);
      if (!transcript) return null;
      return {
        title: meeting.title,
        date: meeting.date,
        transcript,
      };
    })
    .filter((meeting): meeting is { title: string | null; date: string | null; transcript: string } => meeting !== null);

  const intelligenceSignals = await loadProjectIntelligenceSignals(db, projectId).catch(
    () => [],
  );
  const reportSuggestions = await loadProjectReportSuggestions(db, projectId, weekStart, weekEnd).catch(
    () => [],
  );

  const deterministicDraft = buildProgressReportDraft({
    project: {
      name: projectName,
      project_number: null,
      client: null,
      start_date: null,
      scheduled_completion_date: null,
    },
    meetings: meetingRows,
    emails: emails as Parameters<typeof buildProgressReportDraft>[0]["emails"],
    photos: photos as Parameters<typeof buildProgressReportDraft>[0]["photos"],
    currentUser: {
      email: null,
      fullName: null,
    },
    projectContacts: [],
  });

  // The prompt builder is the schema boundary between raw DB rows and the model.
  // Keep formatting/prompt changes there so this file stays focused on source
  // selection, provider invocation, and output validation.
  const userMessage = buildProgressReportUserMessage({
    projectName,
    weekStart,
    weekEnd,
    meetings: meetings as Parameters<typeof buildProgressReportUserMessage>[0]["meetings"],
    emails: emails as Parameters<typeof buildProgressReportUserMessage>[0]["emails"],
    photos: photos as Parameters<typeof buildProgressReportUserMessage>[0]["photos"],
    financialContext: {
      pendingChangeEventsCount: (changeEventsResult.data ?? []).length,
      pendingChangeOrdersCount: (changeOrdersResult.data ?? []).length,
    },
    deterministicDraft: {
      pastWeekHighlights: deterministicDraft.pastWeekHighlights,
      upcomingWeekActivities: deterministicDraft.upcomingWeekActivities,
      openItems: deterministicDraft.openItems,
    },
    rfis: (rfisResult.data ?? []) as Parameters<typeof buildProgressReportUserMessage>[0]["rfis"],
    submittals: (submittalsResult.data ?? []) as Parameters<typeof buildProgressReportUserMessage>[0]["submittals"],
    transcriptMeetings,
    intelligenceSignals,
    reportSuggestions,
  });

  // Inject any learnings from prior human feedback on this surface so the model
  // avoids previously-flagged mistakes. Scoped strictly to `progress_report`
  // (plus this project) — failures here must not block generation.
  const basePrompt = systemPromptOverride ?? PROGRESS_REPORT_SYSTEM_PROMPT;
  let systemPrompt = basePrompt;
  try {
    const learnings = await getSurfaceScopedLearnings({
      surface: "progress_report",
      projectId,
      limit: 3,
    });
    const { block } = buildAgentLearningContextBlock(learnings);
    if (block) systemPrompt = `${basePrompt}\n\n${block}`;
  } catch {
    // keep the base prompt
  }

  // Use a low temperature because progress reports are operational documents:
  // concise, grounded, and repeatable is more valuable than creative variation.
  const result = await generateText({
    model: getLanguageModel(MODEL_ID),
    instructions: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    temperature: 0.4,
  });

  const raw = result.text.trim();
  // The model is instructed to return JSON, but providers may wrap it in a
  // markdown fence. Strip only the wrapper before parsing.
  const jsonText = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let parsed: AiGeneratedSections;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI returned an unstructured response. Try again.");
  }

  // Fail loudly if the model returns partial or malformed JSON. Persisting a
  // partial response would silently erase one of the editor's report sections.
  if (
    typeof parsed.past_week_highlights !== "string" ||
    typeof parsed.upcoming_week_activities !== "string" ||
    typeof parsed.open_items !== "string"
  ) {
    throw new Error("AI response was missing required fields. Try again.");
  }

  // Trim model output at the boundary so downstream save/PDF/email code receives
  // clean strings and does not need to know this content came from AI.
  return {
    past_week_highlights: parsed.past_week_highlights.trim(),
    upcoming_week_activities: parsed.upcoming_week_activities.trim(),
    open_items: parsed.open_items.trim(),
  };
}
