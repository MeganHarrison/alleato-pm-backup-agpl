import type {
  BrandonBriefItem,
  BrandonDailyUpdatePacket,
  ExecutiveOperatingBrief,
} from "@/lib/executive/brandon-daily-update";

export type ExecutiveBriefReferenceEvalCheck = {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  details: string;
};

export type ExecutiveBriefReferenceEvalResult = {
  passed: boolean;
  score: number;
  maxScore: number;
  threshold: number;
  checks: ExecutiveBriefReferenceEvalCheck[];
  failedCheckIds: string[];
};

export type ExecutiveBriefReferenceEvalCriteria = {
  minCoreItems: number;
  minDistinctProjects: number;
  minMeetingBackedItemsWhenMeetingsLoaded: number;
  minMeetingCoverageForTranscriptExpectation: number;
  minEmergingPatterns: number;
  minPatternSignalGroups: number;
  requiredHealthAreas: string[];
  minLeadershipWatchlistItems: number;
  minActionableItemRatio: number;
  maxRepeatedTopicMentions: number;
  highSourceCoverageCount: number;
  highMeetingCoverageCount: number;
  passThreshold: number;
};

export const EXECUTIVE_BRIEF_REFERENCE_EVAL_CRITERIA: ExecutiveBriefReferenceEvalCriteria =
  {
    minCoreItems: 6,
    minDistinctProjects: 4,
    minMeetingBackedItemsWhenMeetingsLoaded: 4,
    minMeetingCoverageForTranscriptExpectation: 5,
    minEmergingPatterns: 2,
    minPatternSignalGroups: 2,
    requiredHealthAreas: ["Projects", "Finance", "Operations"],
    minLeadershipWatchlistItems: 4,
    minActionableItemRatio: 0.75,
    maxRepeatedTopicMentions: 2,
    highSourceCoverageCount: 50,
    highMeetingCoverageCount: 10,
    passThreshold: 80,
  };

const GENERIC_PROJECT_LABELS = new Set([
  "",
  "no project linked",
  "multiple",
  "multiple projects",
  "company-wide",
  "company wide",
  "alleato finance",
]);

const PATTERN_SIGNAL_GROUPS = [
  {
    id: "operating-system-standardization",
    terms: [
      "standardiz",
      "repeatable",
      "workflow",
      "process",
      "building connected",
      "documented communication",
    ],
  },
  {
    id: "external-dependency-risk",
    terms: [
      "external",
      "permit",
      "vendor",
      "subcontractor",
      "partner",
      "manpower",
      "material",
      "equipment",
    ],
  },
  {
    id: "financial-operating-rhythm",
    terms: [
      "wip",
      "reconciliation",
      "payroll",
      "ap",
      "ar",
      "reporting cadence",
      "working capital",
    ],
  },
  {
    id: "ai-systems-strategy",
    terms: [
      "ai operating system",
      "api",
      "integration",
      "bidirectional",
      "software evaluation",
      "technology",
    ],
  },
];

function allCoreItems(packet: BrandonDailyUpdatePacket): BrandonBriefItem[] {
  return [
    ...packet.sections.needsBrandon,
    ...packet.sections.waitingOnOthers,
    ...packet.sections.importantUpdates,
  ];
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasUsableText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function meetingCoverageCount(packet: BrandonDailyUpdatePacket): number {
  return (
    packet.sourceCoverage.find((coverage) => coverage.label === "Meeting")
      ?.count ?? 0
  );
}

function totalSourceCoverageCount(packet: BrandonDailyUpdatePacket): number {
  return packet.sourceCoverage.reduce(
    (total, coverage) => total + coverage.count,
    0,
  );
}

function isMeetingBacked(item: BrandonBriefItem): boolean {
  return (
    item.source === "Meeting" ||
    item.citations.some((citation) => citation.source === "Meeting")
  );
}

function distinctProjectLabels(items: BrandonBriefItem[]): string[] {
  const labels = new Set<string>();
  for (const item of items) {
    const label = item.project.trim();
    const normalized = normalizeText(label).replace(/\s*\([^)]*\)\s*$/, "");
    if (!GENERIC_PROJECT_LABELS.has(normalized)) labels.add(label);
  }
  return [...labels].sort((left, right) => left.localeCompare(right));
}

function pushText(parts: string[], value: unknown) {
  if (typeof value === "string" && value.trim()) parts.push(value);
}

