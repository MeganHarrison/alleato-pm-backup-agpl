// frontend/src/lib/ai/retrieval/planner.ts
import type { UIMessage } from "ai";
import {
  classifyAssistantIntent,
  shouldUsePacketFirstIntent,
} from "@/lib/ai/intent-router";
import {
  detectCrossSourceInvestigationRequest,
  detectRecentEmailInboxRequest,
  detectSourceSpecificRagRequest,
  isBroadTemporalCatchupQuestion,
} from "@/lib/ai/detect-rag-request";
import {
  compileChatTurnResearchContract,
  detectRequestedExternalResearchSources,
} from "./research-contract";
import type { RetrievalPlan, SubAgent } from "./types";

export type PlanInput = {
  message: string;
  selectedProjectId?: number;
  messages: UIMessage[];
  /**
   * True when the current in-memory conversation carries file attachments.
   * Attachments mean the user wants help WITH the files — route to a
   * conversational path that uses them, never the cold project briefing (which
   * is why a text-only "can you see the screenshot?" follow-up used to get a
   * generic project-health dump).
   */
  hasAttachments?: boolean;
};

// Create/open/add a record (commitment, change order, RFI, etc.). These are
// transactional asks that must reach the model's create-* tools, NOT the
// project-status briefing synthesis. Migration/import phrasing is included
// because that workflow is "get these records into the system".
const TRANSACTIONAL_CREATE_PATTERNS = [
  /\b(create|open|add|set up|draft|generate|log|enter|build|start)\b.{0,40}\b(commitment|subcontract|purchase order|\bpo\b|change order|change event|\brfi\b|submittal|invoice|direct cost|prime contract|company|contact|vendor|daily log|budget line)\b/i,
  /\b(migrat\w+|import\w*|cross over|crossover|transfer|bring over|move over|get .{0,20}(data|records|exports?) (in|into|over|crossed))\b/i,
];

export const PROJECT_SCOPE_REQUIRED_OPENING =
  "Select a project before I search.";

const SELECTED_PROJECT_REFERENCE =
  /\b(?:this|that|the(?:\s+(?:selected|current|active|pinned))?)\s+(?:project|job|jobsite|site)\b/i;
const UNRESOLVED_SCOPE_FOLLOWUP =
  /^(?:what\s+about|how\s+about|why\b|how\s+come|and\b|also\b|but\b|continue\b|go\s+on\b|tell\s+me\s+more\b|show\s+me\s+more\b|more\s+(?:about|on|regarding)\b|go\s+deeper\b|dig\s+(?:in|deeper)\b|drill\s+(?:in|down)\b)/i;

function previousAssistantRequiredProjectScope(messages: UIMessage[]): boolean {
  const latestAssistant = [...messages]
    .slice(0, -1)
    .reverse()
    .find((message) => message.role === "assistant");
  return latestAssistant
    ? extractText(latestAssistant).includes(PROJECT_SCOPE_REQUIRED_OPENING)
    : false;
}

/**
 * Deictic project references are meaningful only when the client supplied a
 * pinned project id. Without that id, broad organization retrieval is not a
 * safe fallback: it changes the requested scope while appearing successful.
 */
export function requiresSelectedProjectContext(
  message: string,
  selectedProjectId?: number,
  messages: UIMessage[] = [],
): boolean {
  if (typeof selectedProjectId === "number") return false;
  if (SELECTED_PROJECT_REFERENCE.test(message)) return true;
  return (
    previousAssistantRequiredProjectScope(messages) &&
    UNRESOLVED_SCOPE_FOLLOWUP.test(message.trim())
  );
}

function isTransactionalCreateRequest(message: string): boolean {
  return TRANSACTIONAL_CREATE_PATTERNS.some((pattern) => pattern.test(message));
}

