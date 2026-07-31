/**
 * Lightweight matcher that scores an inbox item against the learned
 * `project_attribution_rules`. This is the read-side mirror of the backend
 * ProjectAssigner's rule strategy — it lets the Assignment Inbox surface a
 * suggestion for items that have no `document_attribution_candidates` row
 * (notably emails), powered by the rules the learning loop creates from past
 * manual assignments.
 */

export type AttributionRuleType =
  | "domain"
  | "email"
  | "title_keyword"
  | "keyword"
  | "phrase";

export interface ActiveAttributionRule {
  projectId: number;
  ruleType: string;
  patternNormalized: string;
  confidence: number;
  priority: number;
}

export interface RuleMatchInput {
  fromEmail: string | null;
  title: string | null;
  bodyText?: string | null;
  participants?: string[] | null;
  relatedTitles?: string[] | null;
}

export interface RuleMatch {
  projectId: number;
  confidence: number;
  ruleType: string;
  pattern: string;
}

export interface RuleMatchEvidence {
  projectId: number;
  ruleType: string;
  pattern: string;
  matchedOn: "sender" | "participant" | "subject" | "content";
  score: number;
  detail: string;
}

export interface RankedProjectMatch {
  projectId: number;
  confidence: number;
  evidence: RuleMatchEvidence[];
}

export interface RuleSuggestion {
  status: "suggested" | "manual_review" | "undefined";
  suggestedProjectId: number | null;
  confidence: number | null;
  summary: string | null;
  confidenceReasons: string[];
  evidence: string[];
  topMatches: RankedProjectMatch[];
}

/** Precedence when multiple rule types match — lower wins (most specific first). */
const RULE_TYPE_RANK: Record<string, number> = {
  email: 0,
  domain: 1,
  phrase: 2,
  keyword: 3,
  title_keyword: 3,
};

const RULE_TYPE_BASE_SCORE: Record<string, number> = {
  email: 0.98,
  title_keyword: 0.9,
  phrase: 0.84,
  keyword: 0.72,
  domain: 0.58,
};

