export type SignedInBriefIdentity = {
  isBrandon: boolean;
  profileName: string | null;
  profileEmail: string | null;
  personName: string | null;
  personEmail: string | null;
};

export function isDailyBriefCritiqueRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  const mentionsBrief = [
    "daily brief",
    "daily briefing",
    "daily update",
    "executive brief",
    "executive briefing",
    "brandon daily update",
  ].some((phrase) => normalized.includes(phrase));

  if (!mentionsBrief) return false;

  return [
    "format",
    "structured",
    "structure",
    "confusing",
    "not clear",
    "unclear",
    "hard to read",
    "what do you think",
    "what needs to change",
    "how should this change",
    "improve",
    "redesign",
  ].some((phrase) => normalized.includes(phrase));
}

export function isPersonalDailyBriefRequest(message: string): boolean {
  if (isDailyBriefCritiqueRequest(message)) return false;

  const normalized = message.toLowerCase();
  const asksForBrief = [
    "daily brief",
    "daily briefing",
    "daily update",
    "morning brief",
    "morning update",
    "what needs my attention",
    "what should i know today",
  ].some((phrase) => normalized.includes(phrase));

  if (!asksForBrief) return false;

  return /\b(my|me|i|today|morning)\b/i.test(normalized);
}

export function isExecutiveBriefingMetadataQuestion(message: string): boolean {
  const normalized = message.toLowerCase();
  const asksAboutTiming = [
    "when was",
    "what time",
    "when did",
    "how old",
    "is this current",
    "is this daily",
    "is this briefing",
    "is this brief",
    "is this report",
    "is it current",
  ].some((phrase) => normalized.includes(phrase));

  if (!asksAboutTiming) return false;

  const mentionsBrief = [
    "this",
    "briefing",
    "brief",
    "report",
    "daily update",
    "daily operating brief",
    "executive brief",
    "regenerated",
    "generated",
    "approved",
    "sent",
  ].some((phrase) => normalized.includes(phrase));

  return mentionsBrief;
}

/**
 * True when the user explicitly wants live, multi-source deep research (which
 * justifies the slow Deep Agents pipeline) rather than the precomputed
 * deep-read packet. Used to let a "dig deeper" request bypass the fast route.
 */
export function wantsDeepAgentResearchOverride(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    "dig deeper",
    "deep dive",
    "deep-dive",
    "dig into",
    "go deeper",
    "research",
    "investigate",
    "look into",
    "cross-reference",
    "cross reference",
    "root cause",
    "why exactly",
    "search the web",
    "web search",
    "on the web",
    "google",
    "fresh analysis",
    "full analysis",
    "detailed analysis",
    "re-run the research",
    "run the research",
  ].some((phrase) => normalized.includes(phrase));
}

/**
 * True for portfolio-wide "what are the risks / issues / status / what's going
 * on" questions. These are already answered by the precomputed Daily Executive
 * Brief packet (the deep-read synthesis), so they can be served instantly
 * instead of spinning up the ~24s Deep Agents multi-agent pipeline to
 * reconstruct the same answer. `wantsDeepAgentResearchOverride` opts back into
 * the slow path on explicit request.
 */
export function isPortfolioStatusRiskQuestion(message: string): boolean {
  const normalized = message.toLowerCase();

  const asksStatusOrRisk = [
    "risk",
    "risks",
    "issue",
    "issues",
    "problem",
    "problems",
    "blocker",
    "blockers",
    "concern",
    "concerns",
    "what's going on",
    "whats going on",
    "what is going on",
    "what should i worry",
    "what do i need to worry",
    "what needs attention",
    "needs my attention",
    "status",
    "how are things",
    "state of things",
    "what's happening",
    "whats happening",
    "brief me",
    "catch me up",
    "anything i should know",
    "fires",
    "on fire",
  ].some((phrase) => normalized.includes(phrase));

  if (!asksStatusOrRisk) return false;

  const portfolioScoped = [
    "project",
    "projects",
    "portfolio",
    "across",
    "our projects",
    "current projects",
    "all projects",
    "everything",
    "the business",
    "company",
    "company-wide",
    "overall",
    "right now",
  ].some((phrase) => normalized.includes(phrase));

  return portfolioScoped;
}