// Outbound send requests ("send a Teams message to Brandon", "send an email to
// the client on my behalf") must reach the model's send/draft tools. They
// mention channel words (teams, email, message) that the cross-source and
// source-lookup detectors below treat as retrieval corpora — without this
// guard a verbatim "Send a Teams message on my behalf" request was answered
// with semantic-search results instead of a send (production miss 2026-07-10).
// "send me/us ..." is a request to RECEIVE information and stays on retrieval.
// Send verbs only count when they lead the request (allowing a polite prefix):
// mid-sentence or interrogative "send" ("did we send the schedule email?") is
// retrieval, not an action. "…on my behalf" marks a send even mid-sentence.
const OUTBOUND_SEND_PATTERNS = [
  /^(?:please\s+|can you\s+(?:please\s+)?|could you\s+(?:please\s+)?|would you\s+(?:please\s+)?|go ahead and\s+)?(?:send|shoot|fire off|post)\b(?!\s+(?:me|us)\b)[\s\S]{0,80}\b(?:message|chat|dm|email|e-mail|note|reply|invite)\b/i,
  /\b(?:send|shoot|fire off|post)\b(?!\s+(?:me|us)\b).{0,50}\b(?:message|email|e-mail|chat|dm)\b.{0,60}\bon my behalf\b/i,
  /^(?:please\s+|can you\s+(?:please\s+)?|could you\s+(?:please\s+)?|would you\s+(?:please\s+)?|go ahead and\s+)?(?:dm|ping|message)\s+\w+.{0,30}\b(?:on|in|via|over)\s+teams\b/i,
];

function isOutboundSendRequest(message: string): boolean {
  const text = message.trim();
  return OUTBOUND_SEND_PATTERNS.some((pattern) => pattern.test(text));
}

const FOLLOWUP_PHRASES = [
  /\b(based on|given) (that|this|the (previous|prior) (answer|briefing|summary))\b/i,
  /\bwhat (should|do) (i|we|brandon) (do|decide|communicate) (next|now|today)\b/i,
  /\b(source|cite|citation|evidence)\b/i,
  /\b(why|how come|why did)\b/i,
  /\b(more detail|elaborate|expand)\b/i,
  // "tell me more about union collective", "more on the permit risk", "what
  // about steel pricing" — the single most common way a user drills into a
  // subject the prior turn just named. Without these, such a turn fell through
  // to conversational_fallback with ZERO retrieval and the model returned an
  // empty response. See the trace in docs/architecture/AI-RAG-ARCHITECTURE.md.
  /\btell me more\b/i,
  /\b(more|read more|learn more|know more) (about|on|regarding)\b/i,
  /\bwhat about\b/i,
  /\b(go deeper|dig (in|deeper)|drill (in|down)|deep[- ]?dive)\b/i,
];

const FINANCIAL_KEYWORDS = /\b(budget|cost|margin|invoice|payment|exposure|cash|retention|forecast)\b/i;
const PEOPLE_KEYWORDS = /\b(who|stretched|capacity|staffing|on the team|assigned)\b/i;
const RISK_KEYWORDS = /\b(risk|worried|blocker|delay|issue|exposure)\b/i;
const BD_KEYWORDS = /\b(pipeline|new business|win rate|hit rate|lead|opportunity)\b/i;
const EXECUTIVE_DEEP_AGENT_PATTERNS: Array<{
  pattern: RegExp;
  intent: ReturnType<typeof classifyAssistantIntent>;
}> = [
  {
    pattern:
      /\b(active projects?|all projects?|portfolio|company[- ]wide|business[- ]wide)\b.{0,80}\b(health|status|overview|risk|risks|read|briefing)\b/i,
    intent: "latest_status",
  },
  {
    pattern:
      /\b(health|status|overview|risk|risks|read|briefing)\b.{0,80}\b(active projects?|all projects?|portfolio|company[- ]wide|business[- ]wide)\b/i,
    intent: "latest_status",
  },
  {
    pattern:
      /\b(highest priority|top priority|what should brandon focus|what should i focus|most important thing|state of the business)\b/i,
    intent: "risk_review",
  },
  {
    pattern:
      /\b(brandon'?s? must[- ]do|must[- ]do items?|what are brandon'?s? tasks|what does brandon need to do|my must[- ]do)\b/i,
    intent: "task_followup",
  },
  {
    pattern:
      /\b(pipeline|new business|opportunities|pursuits?|stuck deals?|deal flow)\b/i,
    intent: "latest_status",
  },
  {
    pattern:
      /\b(today'?s meetings?|meetings? today|meeting insights?|insights from today'?s meetings?)\b/i,
    intent: "latest_status",
  },
  {
    pattern:
      /\b(clients? upset|client relationship risk|relationship risk|unhappy clients?|frustrated clients?|client frustration|clients? angry)\b/i,
    intent: "risk_review",
  },
];

