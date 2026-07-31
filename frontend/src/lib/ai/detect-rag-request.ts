/**
 * Source-specific RAG request detection for the AI chat pipeline.
 *
 * Extracted from api/ai-assistant/chat/route.ts to make the detection logic
 * unit-testable without importing the full Next.js route (which has server-only
 * dependencies). The route imports these types/functions directly from here.
 *
 * Background: source-specific requests should use deterministic server-side
 * retrieval before model synthesis, even though the assistant also has AI SDK
 * tools. Keeping this logic in a standalone module makes it testable and
 * prevents silent regression when patterns are added or removed.
 */

export type SourceSpecificRagKind =
  | "meetings_on_date"
  | "recent_meetings"
  | "recent_emails"
  | "recent_onedrive_documents"
  | "recent_teams_discussions";

export type SourceSpecificRagRequest = {
  kind: SourceSpecificRagKind;
  label: string;
  query?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  limit: number;
};

export type RecentEmailInboxRequest = {
  daysBack: number;
  limit: number;
  reason: "structured_outlook_inbox_query";
};

const EMAIL_INBOX_WORDS = /\b(e-?mails?|mail|outlook|inbox)\b/i;
const MESSAGE_INBOX_WORDS = /\b(messages?|correspondence)\b/i;
const EMAIL_RECENCY_OR_TRIAGE_WORDS =
  /\b(today|this morning|morning|yesterday|this week|last week|last five|last 5|recent|latest|new|arrived|received|came in|got|important|urgent|priority|needs? (a )?reply|reply|respond|follow[- ]?up|unread|inbox)\b/i;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function recentDateRange(
  days: number,
  now = new Date(),
): { startDate: string; endDate: string } {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return {
    startDate: isoDate(start),
    endDate: isoDate(end),
  };
}

function priorDateRange(
  daysBackStart: number,
  daysBackEnd: number,
  now = new Date(),
): { startDate: string; endDate: string } {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  end.setUTCDate(end.getUTCDate() - daysBackEnd);
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - daysBackStart);
  return {
    startDate: isoDate(start),
    endDate: isoDate(end),
  };
}

function previousWeekdayIsoDate(targetDay: number, now = new Date()): string {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const diff = (date.getUTCDay() - targetDay + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return isoDate(date);
}

function todayIsoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseExplicitDateRange(
  message: string,
): { startDate: string; endDate: string } | null {
  const isoRange = message.match(
    /\b(20\d{2}-\d{2}-\d{2})\b\s*(?:through|to|until|-|–|—)\s*\b(20\d{2}-\d{2}-\d{2})\b/i,
  );
  if (isoRange) {
    return { startDate: isoRange[1], endDate: isoRange[2] };
  }

  const monthRange = message.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s*(?:through|to|until|-|–|—)\s*(?:(january|february|march|april|may|june|july|august|september|october|november|december)\s+)?(\d{1,2}),?\s+(20\d{2})\b/i,
  );
  if (!monthRange) return null;

  const startMonth = MONTH_NAMES[monthRange[1].toLowerCase()];
  const endMonth = MONTH_NAMES[(monthRange[3] ?? monthRange[1]).toLowerCase()];
  const year = Number(monthRange[5]);
  const startDate = new Date(Date.UTC(year, startMonth, Number(monthRange[2])));
  const endDate = new Date(Date.UTC(year, endMonth, Number(monthRange[4])));

  return {
    startDate: isoDate(startDate),
    endDate: isoDate(endDate),
  };
}

function meetingWindowFromPhrase(
  message: string,
): { startDate: string; endDate: string } | null {
  const explicitRange = parseExplicitDateRange(message);
  if (explicitRange) return explicitRange;

  const normalized = message.toLowerCase();
  if (
    normalized.includes("this week") ||
    normalized.includes("past week") ||
    normalized.includes("last 7 days") ||
    normalized.includes("last seven days")
  ) {
    return recentDateRange(7);
  }

  if (normalized.includes("last week")) {
    return priorDateRange(14, 7);
  }

  return null;
}

// Static phrase list — module-level to avoid per-call reallocation.
// All phrases implicitly contain "meeting", so the normalized.includes("meeting")
// guard in detectSourceSpecificRagRequest acts as a cheap short-circuit.
const GENERAL_MEETING_PHRASES = [
  "review recent meetings",
  "recent meetings",
  "latest meetings",
  "show me meetings",
  "tell me about meetings",
  "what meetings did",
  "what meetings have",
  "what meetings were held",
  "what meetings do we have",
  "meeting updates",
  "meetings this week",
  "meetings this month",
  "meetings last week",
  "meetings last month",
  "any meetings",
  "our meetings",
  "meeting notes",
  "meeting summaries",
  "meeting recap",
  "meeting recaps",
];