function collectOperatingBriefText(
  operatingBrief: ExecutiveOperatingBrief | undefined,
): string {
  const parts: string[] = [];
  if (!operatingBrief) return "";

  for (const item of operatingBrief.startHere) pushText(parts, item);
  for (const item of operatingBrief.importantBusinessSignals)
    pushText(parts, item);
  for (const item of operatingBrief.recommendedMoves) pushText(parts, item);
  for (const item of operatingBrief.opportunities ?? []) pushText(parts, item);
  for (const item of operatingBrief.leadershipWatchlist ?? [])
    pushText(parts, item);
  for (const item of operatingBrief.chiefOfStaffInsights ?? [])
    pushText(parts, item);

  for (const item of operatingBrief.businessHealth ?? []) {
    pushText(parts, item.area);
    pushText(parts, item.summary);
  }
  for (const item of operatingBrief.emergingPatterns ?? []) {
    pushText(parts, item.title);
    pushText(parts, item.significance);
    for (const evidence of item.evidence) pushText(parts, evidence);
  }
  for (const item of operatingBrief.strategicRisks ?? []) {
    pushText(parts, item.title);
    pushText(parts, item.impact);
    pushText(parts, item.nextAction);
  }

  return normalizeText(parts.join(" "));
}

function patternSignalGroupCount(packet: BrandonDailyUpdatePacket): number {
  const text = collectOperatingBriefText(packet.operatingBrief);
  return PATTERN_SIGNAL_GROUPS.filter((group) =>
    group.terms.some((term) => text.includes(term)),
  ).length;
}

