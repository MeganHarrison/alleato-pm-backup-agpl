export type AssistantIntent =
  | "target_briefing"
  | "latest_status"
  | "risk_review"
  | "financial_analysis"
  | "change_management_review"
  | "decision_lookup"
  | "task_followup"
  | "task_write"
  | "feedback_write"
  | "prime_contract_sov_write"
  | "change_event_write"
  | "email_action"
  | "teams_message_action"
  | "calendar_action"
  | "external_research"
  | "source_lookup"
  | "source_health"
  | "strategy_brainstorm"
  | "implementation_planning"
  | "app_help"
  | "general_conversation";

// Explicit feature-gap / bug submissions must reach submitFeedback. Check
// these before task_followup because confirmation wording often includes
// "missed", which otherwise means "show me missed tasks" to the broad reader.
const FEEDBACK_WRITE_PATTERNS = [
  /\b(submit|send|record|log|file|report|create)\b.{0,80}\b(feedback|feature gap|feature request|missing feature|bug)\b/i,
  /\b(feedback|feature gap|feature request|missing feature|bug)\b.{0,80}\b(submit|send|record|log|file|report|create|fix|address)\b/i,
  /\b(log|file|report)\b.{0,50}\bas (a )?feature\b/i,
];

// Existing Prime Contract SOV mutations are action requests, even when they
// contain the broad status word "update" or financial words such as "cost".
// Keep these ahead of project-status and financial packet routing so the model
// can reach editPrimeContractSov from any page where Alleato AI is available.
const PRIME_CONTRACT_SOV_WRITE_PATTERNS = [
  /\b(update|edit|change(?!\s+(?:orders?|history|log|status)\b)|add|append|insert|replace|correct|revise)\b.{0,100}\b(prime contract|contract)\b.{0,40}\b(SOV|schedule of values?)\b/i,
  /\b(update|edit|change(?!\s+(?:orders?|history|log|status)\b)|add|append|insert|replace|correct|revise)\b.{0,100}\b(SOV|schedule of values?)\b.{0,50}\b(prime contract|contract)\b/i,
  /\b(update|edit|change(?!\s+(?:orders?|history|log|status)\b)|add|append|insert|replace|correct|revise)\b.{0,80}\b(existing )?(SOV|schedule of values?)\s+(row|line|item)s?\b/i,
  /\bpreview\b.{0,30}\bchanging\b.{0,100}\b(prime contract|contract)\b.{0,40}\b(SOV|schedule of values?)\b/i,
  /\bpreview\b.{0,30}\bchanging\b.{0,100}\b(SOV|schedule of values?)\b.{0,50}\b(prime contract|contract)\b/i,
];

const PRIME_CONTRACT_SOV_CONTEXT_PATTERNS = [
  /\b(prime contract|contract)\b.{0,100}\b(SOV|schedule of values?)\b/i,
  /\b(SOV|schedule of values?)\b.{0,100}\b(prime contract|contract)\b/i,
];

// The SOV *is* the schedule of contract line values, so adding or editing cost
// codes / amounts / line items ON A PRIME CONTRACT is an SOV edit even when the
// user never says "SOV" or "schedule of values" — the exact trace wording
// "add these cost codes and amounts to this prime contract" (d9a9595f) must
// reach editPrimeContractSov instead of falling through to financial_analysis
// on the word "cost". Scoped to the literal "prime contract" (not bare
// "contract") so commitment / subcontract line-item edits are NOT captured.
const PRIME_CONTRACT_LINE_ITEM_NOUNS =
  "(?:cost codes?|budget codes?|amounts?|line[- ]?items?|quantit(?:y|ies)|unit costs?)";

const PRIME_CONTRACT_LINE_ITEM_WRITE_PATTERNS = [
  new RegExp(
    `\\b(update|edit|change(?!\\s+(?:orders?|history|log|status)\\b)|add|append|insert|replace|correct|revise|set)\\b.{0,100}\\bprime contract\\b.{0,80}\\b${PRIME_CONTRACT_LINE_ITEM_NOUNS}\\b`,
    "i",
  ),
  new RegExp(
    `\\b(update|edit|change(?!\\s+(?:orders?|history|log|status)\\b)|add|append|insert|replace|correct|revise|set)\\b.{0,100}\\b${PRIME_CONTRACT_LINE_ITEM_NOUNS}\\b.{0,80}\\bprime contract\\b`,
    "i",
  ),
];