// A cross-source investigation ("research through the teams, emails, and meetings
// and see where this started") must NOT be hijacked by the single-source Outlook
// inbox fast-path or the recent-meetings fast-path. Those paths each see only one
// corpus; an investigative question that spans corpora has to reach the semantic
// vector search, which is the only retrieval that searches emails + Teams +
// meetings + files together. Missing this routed a "where did this resignation
// initiate?" question to a live-inbox read of the 25 newest messages and returned
// a false "I found nothing" even though the resignation thread was embedded.
const INVESTIGATION_VERBS =
  /\b(research|investigat\w+|dig (in|into|through)|look (through|into)|trace|tracing|get to the bottom|root cause|figure out|find out|piece together|reconstruct)\b/i;
const ORIGIN_PHRASES =
  /\b(where (this|it|that|things?|everything)\b.{0,30}\b(initiat\w*|start\w*|began|begun|originat\w*|stem\w*|came from|come from)|how (this|it|that)\b.{0,30}\b(start\w*|began|happen\w*|came about|unfold\w*)|what (led|leads) (to|up to)|leading up to (the|his|her|their|this))\b/i;
// Distinct communication corpora. Two or more present ⇒ inherently cross-source.
const CORPUS_GROUPS: RegExp[] = [
  /\b(e-?mails?|outlook)\b/i,
  /\bteams\b/i,
  /\b(meetings?|transcripts?|fireflies)\b/i,
  /\b(onedrive|one drive|sharepoint)\b/i,
];

// A GENERIC "anything important happen today/this week?" catch-up question is
// NOT an investigation — it just happens to name 2+ corpora (email/Teams/
// meetings) because the user wants a portfolio-wide sweep, not a semantic
// vector search over embeddings (which is date-agnostic and surfaces whatever
// is topically similar regardless of when it happened — the exact bug traced
// twice from live /ai sessions on 2026-07-10: `11a3d842-...` and
// `a985a15c-...`, both scoped to "today" but answered from weeks-old May
// results). Category-based (temporal + catch-up topic words) rather than
// literal-phrase matching so it generalizes across paraphrases instead of
// requiring a new pattern per wording variant. "inbox" is excluded so the
// dedicated Microsoft inbox-triage specialist still wins for that phrasing.
const CATCHUP_TOPIC_WORDS =
  /\b(anything|any\w*|important|urgent|notable|major|exciting|worth\s+(knowing|flagging|mentioning)|happen(ed|ing)?|going on|come up|came up)\b/i;
const CATCHUP_TEMPORAL_WORDS =
  /\b(today|yesterday|this morning|this week|recently|lately|overnight|since (yesterday|last week))\b/i;

// Presence of a non-email channel word is what actually distinguishes a
// multi-channel portfolio catch-up ("...over email or in teams or meeting
// transcripts") from single-channel inbox triage ("what important emails
// have I received?") — detectRecentEmailInboxRequest's own "email" trigger
// fires on both, so it can't be used as the sole gate here.
const NON_EMAIL_CHANNEL_WORDS =
  /\b(teams|meetings?|transcripts?|fireflies|onedrive|one drive|sharepoint)\b/i;

export function isBroadTemporalCatchupQuestion(message: string): boolean {
  // Single-channel inbox/message triage ("what important emails have I
  // received this morning?", "any important messages I got today?") has its
  // own tuned Microsoft specialist delegation and must win over the broader
  // portfolio catch-up path — reuse its own detector rather than a narrower
  // "inbox" keyword check, since these phrasings often never say "inbox".
  // Only defer when no OTHER channel is also named; "email or teams or
  // meetings" is a portfolio sweep, not inbox triage, even though it
  // contains "email".
  if (
    !NON_EMAIL_CHANNEL_WORDS.test(message) &&
    detectRecentEmailInboxRequest(message)
  ) {
    return false;
  }
  if (INVESTIGATION_VERBS.test(message) || ORIGIN_PHRASES.test(message)) {
    return false;
  }
  return (
    CATCHUP_TOPIC_WORDS.test(message) && CATCHUP_TEMPORAL_WORDS.test(message)
  );
}

export type CrossSourceInvestigationRequest = {
  reason: "cross_source_investigation";
};