function detectPreconsult(message: string): SubAgent[] {
  const agents: SubAgent[] = [];
  if (FINANCIAL_KEYWORDS.test(message)) agents.push("cfo");
  if (PEOPLE_KEYWORDS.test(message)) agents.push("chro");
  if (RISK_KEYWORDS.test(message)) agents.push("coo");
  if (BD_KEYWORDS.test(message)) agents.push("vpbd");
  return agents;
}

function detectExecutiveDeepAgentIntent(
  message: string,
  selectedProjectId?: number,
): ReturnType<typeof classifyAssistantIntent> | null {
  if (typeof selectedProjectId === "number") return null;

  // Category-based (temporal + catch-up topic words), not literal-phrase
  // matching, so paraphrases of "anything important happen today?" generalize
  // instead of needing a new pattern per wording. Shared with
  // detectCrossSourceInvestigationRequest so both routing decisions agree —
  // see isBroadTemporalCatchupQuestion for the rationale and incident trace.
  if (isBroadTemporalCatchupQuestion(message)) return "latest_status";

  const match = EXECUTIVE_DEEP_AGENT_PATTERNS.find(({ pattern }) =>
    pattern.test(message),
  );
  return match?.intent ?? null;
}

function extractText(msg: UIMessage): string {
  if (typeof (msg as unknown as { content?: unknown }).content === "string") {
    return (msg as unknown as { content: string }).content;
  }
  const parts = (msg as unknown as { parts?: Array<{ type: string; text?: string }> }).parts;
  if (!parts) return "";
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join(" ");
}

function isFollowUp(messages: UIMessage[]): boolean {
  if (messages.length < 3) return false;
  const last = messages[messages.length - 1];
  const lastText = extractText(last);
  return FOLLOWUP_PHRASES.some((re) => re.test(lastText));
}

function isExplicitConversationalReference(message: string): boolean {
  return FOLLOWUP_PHRASES.slice(0, 2).some((re) => re.test(message));
}

function isBrandonDaily(message: string): boolean {
  return /brandon.{0,12}(daily|update|brief)/i.test(message);
}

// Decide whether to ROUTE the entire answer to the source-health fast-path.
// This MUST be stricter than shouldAttachAssistantSourceHealth (which only
// attaches supplemental context): routing hijacks the user's question, so it
// may only fire when they are genuinely asking about the freshness / sync /
// trustworthiness of the DATA itself — never on the common adjective "current"
// (as in "current AR aging", "current phase", "current market price") or bare
// "status"/"latest". Regression coverage below protects this distinction.
function isSourceHealthRequest(
  message: string,
  selectedProjectId?: number,
): boolean {
  if (
    /\b(find|exact|evidence|clause|excerpt|drill|answer from|best available document read)\b/i.test(
      message,
    )
  ) {
    return false;
  }

  // Explicit "is my data fresh / synced / trustworthy" questions.
  const explicitSourceHealth =
    /\b(source health|source status|sync status|data (health|freshness|coverage)|how (fresh|current|up to date|stale) (is|are)|is (the|my) (data|inbox|source|sources|packet|snapshot)\b|are (the|my) (sources|data|emails|meetings|documents|packets?|messages|transcripts?) (synced|fresh|up to date|current|stale|loaded|missing|complete)|when (did|was) .{0,40}(sync|synced|updated|refreshed?)|can i trust|safe to use|is it (current|up to date|reliable|stale) enough)\b/i.test(
      message,
    );
  if (explicitSourceHealth) return true;

  // Generic: a freshness/sync SUBJECT (the data itself) plus a trust/health
  // SIGNAL. "current"/"status"/"latest" are NOT subjects — they are adjectives.
  const freshnessSubject =
    /\b(sources?|data feeds?|sync|synced|syncing|embed|embedded|embedding|vectoriz\w*|packets?|snapshots?|coverage|pipeline|ingest\w*|source sync|data freshness)\b/i.test(
      message,
    );
  const trustSignal =
    /\b(stale|fresh|freshness|up[-\s]?to[-\s]?date|out of date|outdated|reliable|reliability|trust\w*|health|healthy|loaded|missing|thin|behind|backlog|last (sync|synced|updated|refresh\w*))\b/i.test(
      message,
    );
  if (freshnessSubject && trustSignal) return true;

  // Project-scoped packet/snapshot freshness check (requires a context word).
  const hasPacketFreshness =
    /\b(packets?|snapshots?|coverage|document intelligence)\b/i.test(message) &&
    /\b(stale|missing|thin|fresh|loaded|health|up to date|current)\b/i.test(
      message,
    );
  if (typeof selectedProjectId === "number" && hasPacketFreshness) {
    return true;
  }

  return false;
}