function normalizedTopicKey(value: string): string {
  return normalizeText(value)
    .replace(/\$[\d,.]+[km]?\b/g, "money")
    .replace(/\b\d+(\.\d+)?\b/g, "number")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(pending|open|awaiting|approval|approvals|cos|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function financialAggregateTopicKey(value: string): string | null {
  const normalized = normalizeText(value);
  if (
    !/\$?422k\b/.test(normalized) &&
    !normalized.includes("pending co") &&
    !normalized.includes("pending change order") &&
    !normalized.includes("on-hold change order") &&
    !normalized.includes("on hold change order")
  ) {
    return null;
  }
  return normalizedTopicKey(value);
}

function collectTopicTitles(packet: BrandonDailyUpdatePacket): string[] {
  const titles = allCoreItems(packet).map((item) => item.title);
  const operatingBrief = packet.operatingBrief;
  if (!operatingBrief) return titles;

  for (const item of operatingBrief.projectRiskRadar)
    titles.push(item.item.title);
  for (const item of operatingBrief.cashAndMarginWatch)
    titles.push(item.item.title);
  for (const item of operatingBrief.peopleAndAccountability)
    titles.push(item.item.title);
  for (const item of operatingBrief.lowerPriorityMomentum)
    titles.push(item.item.title);
  for (const item of operatingBrief.strategicRisks ?? []) titles.push(item.title);
  for (const item of operatingBrief.businessHealth ?? [])
    titles.push(item.summary);
  for (const item of operatingBrief.leadershipWatchlist ?? []) titles.push(item);

  return titles;
}

function maxRepeatedTopicMentionCount(packet: BrandonDailyUpdatePacket): number {
  const counts = new Map<string, number>();
  for (const title of collectTopicTitles(packet)) {
    const key = financialAggregateTopicKey(title);
    if (!key) continue;
    if (key.length < 12) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

function actionableItemRatio(items: BrandonBriefItem[]): number {
  if (items.length === 0) return 0;
  const actionableCount = items.filter(
    (item) =>
      hasUsableText(item.whyItMatters) &&
      hasUsableText(item.recommendedAction),
  ).length;
  return actionableCount / items.length;
}

function degradedWarningPresent(packet: BrandonDailyUpdatePacket): boolean {
  const text = normalizeText(packet.retrievalNotes.join(" "));
  return (
    text.includes("thin") ||
    text.includes("degraded") ||
    text.includes("source coverage") ||
    text.includes("collapsed")
  );
}

function check(
  id: string,
  label: string,
  passed: boolean,
  maxPoints: number,
  details: string,
): ExecutiveBriefReferenceEvalCheck {
  return {
    id,
    label,
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    details,
  };
}

export function evaluateExecutiveBriefAgainstReference(
  packet: BrandonDailyUpdatePacket,
  criteria = EXECUTIVE_BRIEF_REFERENCE_EVAL_CRITERIA,
): ExecutiveBriefReferenceEvalResult {
  const items = allCoreItems(packet);
  const projects = distinctProjectLabels(items);
  const meetingCoverage = meetingCoverageCount(packet);
  const meetingBackedItems = items.filter(isMeetingBacked).length;
  const operatingBrief = packet.operatingBrief;
  const emergingPatternCount = operatingBrief?.emergingPatterns?.length ?? 0;
  const patternGroups = patternSignalGroupCount(packet);
  const healthAreas = new Set(
    (operatingBrief?.businessHealth ?? []).map((item) =>
      normalizeText(item.area),
    ),
  );
  const missingHealthAreas = criteria.requiredHealthAreas.filter(
    (area) => !healthAreas.has(normalizeText(area)),
  );
  const watchlistCount = operatingBrief?.leadershipWatchlist?.length ?? 0;
  const hasChiefOfStaffInsight =
    (operatingBrief?.chiefOfStaffInsights ?? []).filter(hasUsableText).length >
    0;
  const actionRatio = actionableItemRatio(items);
  const repeatedTopicMentions = maxRepeatedTopicMentionCount(packet);
  const highCoverage =
    totalSourceCoverageCount(packet) >= criteria.highSourceCoverageCount ||
    meetingCoverage >= criteria.highMeetingCoverageCount;
  const thinWithHighCoverage =
    highCoverage && items.length < criteria.minCoreItems;

  const checks = [
    check(
      "source-breadth",
      "Brief uses enough source breadth to be executive-useful",
      items.length >= criteria.minCoreItems &&
        projects.length >= criteria.minDistinctProjects,
      20,
      `${items.length} core items across ${projects.length} distinct project/context labels: ${projects.join(", ") || "none"}.`,
    ),
    check(
      "meeting-backed-synthesis",
      "Meeting transcripts drive the synthesis when loaded",
      meetingCoverage < criteria.minMeetingCoverageForTranscriptExpectation ||
        meetingBackedItems >= criteria.minMeetingBackedItemsWhenMeetingsLoaded,
      15,
      `${meetingBackedItems} meeting-backed items with ${meetingCoverage} meeting sources loaded.`,
    ),
    check(
      "cross-meeting-patterns",
      "Emerging Patterns contains real cross-meeting synthesis",
      emergingPatternCount >= criteria.minEmergingPatterns &&
        patternGroups >= criteria.minPatternSignalGroups,
      20,
      `${emergingPatternCount} emerging patterns and ${patternGroups} reference signal groups detected.`,
    ),
    check(
      "operating-brief-shape",
      "Packet includes business health, watchlist, and chief-of-staff insight",
      missingHealthAreas.length === 0 &&
        watchlistCount >= criteria.minLeadershipWatchlistItems &&
        hasChiefOfStaffInsight,
      15,
      `Missing health areas: ${missingHealthAreas.join(", ") || "none"}; watchlist items: ${watchlistCount}; chief insights: ${hasChiefOfStaffInsight ? "present" : "missing"}.`,
    ),
    check(
      "actionability",
      "Core items explain why they matter and the next move",
      actionRatio >= criteria.minActionableItemRatio,
      15,
      `${Math.round(actionRatio * 100)}% of core items include both why-it-matters and a recommended action.`,
    ),
    check(
      "topic-duplication",
      "One repeated financial topic does not dominate the packet",
      repeatedTopicMentions <= criteria.maxRepeatedTopicMentions,
      10,
      `Most repeated normalized topic appears ${repeatedTopicMentions} times; limit is ${criteria.maxRepeatedTopicMentions}.`,
    ),
    check(
      "fail-loudly-on-thin-high-coverage",
      "High source coverage cannot silently produce a thin brief",
      !thinWithHighCoverage || degradedWarningPresent(packet),
      5,
      thinWithHighCoverage
        ? `High source coverage produced ${items.length} items; degraded warning is ${degradedWarningPresent(packet) ? "present" : "missing"}.`
        : `Coverage/item count does not require a degraded warning (${items.length} items).`,
    ),
  ];

  const score = checks.reduce((total, item) => total + item.points, 0);
  const maxScore = checks.reduce((total, item) => total + item.maxPoints, 0);
  const failedCheckIds = checks
    .filter((item) => !item.passed)
    .map((item) => item.id);

  return {
    passed: score >= criteria.passThreshold && failedCheckIds.length === 0,
    score,
    maxScore,
    threshold: criteria.passThreshold,
    checks,
    failedCheckIds,
  };
}

export function formatExecutiveBriefReferenceEvalReport(
  result: ExecutiveBriefReferenceEvalResult,
): string {
  const status = result.passed ? "PASS" : "FAIL";
  const lines = [
    `${status} executive brief reference eval: ${result.score}/${result.maxScore} points (threshold ${result.threshold}).`,
  ];

  for (const checkResult of result.checks) {
    const checkStatus = checkResult.passed ? "PASS" : "FAIL";
    lines.push(`${checkStatus} ${checkResult.id}: ${checkResult.details}`);
  }

  return lines.join("\n");
}