/**
 * Detects an investigative question that must be answered by searching across the
 * whole embedded corpus rather than a single source. Fires when the user uses an
 * investigative/origin phrasing AND references at least one communication corpus,
 * OR when the message references two or more distinct corpora at once.
 *
 * Returns null for ordinary single-source triage ("anything urgent in my inbox?",
 * "review recent meetings") so those keep their tuned fast-paths, and for broad
 * temporal catch-up questions ("anything important happen today?") so those reach
 * the executive briefing path instead of a date-agnostic semantic search — see
 * `isBroadTemporalCatchupQuestion`.
 */
export function detectCrossSourceInvestigationRequest(
  message: string,
): CrossSourceInvestigationRequest | null {
  if (isBroadTemporalCatchupQuestion(message)) return null;

  const corpusCount = CORPUS_GROUPS.reduce(
    (count, re) => count + (re.test(message) ? 1 : 0),
    0,
  );
  const investigative =
    INVESTIGATION_VERBS.test(message) || ORIGIN_PHRASES.test(message);

  if ((investigative && corpusCount >= 1) || corpusCount >= 2) {
    return { reason: "cross_source_investigation" };
  }
  return null;
}

export function detectRecentEmailInboxRequest(
  message: string,
): RecentEmailInboxRequest | null {
  const hasEmailWord = EMAIL_INBOX_WORDS.test(message);
  const hasMessageWord = MESSAGE_INBOX_WORDS.test(message);
  const looksLikeInboxMessage =
    hasMessageWord &&
    /\b(received|arrived|came in|got|inbox|reply|respond|unread)\b/i.test(
      message,
    ) &&
    !/\b(teams|chat|meeting|text messages?)\b/i.test(message);

  if (
    (!hasEmailWord && !looksLikeInboxMessage) ||
    !EMAIL_RECENCY_OR_TRIAGE_WORDS.test(message)
  ) {
    return null;
  }

  const daysBack = /\b(today|this morning|morning)\b/i.test(message)
    ? 0
    : /\byesterday\b/i.test(message)
      ? 1
      : /\b(this week|last week)\b/i.test(message)
        ? 7
        : 1;

  return {
    daysBack,
    limit: /\b(all|everything|every)\b/i.test(message) ? 100 : 50,
    reason: "structured_outlook_inbox_query",
  };
}

/**
 * Detects whether the user message targets a specific data source that should be
 * retrieved server-side before the model responds.
 *
 * This injects source-grounded context directly into the system prompt on the
 * server side before the assistant's AI SDK tool loop runs.
 *
 * Returns null if no source-specific pattern is matched, in which case the
 * standard shouldForceBusinessRetrieval / noToolRetry paths apply.
 */