export function isDailyDeepReadPacketQuestion(message: string): boolean {
  const normalized = message.toLowerCase();
  const directDailyDeepRead = [
    "daily deep read",
    "deep read packet",
    "source of truth for the daily brief",
    "daily executive brief source of truth",
    "latest daily deep read setup",
    "current executive brief candidates",
  ].some((phrase) => normalized.includes(phrase));

  if (directDailyDeepRead) return true;

  const mentionsPacketOrBrief = [
    "daily brief",
    "daily briefing",
    "executive brief",
    "executive briefing",
    "project intelligence",
    "intelligence packet",
  ].some((phrase) => normalized.includes(phrase));

  if (!mentionsPacketOrBrief) return false;

  return [
    "full-source",
    "full source",
    "entire transcript",
    "entire transcripts",
    "raw rag chunks",
    "rag chunks",
    "review-gated",
    "review gated",
    "candidate tasks",
    "task candidates",
    "risk candidates",
    "decision candidates",
  ].some((phrase) => normalized.includes(phrase));
}

export function isPersonalTaskRegisterRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  if (isPersonalDailyBriefRequest(message)) return false;

  const directPhrases = [
    "what are my tasks",
    "what're my tasks",
    "my tasks",
    "my task list",
    "my to-do",
    "my todo",
    "todo list",
    "to-do list",
    "what do i need to do",
    "what do i need to handle",
    "what am i supposed to do",
    "what is on my plate",
    "what's on my plate",
    "tasks assigned to me",
    "open tasks for me",
    "what am i behind on",
    "what do i owe",
    "pending against my name",
    "pending under my name",
    "due tomorrow on my side",
    "due today on my side",
    "what's due on my side",
    // "what's on my list" / "what is on my list"
    "what's on my list",
    "what is on my list",
    "on my list",
    // "my action items" / "list of action items"
    "my action items",
    "my action item",
    "list of action items",
    // "what am i supposed to follow up on"
    "supposed to follow up",
    "what am i following up on",
    "what do i need to follow up",
    // "what's pending on my end" / "what's pending for me"
    "pending on my end",
    "pending for me",
    // "what do i need to action"
    "need to action",
    // "what am i supposed to handle"
    "supposed to handle",
    // "what's still open on my side"
    "open on my side",
    // "any open loops"
    "open loops",
    // "what am i sitting on"
    "what am i sitting on",
    // colloquial: "what do i have on my plate"
    "on my plate",
  ];
  if (directPhrases.some((phrase) => normalized.includes(phrase))) return true;

  // "pull up my <task synonym>" / "show me my real <task synonym>"
  if (/\b(pull up|show(?:\s+me)?|bring up|open up|list|give me)\s+(my|the)\s+(?:real\s+|actual\s+)?(task list|todo list|to-do list|tasks|todos|to-dos|action items)\b/.test(normalized)) {
    return true;
  }

  // "show me everything pending against my name" / "everything still open under my name"
  if (/\b(everything|all)\s+(still\s+)?(pending|open|outstanding)\b.*\b(my|me|mine)\b/.test(normalized)) {
    return true;
  }

  // "what's on my list [of action items / this week / today]"
  if (/what['']?s?\s+(on\s+)?my\s+list\b/.test(normalized)) {
    return true;
  }

  // "what [do i / am i] [need to / have to] [do / handle / action / get done] today/this week"
  if (/\bwhat\s+(do\s+i|am\s+i)\s+(need\s+to|have\s+to|supposed\s+to)\s+(do|handle|action|get\s+done)\b/.test(normalized)) {
    return true;
  }

  return false;
}

export function identityLooksLikeBrandon(
  identity: Omit<SignedInBriefIdentity, "isBrandon">,
): boolean {
  const haystack = [
    identity.profileName,
    identity.profileEmail,
    identity.personName,
    identity.personEmail,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return /\bbrandon\b/.test(haystack);
}