function projectOperatingContextSources(selectedProjectId?: number): {
  intelligencePacket?: { mode: "additive" };
  projectSnapshot?: { reason: "intent" };
} {
  if (typeof selectedProjectId !== "number") return {};
  return {
    intelligencePacket: { mode: "additive" },
    projectSnapshot: { reason: "intent" },
  };
}

export function planRetrieval(input: PlanInput): RetrievalPlan {
  const { message, selectedProjectId, messages } = input;
  const intent = classifyAssistantIntent(message, { selectedProjectId });
  const requestedResearchSources = detectRequestedExternalResearchSources(message);
  const recentEmailInbox = detectRecentEmailInboxRequest(message);
  const sourceSpecific = detectSourceSpecificRagRequest(message);
  // The browser normally submits the current turn alongside its history, but
  // resume/reload paths can omit the prior assistant message. Explicit
  // references such as "Based on that" still must not become fresh executive
  // research jobs just because that client detail is absent.
  const followsPriorBriefing =
    !previousAssistantRequiredProjectScope(messages) &&
    (isFollowUp(messages) || isExplicitConversationalReference(message));

  if (requiresSelectedProjectContext(message, selectedProjectId, messages)) {
    return {
      intent,
      responseFormat: "project_scope_required",
      sources: {},
      reason: "selected_project_context_missing",
    };
  }

  if (isSourceHealthRequest(message, selectedProjectId)) {
    return {
      intent: "source_health",
      responseFormat: "briefing_template",
      sources: {
        ...projectOperatingContextSources(selectedProjectId),
      },
      selectedProjectId,
      reason: "project_context_source_health",
    };
  }

  if (isBrandonDaily(message)) {
    return {
      intent,
      responseFormat: "brandon_daily",
      sources: { brandonDailyUpdate: true },
      reason: "brandon_daily_keyword",
    };
  }

  // An explicit feedback submission must reach submitFeedback even when it is
  // confirming an earlier assistant offer and a project is selected. Loading a
  // briefing or vector search here primes a read response and hides the tool.
  if (intent === "feedback_write") {
    return {
      intent,
      responseFormat: "conversational",
      sources: {},
      selectedProjectId,
      reason: "feedback_write_request",
    };
  }

  // Prime Contract SOV mutations must reach editPrimeContractSov. In
  // particular, the verb "update" otherwise looks like a status briefing and
  // can be answered by the packet fast path before any write tool is offered.
  if (intent === "prime_contract_sov_write") {
    return {
      intent,
      responseFormat: "conversational",
      sources: {},
      selectedProjectId,
      reason: "prime_contract_sov_write_request",
    };
  }

  // A conversational reference such as "Based on that" must retain the
  // previous answer as its primary context. Routing it to a fresh business-wide
  // Deep Agent run loses the thread and can turn a decision follow-up into an
  // expensive, unrelated inbox/portfolio sweep.
  if (followsPriorBriefing) {
    return {
      intent,
      responseFormat: "conversational",
      sources: {
        reusePriorBriefing: true,
        semanticVectorSearch: { query: message },
      },
      preconsult: detectPreconsult(message),
      selectedProjectId,
      reason: "followup_to_prior_briefing",
    };
  }

  const executiveDeepAgentIntent = detectExecutiveDeepAgentIntent(
    message,
    selectedProjectId,
  );
  if (executiveDeepAgentIntent) {
    return {
      intent: executiveDeepAgentIntent,
      responseFormat: "briefing_template",
      sources: {},
      selectedProjectId,
      reason: "executive_deep_agent_broad_operator_question",
    };
  }

  if (intent === "app_help") {
    return {
      intent,
      responseFormat: "app_help",
      sources: { appExpert: { question: message } },
      reason: "app_help_intent",
    };
  }

  if (intent === "change_event_write") {
    return {
      intent,
      responseFormat: "conversational",
      sources: {
        ...projectOperatingContextSources(selectedProjectId),
        semanticVectorSearch: { query: message },
      },
      preconsult: detectPreconsult(message),
      selectedProjectId,
      reason: selectedProjectId
        ? "project_context_change_event_write_request"
        : "change_event_write_request",
    };
  }

  // Outbound sends win over every retrieval path below: the channel words they
  // contain ("teams", "email", "message") are exactly what the cross-source and
  // source-lookup detectors key on, so evaluating retrieval first hijacks the
  // action into a semantic search and the send tool is never reached.
  if (isOutboundSendRequest(message)) {
    return {
      intent,
      responseFormat: "conversational",
      sources: {},
      selectedProjectId,
      reason: "outbound_message_send_request",
    };
  }

  // Cross-source investigations ("research the teams, emails, and meetings and see
  // where this started") MUST reach the semantic vector search, which is the only
  // retrieval that spans emails + Teams + meetings + files. This is evaluated
  // BEFORE the single-source Outlook-inbox and recent-meetings fast-paths below,
  // which would otherwise hijack the question into one corpus and return a false
  // "found nothing" (e.g. a sudden-resignation question answered by reading only
  // the 25 newest inbox messages). The embedded resignation thread/meeting only
  // surface through semanticVectorSearch.
  if (detectCrossSourceInvestigationRequest(message)) {
    const research = compileChatTurnResearchContract({
      message,
      externalSources: requestedResearchSources,
    });
    return {
      intent: "source_lookup",
      responseFormat: "source_lookup",
      sources: {
        ...projectOperatingContextSources(selectedProjectId),
        ...(research
          ? { research }
          : { semanticVectorSearch: { query: message } }),
      },
      selectedProjectId,
      reason: selectedProjectId
        ? "project_context_cross_source_investigation_research_contract"
        : "cross_source_investigation_research_contract",
    };
  }

  if (recentEmailInbox) {
    return {
      intent,
      responseFormat: "conversational",
      sources: {},
      reason: `microsoft_specialist_delegation_${recentEmailInbox.reason}`,
    };
  }

  // Check follow-up BEFORE source_lookup so "what's the source for X?" in a
  // multi-turn conversation reuses prior context instead of spawning a new lookup.
  if (sourceSpecific) {
    return {
      intent,
      responseFormat: "source_specific_rag",
      sources: {
        ...projectOperatingContextSources(selectedProjectId),
        sourceSpecificRag: { kind: sourceSpecific.kind },
      },
      selectedProjectId,
      reason: selectedProjectId
        ? `project_context_source_specific_rag_${sourceSpecific.kind}`
        : `source_specific_rag_${sourceSpecific.kind}`,
    };
  }

  if (intent === "source_lookup") {
    return {
      intent,
      responseFormat: "source_lookup",
      sources: {
        ...projectOperatingContextSources(selectedProjectId),
        semanticVectorSearch: { query: message },
      },
      selectedProjectId,
      reason: selectedProjectId
        ? "project_context_source_lookup_intent"
        : "source_lookup_intent",
    };
  }

  // Intercept the status-dump default: a conversation carrying attachments, or
  // a transactional create / data-migration ask, must NOT fall into the project
  // briefing below. These checks sit just above packet-first so they only
  // redirect what would otherwise become a cold status synthesis — the specific
  // email/source/followup routes above keep their behavior.
  if (input.hasAttachments) {
    // Help WITH the files, using their (inlined) content + the conversation.
    return {
      intent,
      responseFormat: "conversational",
      sources: {},
      preconsult: detectPreconsult(message),
      selectedProjectId,
      reason: "user_attachments_present",
    };
  }
  if (isTransactionalCreateRequest(message)) {
    // Let the model reach its create-* tools instead of briefing.
    return {
      intent,
      responseFormat: "conversational",
      sources: {},
      preconsult: detectPreconsult(message),
      selectedProjectId,
      reason: "transactional_create_request",
    };
  }

  // Packet-first intents (status, briefing, financial, change mgmt, etc.)
  // emit project-scoped retrieval whether or not the user pre-selected a
  // project. The executor resolves the project from the message text when no
  // selectedProjectId is provided.
  if (shouldUsePacketFirstIntent(intent)) {
    return {
      intent,
      responseFormat: "briefing_template",
      sources: {
        intelligencePacket: { mode: "additive" },
        intelligenceEvidence: { mode: "current" },
        projectSnapshot: { reason: "intent" },
        semanticVectorSearch: { query: message },
      },
      preconsult: detectPreconsult(message),
      selectedProjectId,
      reason: selectedProjectId ? "packet_first_with_project" : "packet_first_resolve_from_text",
    };
  }

  return {
    intent,
    responseFormat: "conversational",
    sources: {},
    preconsult: detectPreconsult(message),
    selectedProjectId,
    reason: "conversational_fallback",
  };
}