const PRIME_CONTRACT_LINE_ITEM_CONTEXT_PATTERNS = [
  new RegExp(`\\bprime contract\\b.{0,80}\\b${PRIME_CONTRACT_LINE_ITEM_NOUNS}\\b`, "i"),
  new RegExp(`\\b${PRIME_CONTRACT_LINE_ITEM_NOUNS}\\b.{0,80}\\bprime contract\\b`, "i"),
];

const READ_ONLY_UPDATE_CUE_PATTERN =
  /\b(?:update me|(?:(?:an?|the|latest|current|progress|status)\s+){1,3}update(?:\s+(?:on|about|for|regarding))?|update\s+(?:on|about|for|regarding))\b/i;

const PRIME_CONTRACT_SOV_EXPLICIT_MUTATION_PATTERN =
  /\b(edit|add|append|insert|replace|correct|revise|set)\b|\bchange\b(?!\s+(?:orders?|history|log|status)\b).{0,60}\b(?:SOV|schedule of values?|row|line item|cost code|amount|quantity|unit cost)\b|\bpreview\b.{0,30}\bchanging\b.{0,60}\b(?:SOV|schedule of values?|row|line item|cost code|amount|quantity|unit cost)\b/i;

function isPrimeContractSovWritePrompt(text: string): boolean {
  const hasPrimeContractSovContext =
    PRIME_CONTRACT_SOV_CONTEXT_PATTERNS.some((pattern) => pattern.test(text)) ||
    PRIME_CONTRACT_LINE_ITEM_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
  const isReadOnlyUpdate =
    hasPrimeContractSovContext && READ_ONLY_UPDATE_CUE_PATTERN.test(text);
  if (isReadOnlyUpdate && !PRIME_CONTRACT_SOV_EXPLICIT_MUTATION_PATTERN.test(text)) {
    return false;
  }

  return (
    PRIME_CONTRACT_SOV_WRITE_PATTERNS.some((pattern) => pattern.test(text)) ||
    PRIME_CONTRACT_LINE_ITEM_WRITE_PATTERNS.some((pattern) => pattern.test(text))
  );
}

// Phrases that unambiguously mean "create / modify / delete a task record".
// These must be checked BEFORE task_followup so write-intent is not mis-routed
// to packet-retrieval, which primes the model for a reading pattern and causes
// it to describe the task in text instead of calling createGeneratedTask.
const TASK_WRITE_PATTERNS = [
  /\b(remind me to|remind me about)\b/i,
  /\b(add a task|add task|create (a|the|this|that) task|create task|make a task|log a task|log that I need to)\b/i,
  /\b(flag (this |it )?for follow[- ]?up|throw (this |it )?on (my )?list)\b/i,
  /\bnote for myself\b/i,
  /\baction item:\s/i,
  /\bget someone on\b/i,
  /\bput (this |it )?on (my |the )?list\b/i,
  /\bassign (this |that |it )?to\b/i,
  /\b(push|move|bump)\b.{0,40}\b(task|due date|deadline)\b/i,
  /\bhand\b.{0,40}\boff to\b/i,
  /\bschedule a task\b/i,
  /\bgenerate (a )?task\b/i,
  /\bmake (a )?task\b/i,
  // "Add a task for the PM to…" / "Add a task for X to…"
  /\badd a task for\b/i,
];

const CALENDAR_ACTION_PATTERNS = [
  /\b(schedule|create|send|draft|set up|book)\b.{0,50}\b(calendar invite|outlook invite|meeting invite|teams invite|calendar event|meeting)\b/i,
  /\b(add|put)\b.{0,40}\b(on|to)\b.{0,20}\b(calendar|outlook)\b/i,
  /\b(create|send)\b.{0,40}\b(invite|invitation)\b/i,
];