export function detectSourceSpecificRagRequest(
  message: string,
): SourceSpecificRagRequest | null {
  const normalized = message.toLowerCase();

  // SPECIFIC FIRST: date-anchored meeting queries must be evaluated before the
  // general meeting phrases below. Several GENERAL_MEETING_PHRASES substrings
  // ("what meetings were held", "our meetings", etc.) can match queries that
  // contain a date qualifier — routing them to recent_meetings (60-day, limit 10)
  // instead of meetings_on_date (date-specific, limit 20). The original route.ts
  // ordering evaluated this block first; preserve that behaviour here.
  const asksForMeetingsOnFriday =
    normalized.includes("meeting") &&
    (normalized.includes("conducted on friday") ||
      normalized.includes("meetings on friday") ||
      normalized.includes("held on friday") ||
      normalized.includes("meetings were conducted"));
  if (asksForMeetingsOnFriday) {
    const date = previousWeekdayIsoDate(5);
    return {
      kind: "meetings_on_date",
      label: "Meeting transcripts",
      date,
      limit: 20,
    };
  }

  const asksForMeetingsToday =
    normalized.includes("meeting") &&
    normalized.includes("today") &&
    (normalized.includes("completed") ||
      normalized.includes("conducted") ||
      normalized.includes("held") ||
      normalized.includes("finished") ||
      normalized.includes("insights") ||
      normalized.includes("risks") ||
      normalized.includes("critical") ||
      normalized.includes("decisions") ||
      normalized.includes("action items") ||
      normalized.includes("tell me about"));
  if (asksForMeetingsToday) {
    return {
      kind: "meetings_on_date",
      label: "Meeting transcripts",
      date: todayIsoDate(),
      limit: 20,
    };
  }

  const explicitMeetingWindow = normalized.includes("meeting")
    ? meetingWindowFromPhrase(message)
    : null;
  if (explicitMeetingWindow) {
    return {
      kind: "recent_meetings",
      label: "Recent meeting transcripts",
      startDate: explicitMeetingWindow.startDate,
      endDate: explicitMeetingWindow.endDate,
      limit: 10,
    };
  }

  // GENERAL SECOND: broad recent-meeting queries. Evaluated after date-specific
  // patterns to avoid swallowing queries like "what meetings were held on friday".
  const asksForRecentMeetings =
    normalized.includes("meeting") &&
    GENERAL_MEETING_PHRASES.some((phrase) => normalized.includes(phrase));
  if (asksForRecentMeetings) {
    return {
      kind: "recent_meetings",
      label: "Recent meeting transcripts",
      limit: 10,
    };
  }

  const asksForRecentOneDrive =
    (normalized.includes("onedrive") || normalized.includes("one drive")) &&
    (normalized.includes("most recent") ||
      normalized.includes("latest") ||
      normalized.includes("recent") ||
      normalized.includes("last five") ||
      normalized.includes("last 5"));
  if (asksForRecentOneDrive) {
    return {
      kind: "recent_onedrive_documents",
      label: "OneDrive documents",
      limit: 5,
    };
  }

  // Outlook inbox/date/triage questions must be answered from structured
  // Outlook intake tools, not the RAG/document index. Returning
  // source-specific RAG here lets the chat route short-circuit before
  // getRecentEmails can check the live inbox tables.

  const mentionsTeamsMessages =
    normalized.includes("teams") &&
    /\b(messages?|dms?|chats?|threads?|conversations?|discussions?)\b/i.test(
      message,
    );
  const asksForSameDayTeamsMessages =
    mentionsTeamsMessages &&
    /\b(today|this morning|morning|yesterday|this week|last week|past week|this past week|recent|latest)\b/i.test(
      message,
    );
  const asksForRecentTeams =
    normalized.includes("teams") &&
    (asksForSameDayTeamsMessages ||
      normalized.includes("teams rag") ||
      normalized.includes("look through teams") ||
      normalized.includes("using only teams") ||
      normalized.includes("past week") ||
      normalized.includes("this past week") ||
      normalized.includes("main discussion") ||
      normalized.includes("main discussions") ||
      normalized.includes("latest real signal") ||
      normalized.includes("chatter") ||
      normalized.includes("worried about") ||
      normalized.includes("teams discussion") ||
      normalized.includes("teams discussions") ||
      normalized.includes("chat/thread") ||
      normalized.includes("thread titles") ||
      normalized.includes("recent"));
  if (asksForRecentTeams) {
    const explicitRange = parseExplicitDateRange(message);
    const recentRange = recentDateRange(7);
    return {
      kind: "recent_teams_discussions",
      label: "Teams messages",
      query: message,
      startDate: explicitRange?.startDate ?? recentRange.startDate,
      endDate: explicitRange?.endDate ?? recentRange.endDate,
      limit: 12,
    };
  }

  return null;
}

export function detectSourceLookupRecentTeamsRequest(
  message: string,
  now = new Date(),
): SourceSpecificRagRequest | null {
  const normalized = message.toLowerCase();
  const mentionsTeamsOrMessages =
    /\bteams?\b/.test(normalized) ||
    /\bteam chat\b/.test(normalized) ||
    /\bmessages?\b/.test(normalized);
  const asksAboutPeopleOrEmployees =
    /\bemployees?\b/.test(normalized) ||
    /\bpeople\b/.test(normalized) ||
    /\bteam\b/.test(normalized) ||
    /\bcompany\b/.test(normalized);
  const asksForCommunicationDiagnosis = [
    "biggest source",
    "source of confusion",
    "lack of communication",
    "miscommunication",
    "frustration",
    "frustrated",
    "communication issue",
    "communication issues",
    "where do you think",
    "based on all",
  ].some((phrase) => normalized.includes(phrase));

  if (
    !mentionsTeamsOrMessages ||
    !asksAboutPeopleOrEmployees ||
    !asksForCommunicationDiagnosis
  ) {
    return null;
  }

  const explicitRange = parseExplicitDateRange(message);
  const recentRange = recentDateRange(30, now);
  return {
    kind: "recent_teams_discussions",
    label: "Recent Teams messages",
    query: message,
    startDate: explicitRange?.startDate ?? recentRange.startDate,
    endDate: explicitRange?.endDate ?? recentRange.endDate,
    limit: 20,
  };
}