function ruleTypeRank(ruleType: string): number {
  return RULE_TYPE_RANK[ruleType] ?? 5;
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

function normalizeTitle(title: string): string {
  return ` ${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

function normalizeFreeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? ` ${normalized} ` : null;
}

function cleanSubject(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function extractAllEmails(values: Array<string | null | undefined>): string[] {
  const matches = values.flatMap((value) =>
    typeof value === "string"
      ? (value.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [])
      : [],
  );
  return unique(matches);
}

function describeMatchedOn(ruleType: string): RuleMatchEvidence["matchedOn"] {
  switch (ruleType) {
    case "email":
      return "participant";
    case "domain":
      return "participant";
    case "title_keyword":
      return "subject";
    case "keyword":
    case "phrase":
      return "content";
    default:
      return "content";
  }
}

function buildEvidenceDetail(
  ruleType: string,
  pattern: string,
  matchedOn: RuleMatchEvidence["matchedOn"],
): string {
  if (ruleType === "email") return `Participant email matched ${pattern}`;
  if (ruleType === "domain") return `Participant domain matched ${pattern}`;
  if (matchedOn === "subject") return `Subject history matched ${pattern}`;
  return `Thread content matched ${pattern}`;
}

function scoreRule(rule: ActiveAttributionRule, occurrenceCount: number): number {
  const base = RULE_TYPE_BASE_SCORE[rule.ruleType] ?? 0.55;
  const densityBonus = Math.min(0.09, Math.max(0, occurrenceCount - 1) * 0.03);
  return Math.min(0.99, base * Math.max(rule.confidence, 0.35) + densityBonus);
}

function buildRuleEvidence(
  rule: ActiveAttributionRule,
  emailSet: Set<string>,
  domainSet: Set<string>,
  normalizedSubjects: string[],
  normalizedContent: string | null,
): RuleMatchEvidence | null {
  const pattern = rule.patternNormalized;
  if (!pattern) return null;

  if (rule.ruleType === "email" && emailSet.has(pattern)) {
    return {
      projectId: rule.projectId,
      ruleType: rule.ruleType,
      pattern,
      matchedOn: "participant",
      score: scoreRule(rule, 1),
      detail: buildEvidenceDetail(rule.ruleType, pattern, "participant"),
    };
  }

  if (rule.ruleType === "domain" && domainSet.has(pattern)) {
    return {
      projectId: rule.projectId,
      ruleType: rule.ruleType,
      pattern,
      matchedOn: "participant",
      score: scoreRule(rule, 1),
      detail: buildEvidenceDetail(rule.ruleType, pattern, "participant"),
    };
  }

  if (rule.ruleType === "title_keyword") {
    const subjectHits = normalizedSubjects.filter((subject) =>
      subject.includes(` ${pattern} `),
    ).length;
    if (subjectHits > 0) {
      return {
        projectId: rule.projectId,
        ruleType: rule.ruleType,
        pattern,
        matchedOn: "subject",
        score: scoreRule(rule, subjectHits),
        detail: buildEvidenceDetail(rule.ruleType, pattern, "subject"),
      };
    }
    return null;
  }

  if (rule.ruleType === "keyword" || rule.ruleType === "phrase") {
    if (normalizedContent?.includes(` ${pattern} `)) {
      const hits = normalizedContent.split(` ${pattern} `).length - 1;
      return {
        projectId: rule.projectId,
        ruleType: rule.ruleType,
        pattern,
        matchedOn: describeMatchedOn(rule.ruleType),
        score: scoreRule(rule, hits),
        detail: buildEvidenceDetail(rule.ruleType, pattern, describeMatchedOn(rule.ruleType)),
      };
    }
  }

  return null;
}

function sortEvidence(a: RuleMatchEvidence, b: RuleMatchEvidence): number {
  const rankDelta = ruleTypeRank(a.ruleType) - ruleTypeRank(b.ruleType);
  if (rankDelta !== 0) return rankDelta;
  return b.score - a.score;
}

export function buildRuleSuggestion(
  input: RuleMatchInput,
  rules: ActiveAttributionRule[],
): RuleSuggestion {
  if (rules.length === 0) {
    return {
      status: "undefined",
      suggestedProjectId: null,
      confidence: null,
      summary: "No attribution rules are available yet.",
      confidenceReasons: ["Manual review required until the system has learned project signals."],
      evidence: [],
      topMatches: [],
    };
  }

  const cleanedTitle = cleanSubject(input.title);
  const relatedTitles = (input.relatedTitles ?? []).map(cleanSubject).filter(Boolean) as string[];
  const normalizedSubjects = unique(
    [cleanedTitle, ...relatedTitles].filter(Boolean).map((title) => normalizeTitle(title!)),
  );
  const normalizedBody = normalizeFreeText(input.bodyText);
  const normalizedContent = [normalizedBody, ...normalizedSubjects]
    .filter(Boolean)
    .join(" ")
    .trim() || null;

  const participantEmails = extractAllEmails([
    input.fromEmail,
    ...(input.participants ?? []),
  ]);
  const participantDomains = unique(
    participantEmails
      .map((email) => extractEmailDomain(email))
      .filter((domain): domain is string => Boolean(domain)),
  );

  const emailSet = new Set(participantEmails);
  const domainSet = new Set(participantDomains);

  const evidenceByProject = new Map<number, RuleMatchEvidence[]>();
  for (const rule of rules) {
    const evidence = buildRuleEvidence(
      rule,
      emailSet,
      domainSet,
      normalizedSubjects,
      normalizedContent,
    );
    if (!evidence) continue;
    const existing = evidenceByProject.get(rule.projectId) ?? [];
    existing.push(evidence);
    evidenceByProject.set(rule.projectId, existing);
  }

  const topMatches: RankedProjectMatch[] = [...evidenceByProject.entries()]
    .map(([projectId, evidence]) => {
      const sortedEvidence = [...evidence].sort(sortEvidence);
      const topScore = sortedEvidence[0]?.score ?? 0;
      const bonus = Math.min(0.08, Math.max(0, sortedEvidence.length - 1) * 0.02);
      return {
        projectId,
        confidence: Math.min(0.99, topScore + bonus),
        evidence: sortedEvidence,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  if (topMatches.length === 0) {
    return {
      status: "undefined",
      suggestedProjectId: null,
      confidence: null,
      summary: "Undefined - no project signal found in the chain.",
      confidenceReasons: ["No learned project term, participant email, or content signal matched this thread."],
      evidence: [],
      topMatches: [],
    };
  }

  const best = topMatches[0];
  const second = topMatches[1] ?? null;
  const bestEvidence = best.evidence[0];
  const competingDomainOnly =
    topMatches.length > 1 &&
    topMatches.every((match) => match.evidence.every((item) => item.ruleType === "domain"));
  const confidenceGap = best.confidence - (second?.confidence ?? 0);
  const hasStrongDirectSignal = best.evidence.some((item) =>
    item.ruleType === "email" || item.ruleType === "title_keyword" || item.ruleType === "phrase",
  );
  const domainOnly = best.evidence.every((item) => item.ruleType === "domain");

  const evidence = best.evidence.slice(0, 3).map((item) => item.detail);

  if (competingDomainOnly || domainOnly || confidenceGap < 0.12 || (!hasStrongDirectSignal && best.confidence < 0.85)) {
    const reasons = [];
    if (competingDomainOnly || domainOnly) {
      reasons.push("Shared subcontractor/domain evidence is not project-unique.");
    }
    if (confidenceGap < 0.12 && second) {
      reasons.push("Multiple projects scored too closely to auto-assign safely.");
    }
    if (!hasStrongDirectSignal) {
      reasons.push("No direct email or clear subject-history signal anchored the thread.");
    }
    return {
      status: "manual_review",
      suggestedProjectId: null,
      confidence: best.confidence,
      summary: "Manual review - chain signals are not unique enough to auto-suggest.",
      confidenceReasons: reasons,
      evidence,
      topMatches,
    };
  }

  return {
    status: "suggested",
    suggestedProjectId: best.projectId,
    confidence: best.confidence,
    summary: bestEvidence ? bestEvidence.detail : "Matched learned project signals from the thread.",
    confidenceReasons: [
      "Project signals stayed consistent across the thread.",
      ...(second && confidenceGap >= 0.12
        ? ["The nearest competing project scored materially lower."]
        : []),
    ],
    evidence,
    topMatches,
  };
}

function ruleMatchesInput(
  rule: ActiveAttributionRule,
  email: string | null,
  domain: string | null,
  normalizedTitle: string | null,
): boolean {
  const pattern = rule.patternNormalized;
  if (!pattern) return false;

  switch (rule.ruleType) {
    case "email":
      return email != null && email === pattern;
    case "domain":
      return domain != null && domain === pattern;
    case "title_keyword":
    case "keyword":
    case "phrase":
      return normalizedTitle != null && normalizedTitle.includes(` ${pattern} `);
    default:
      return false;
  }
}

/**
 * Returns the best matching rule for an item, or null. "Best" = most specific
 * rule type, then highest priority (lowest value), then highest confidence.
 */
export function matchAttributionRule(
  input: RuleMatchInput,
  rules: ActiveAttributionRule[],
): RuleMatch | null {
  if (rules.length === 0) return null;

  const email = input.fromEmail?.trim().toLowerCase() || null;
  const domain = extractEmailDomain(email);
  const normalizedTitle = input.title ? normalizeTitle(input.title) : null;

  let best: ActiveAttributionRule | null = null;
  for (const rule of rules) {
    if (!ruleMatchesInput(rule, email, domain, normalizedTitle)) continue;
    if (best == null) {
      best = rule;
      continue;
    }
    const rankDelta = ruleTypeRank(rule.ruleType) - ruleTypeRank(best.ruleType);
    if (rankDelta < 0) {
      best = rule;
    } else if (rankDelta === 0) {
      if (rule.priority < best.priority) best = rule;
      else if (rule.priority === best.priority && rule.confidence > best.confidence) {
        best = rule;
      }
    }
  }

  if (!best) return null;
  return {
    projectId: best.projectId,
    confidence: best.confidence,
    ruleType: best.ruleType,
    pattern: best.patternNormalized,
  };
}