// Send verbs only count as an ACTION when they lead the request (allowing a
// polite prefix). Mid-sentence or interrogative "send" is usually retrieval
// ("did we send the schedule email?", "the message Ronnie sent in teams"),
// and "send me/us ..." is a request to RECEIVE information — both must stay
// on the retrieval paths.
const IMPERATIVE_PREFIX =
  "^(?:please\\s+|can you\\s+(?:please\\s+)?|could you\\s+(?:please\\s+)?|would you\\s+(?:please\\s+)?|go ahead and\\s+)?";

const EMAIL_ACTION_PATTERNS = [
  /\b(draft|write|prepare|compose)\b.{0,50}\b(email|e-mail|reply|response|outlook message|message)\b/i,
  /\b(email|e-mail|reply|respond)\b.{0,50}\b(draft|write|prepare|compose|back)\b/i,
  new RegExp(
    `${IMPERATIVE_PREFIX}send\\b(?!\\s+(?:me|us)\\b).{0,50}\\b(?:email|e-mail|reply|response|outlook message)\\b`,
    "i",
  ),
];

// Outbound Teams sends must be classified before email_action and before any
// retrieval classification — "send a Teams message to Brandon" contains the
// corpus word "teams" and the evidence noun "message", which the source-lookup
// patterns below would otherwise steal into transcript search (production miss
// 2026-07-10: a verbatim "Send a Teams message on my behalf" request was
// answered with semantic-search hits instead of reaching sendTeamsMessage).
const TEAMS_MESSAGE_ACTION_PATTERNS = [
  new RegExp(
    `${IMPERATIVE_PREFIX}(?:send|post|shoot|fire off)\\b(?!\\s+(?:me|us)\\b).{0,60}\\bteams\\b.{0,30}\\b(?:message|chat|dm|note)\\b`,
    "i",
  ),
  new RegExp(
    `${IMPERATIVE_PREFIX}(?:send|post|shoot|fire off)\\b(?!\\s+(?:me|us)\\b).{0,40}\\b(?:message|chat|dm|note)\\b.{0,60}\\b(?:on|in|via|over)\\s+teams\\b`,
    "i",
  ),
  new RegExp(
    `${IMPERATIVE_PREFIX}(?:dm|ping|message)\\s+\\w+.{0,30}\\b(?:on|in|via|over)\\s+teams\\b`,
    "i",
  ),
  // "…on my behalf" marks an outbound send even mid-sentence.
  /\bteams\b.{0,30}\b(message|chat|dm)\b.{0,80}\bon my behalf\b/i,
];

const CHANGE_EVENT_WRITE_PATTERNS = [
  /\b(create|draft|log|prepare|open|raise|start|make|set up)\b.{0,80}\b(change request|change event|potential change|field change|scope change)\b/i,
  /\b(change request|change event|potential change|field change|scope change)\b.{0,80}\b(create|draft|log|prepare|open|raise|start|make)\b/i,
  /\b(turn|convert)\b.{0,80}\b(into|to)\b.{0,40}\b(change request|change event|potential change)\b/i,
];

const CHANGE_EVENT_FIELD_FOLLOWUP_PATTERNS = [
  /\b(CR-\d[\w-]*|change request|change event|owner change|scope change|field change)\b.{0,120}\b(title|description|type|scope|status|reason|origin|expecting revenue|revenue(?!\s+source))\b/i,
  /\b(title|description|type|scope|status|reason|origin|expecting revenue|revenue(?!\s+source))\b.{0,120}\b(CR-\d[\w-]*|change request|change event|owner change|scope change|field change)\b/i,
];

// Broad pattern for any mention of a communication artifact. Does NOT include
// "meetings?" because "review recent meetings" and "show meeting insights" are
// status/briefing questions that should go through packet-first retrieval, not
// a narrow vector search. Meeting-specific explicit lookups are covered by
// EXPLICIT_SOURCE_LOOKUP_PATTERNS below.
// NOTE: bare "source" is deliberately NOT a standalone trigger here. It collides
// with domain field names — "Line Item Revenue Source", "funding source",
// "source of truth" — and used to steal product how-to questions into transcript
// search (e.g. "what does Line Item Revenue Source do" → semanticSearch). The
// word "source" only signals a source lookup in an evidence-retrieval phrasing,
// captured by the guarded patterns below. Regression-guarded by intent-router.test.ts.
const SOURCE_LOOKUP_PATTERNS = [
  // Communication-channel + evidence nouns that unambiguously name a retrievable
  // record. These fire unconditionally — they don't collide with field names.
  /\b(evidence|citation|transcript|emails?|e-mails?|inbox|mails?|outlook|teams|messages?|documents?)\b/i,
  /\bshow me\b.*\b(where|source|messages?|emails?|e-mails?|inbox)\b/i,
];

// "source(s)" as an evidence-retrieval request. Gated below by
// DOMAIN_FIELD_SOURCE_PATTERN so the word "source" in a FIELD NAME does not trip it.
const SOURCE_WORD_LOOKUP_PATTERNS = [
  /\b(what'?s|what is|where'?s|where is|show me|find|pull up|cite|give me|need|underlying|original)\b.{0,40}\bsources?\b/i,
  /\bsources? (for|of|behind|on|that|showing|backing|supporting)\b/i,
];

// When "source" is preceded by a domain qualifier it's a field name
// ("revenue source", "funding source", "line item source"), not a request to
// retrieve an underlying record. This is the guard for the production miss where
// "what does Line Item Revenue Source do" was routed to transcript search.
const DOMAIN_FIELD_SOURCE_PATTERN =
  /\b(revenue|funding|cost|income|payment|budget|data|line[- ]?item)\s+sources?\b/i;

const EXPLICIT_SOURCE_LOOKUP_PATTERNS = [
  /\b(look through|search|find|check|pull up|scan|show me)\b.{0,60}\b(teams|messages?|chats?|emails?|e-mails?|inbox|outlook|meetings?|transcripts?|documents?)\b/i,
  /\b(teams|messages?|chats?|emails?|e-mails?|inbox|outlook|meetings?|transcripts?|documents?)\b.{0,60}\b(source|evidence|signal|chatter|discussion|thread|conversation|records?)\b/i,
];

const EXTERNAL_RESEARCH_PATTERNS = [
  /\b(web search|search (the )?(public )?web|live web|internet|online sources?|external sources?)\b/i,
  /\b(research|look up|compare|find|search)\b.{0,80}\b(public|web|online|market|trends?|competitors?|vendor|company|requirements?|regulations?|rules?|ordinance|zoning|code)\b/i,
  /\b(public sources?|web sources?|online sources?)\b.{0,80}\b(say|show|indicate|confirm)\b/i,
  /\b(current|latest|up[- ]?to[- ]?date)\b.{0,80}\b(requirements?|regulations?|rules?|ordinance|zoning|code|market|trends?|competitors?)\b/i,
  /\b(PUD|planned unit development|zoning|ordinance|permit requirements?|municipal requirements?)\b/i,
  // Market / industry / economic conditions questions need live web data even
  // when phrased without an explicit "web"/"research" verb (e.g. "what's
  // happening in the construction market?"). Anchored on market/industry/
  // economy/commodity/named-material so internal project questions ("cost
  // trends on Westfield", "budget forecast") do NOT get sent to the web.
  /\b(what'?s|what is|how'?s|how is|hows|whats)\b.{0,55}\b(market|industry|economy|sector)\b/i,
  /\b(market|industry|economic|sector|commodity)\b.{0,25}\b(conditions?|outlook|forecast|trends?|landscape|news|update|rates?|pricing)\b/i,
  /\b(construction|commercial real estate|cre|housing|labor|material|commodity|steel|lumber|concrete|rebar|copper|aluminum|diesel|fuel|interest rate)s?\b.{0,30}\b(market|industry|trends?|prices?|pricing|outlook|forecast|index|nationally|economy|rates?)\b/i,
];

const APP_HELP_PATTERNS = [
  /\bhow do i\b/i,
  /\bwhere do i\b/i,
  /\bwhat button\b/i,
  /\bhelp me use\b/i,
  /\bin the app\b/i,
  /\b(where|how|what|why)\b.{0,60}\b(in|inside|within)\b.{0,20}\b(the )?(app|alleato pm|alleato os)\b/i,
  /\b(what table|which table|what route|which route|what page|which page)\b.{0,80}\b(app|feature|page|workflow|button|route|table|powers|backs)\b/i,
  /\b(is this|is that|can the app|does the app)\b.{0,80}\b(implemented|live|planned|available|built|supported)\b/i,
  /\bwhy can'?t i see\b/i,
  // Conceptual "what does this feature/field do / I don't understand it" help —
  // distinct from the UI-navigation phrasings above. Anchored on a confusion or
  // definition verb AND a feature/action object so data questions ("I don't
  // understand why we're over budget") are NOT stolen into app help.
  /\b(i (really |honestly )?(don'?t|dont|do not) (really |fully |quite )?understand|i'?m (really |so )?confused (about|by|on|with)|help me understand)\b.{0,80}\b(field|column|button|tab|section|toggle|setting|option|feature|page|screen|widget|dropdown|do|does|mean|means|work|works|used for|for)\b/i,
  /\bwhat (does|do|is|are)\b.{0,70}\b(field|column|button|tab|toggle|setting|option|feature|mean|means|stand for|used for|represent)\b/i,
  /\bwhat does\b.{0,70}\b(revenue source|funding source|cost source|income source|payment source|budget source|data source|line[- ]?item source)\b.{0,20}\bdo\b/i,
];

const OWNER_PORTFOLIO_BRIEFING_PATTERNS = [
  /\b(active jobs?|active projects?|across (all )?(jobs|projects)|portfolio|everything|business)\b/i,
  /\b(red flags?|watchlist|lose sleep|attention this week|rundown|catch me up|where everything stands|what should i focus|what should i personally handle|fires?)\b/i,
];

const OWNER_RISK_REVIEW_PATTERNS = [
  /\b(risks?|risk review|red flags?|watchlist|blockers?|issues?|concerns?)\b/i,
  /\b(worried|worry|nervous|bite us|could bite|blow up|burn us|go wrong|keep me up)\b/i,
];

const IMPLEMENTATION_PLANNING_PATTERNS = [
  /\b(systems?|processes?|workflows?|cadence|operating rhythm|guardrails?)\b.{0,80}\b(need|should|put in place|implement|build|create|recommend)\b/i,
  /\b(what|which)\b.{0,40}\b(systems?|processes?|workflows?|cadence|operating rhythm|guardrails?)\b.{0,80}\b(need|should|put in place)\b/i,
];

type IntentClassificationOptions = {
  selectedProjectId?: number | null;
};

function hasSelectedProjectContext(options?: IntentClassificationOptions): boolean {
  return typeof options?.selectedProjectId === "number";
}

function isProjectStatusBriefingPrompt(text: string): boolean {
  return (
    /\b(latest|status|update|current|what changed|briefing)\b/i.test(text) ||
    // Meeting review and insight requests need full packet retrieval, not narrow RAG.
    /\b(meeting insights?|review (recent )?meetings?|meeting summary|meeting summaries|recent meetings?|what (happened|came up|was discussed) in (the )?meeting)\b/i.test(text) ||
    OWNER_PORTFOLIO_BRIEFING_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function isExplicitSourceLookupPrompt(text: string): boolean {
  return EXPLICIT_SOURCE_LOOKUP_PATTERNS.some((pattern) => pattern.test(text));
}

export function classifyAssistantIntent(
  message: string,
  options?: IntentClassificationOptions,
): AssistantIntent {
  const text = message.trim();
  if (!text) return "general_conversation";

  if (FEEDBACK_WRITE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "feedback_write";
  }

  if (isPrimeContractSovWritePrompt(text)) {
    return "prime_contract_sov_write";
  }

  // task_write must be checked FIRST — before source_lookup, decision_lookup,
  // financial_analysis, and task_followup — because write triggers like
  // "Add a task for the PM to confirm the approval owner" contain keywords
  // (approval, meeting, budget) that match domain patterns. Write intent
  // must win: routing to any packet-first or retrieval path primes the model
  // for a reading pattern and causes it to describe the task in text instead
  // of calling createGeneratedTask.
  if (TASK_WRITE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "task_write";
  }

  // Checked before calendar_action: "send a Teams message … the meeting moved"
  // is a message send whose CONTENT mentions a meeting, and the calendar
  // patterns ("send … meeting") would otherwise steal it. Genuine calendar asks
  // ("create a Teams invite") don't match the message/chat/dm nouns here.
  if (TEAMS_MESSAGE_ACTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return "teams_message_action";
  }

  if (CALENDAR_ACTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return "calendar_action";
  }

  if (EMAIL_ACTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return "email_action";
  }

  if (
    CHANGE_EVENT_WRITE_PATTERNS.some((pattern) => pattern.test(text)) ||
    CHANGE_EVENT_FIELD_FOLLOWUP_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return "change_event_write";
  }

  if (EXTERNAL_RESEARCH_PATTERNS.some((pattern) => pattern.test(text))) {
    return "external_research";
  }

  if (APP_HELP_PATTERNS.some((pattern) => pattern.test(text))) {
    return "app_help";
  }

  if (isExplicitSourceLookupPrompt(text)) {
    return "source_lookup";
  }

  // With a pinned project, broad owner/status phrasing should stay on the
  // project-status path even when it asks for evidence, risks, or next actions.
  // Otherwise the source/task keyword checks steal Deep Agents-eligible
  // questions into narrower retrieval lanes.
  if (hasSelectedProjectContext(options) && isProjectStatusBriefingPrompt(text)) {
    return "latest_status";
  }

  if (
    SOURCE_LOOKUP_PATTERNS.some((pattern) => pattern.test(text)) ||
    (!DOMAIN_FIELD_SOURCE_PATTERN.test(text) &&
      SOURCE_WORD_LOOKUP_PATTERNS.some((pattern) => pattern.test(text)))
  ) {
    return "source_lookup";
  }

  if (/\b(change order|pco|cco|change management|change issue)\b/i.test(text)) {
    return "change_management_review";
  }

  if (/\b(financial|cost|budget|invoice|payment|paid|exposure|margin|overrun)\b/i.test(text)) {
    return "financial_analysis";
  }

  if (/\b(decision|decided|open question|approval|approve)\b/i.test(text)) {
    return "decision_lookup";
  }

  // task_followup is for READING existing tasks (list, status, overdue).
  // task_write (checked above) handles CREATING new task records.
  if (
    /\b(follow[- ]?up|missed|task|tasks|todo|to-do|next action|owner|action item|open item|on my plate|what do i need|what should i|what's open|what is open)\b/i.test(text) ||
    /\b(waiting on|waiting for|blocked by|held up by)\b/i.test(text) ||
    /\b(what are my|show me my|give me my)\b.{0,30}\b(tasks?|items?|actions?|todos?)\b/i.test(text)
  ) {
    return "task_followup";
  }

  if (OWNER_RISK_REVIEW_PATTERNS.some((pattern) => pattern.test(text))) {
    return "risk_review";
  }

  if (isProjectStatusBriefingPrompt(text)) {
    return "latest_status";
  }

  if (
    IMPLEMENTATION_PLANNING_PATTERNS.some((pattern) => pattern.test(text)) ||
    /\b(implement|build|plan|roadmap|steps)\b/i.test(text)
  ) {
    return "implementation_planning";
  }

  if (/\b(strategy|brainstorm|options|recommend)\b/i.test(text)) {
    return "strategy_brainstorm";
  }

  return "general_conversation";
}

export function shouldUsePacketFirstIntent(intent: AssistantIntent): boolean {
  // task_write is intentionally excluded: loading a project packet primes the
  // model for a reading/retrieval pattern and causes it to describe the task
  // in text rather than calling createGeneratedTask. Write intents go straight
  // to streamText so the MANDATORY TASK WRITE PROTOCOL in the system prompt
  // can take effect.
  // change_event_write is also excluded so source/evidence phrasing can be used
  // as field-filling context without hijacking the request into source lookup.
  return (
    intent === "target_briefing" ||
    intent === "latest_status" ||
    intent === "risk_review" ||
    intent === "financial_analysis" ||
    intent === "change_management_review" ||
    intent === "decision_lookup" ||
    intent === "task_followup" ||
    intent === "implementation_planning"
  );
}
