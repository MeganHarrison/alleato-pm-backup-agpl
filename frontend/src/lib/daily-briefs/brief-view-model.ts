import type { BriefV3 } from "./brief-v3-types";
import type { CanonicalDailyBriefPacket } from "./canonical-packets";

// ─────────────────────────────────────────────────────────────────────────────
// Executive Brief view model
//
// Transforms the canonical daily-executive-brief packet (markdown sections in
// `packet.sectionMap`, plus source-coverage counts) into the structured shape
// the bespoke "Daily Executive Brief" layout renders. This is a pure, testable
// transform — no IO, no fabrication. Sections with no supporting data collapse
// to empty arrays so the page can hide them rather than invent content.
// ─────────────────────────────────────────────────────────────────────────────

/** Who the brief is addressed to in the masthead flag. */
export const EXECUTIVE_BRIEF_PREPARED_FOR = "Brandon";

export type BriefSeverity = "critical" | "amber" | "info" | "positive";

/** One run of inline text; `bold` marks a `**...**` span for emphasis styling. */
export interface InlineSegment {
  text: string;
  bold: boolean;
}

export interface TemperaturePill {
  label: string;
  emphasis: string | null;
  tone: "critical" | "amber" | "positive";
}

export interface ReadItem {
  eyebrow: string;
  tone: BriefSeverity;
  body: InlineSegment[];
}

export interface DecisionSource {
  title: string;
  url: string | null;
  lane: string;
}

export interface DecisionItem {
  reference: string | null;
  title: string;
  body: InlineSegment[];
  context: InlineSegment[];
  badge: string;
  severity: BriefSeverity;
  due: { label: string; value: string | null } | null;
  sourceRefs: DecisionSource[];
}

export type BriefNarrativeKind =
  | "assessment"
  | "change"
  | "portfolio"
  | "action"
  | "risk"
  | "system"
  | "opportunity"
  | "evidence"
  | "analysis";

/** A persisted report section, kept intact for citation-aware rendering. */
export interface BriefNarrativeSection {
  id: string;
  title: string;
  body: string;
  kind: BriefNarrativeKind;
}

export interface MoneyStat {
  label: string;
  figure: string;
  tag: string;
  severity: BriefSeverity;
  body: InlineSegment[];
}

export interface OperationRow {
  title: string;
  body: InlineSegment[];
  tag: string;
  severity: BriefSeverity;
}

export interface ProjectCard {
  name: string;
  subtitle: string | null;
  pill: string;
  severity: BriefSeverity;
  body: InlineSegment[];
  figures: { label: InlineSegment[] }[];
}

/**
 * A prevention finding rendered as an actionable fix rather than just a problem.
 * The model already produces `missingControl` / `recommendedSystem` for every
 * finding; before this existed the view model dropped them and the reader only
 * ever saw the problem.
 */
export interface RecommendedSystemItem {
  id: string;
  /** The problem, stated once. */
  title: string;
  severity: BriefSeverity;
  /** The control that is absent today. */
  missingControl: string;
  /** The durable system that would prevent recurrence. */
  recommendedSystem: string;
  /** Null when the model could not attribute ownership — render nothing, never a dash. */
  accountableRole: string | null;
  /** Null when unknown — render nothing. */
  leadingIndicator: string | null;
}

export interface ExecutiveBriefViewModel {
  weekday: string;
  dateLabel: string;
  preparedFor: string;
  sourceWindowLabel: string;
  counts: {
    meetings: number;
    emails: number;
    teams: number;
    documents: number;
  };
  filteredCount: number | null;
  asOfLabel: string | null;
  thesis: string | null;
  temperature: TemperaturePill[];
  read: {
    lead: InlineSegment[];
    supporting: InlineSegment[][];
    items: ReadItem[];
  };
  decisions: DecisionItem[];
  money: MoneyStat[];
  operations: OperationRow[];
  projects: ProjectCard[];
  recommendedSystems: RecommendedSystemItem[];
  narrativeSections: BriefNarrativeSection[];
}

// ── parsing primitives ──────────────────────────────────────────────────────

/** Remove trailing/inline citation tokens like `[01KWC…]` or `[outlook_…, teamsdm_…]`. */
export function stripCitations(input: string): string {
  return input
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Split a string containing `**bold**` markers into inline segments. */
export function parseInline(input: string): InlineSegment[] {
  const clean = stripCitations(input);
  if (!clean) return [];
  const segments: InlineSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: clean.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < clean.length) {
    segments.push({ text: clean.slice(lastIndex), bold: false });
  }
  return segments.filter((segment) => segment.text.length > 0);
}

/** Flatten inline segments back to plain text (used for thesis + keyword scans). */
export function segmentsToText(segments: InlineSegment[]): string {
  return segments
    .map((segment) => segment.text)
    .join("")
    .trim();
}

/** Citation-free, marker-free text for headings/labels rendered as plain strings. */
export function plainText(input: string): string {
  return stripCitations(input).replace(/\*\*/g, "").trim();
}

/** Top-level markdown bullets (`- …`), ignoring indented sub-bullets. */
export function topLevelBullets(body: string): string[] {
  return body
    .split(/\r?\n/)
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter(Boolean);
}

/** Split a bullet like `**Lead sentence.** Rest of the detail` into lead + rest. */
export function splitLeadRest(bullet: string): {
  lead: string | null;
  rest: string;
} {
  const match = bullet.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
  if (match) {
    return {
      lead: match[1].replace(/[.:]\s*$/, "").trim(),
      rest: match[2].trim(),
    };
  }
  return { lead: null, rest: bullet.trim() };
}

const CRITICAL_WORDS =
  /\b(now|today|immediately|failure mode|escalat\w*|idle|blocked|behind|overdue|urgent|stop)\b/i;
const POSITIVE_WORDS =
  /\b(improv\w*|awarded|resolved|processed|received|complete\w*|approved|on track|locked|confirmed)\b/i;
const AMBER_WORDS =
  /\b(due|pending|watch|thin|risk\w*|slip\w*|delay\w*|hold|awaits?|by \d|on hold|standby|unresolved|outstanding)\b/i;

/** Classify a snippet into a design severity from keyword signals + due dates. */
export function classifySeverity(text: string): BriefSeverity {
  if (CRITICAL_WORDS.test(text)) return "critical";
  if (POSITIVE_WORDS.test(text) && !AMBER_WORDS.test(text)) return "positive";
  if (AMBER_WORDS.test(text) || /\b\d{1,2}\/\d{1,2}\b/.test(text))
    return "amber";
  return "info";
}

/** First `M/D` style date token in the text, if any. */
export function detectDate(text: string): string | null {
  const match = text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/);
  return match ? match[0] : null;
}

const MONEY_REGEX =
  /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:[kKmM]\b|million|all-in)?(?:\s?[–—-]\s?\$?\d[\d,]*(?:\.\d+)?\s?[kKmM]?)?/g;

/** All money tokens (`$16k`, `$9,620.20`, `$10k–$12k`) in a string. */
export function detectMoney(text: string): string[] {
  const matches = text.match(MONEY_REGEX);
  if (!matches) return [];
  return matches.map((token) => token.replace(/\s+/g, "").replace(/–|—/g, "–"));
}

// ── date + coverage helpers ───────────────────────────────────────────────────

function formatBusinessDate(businessDate: string): {
  weekday: string;
  dateLabel: string;
} {
  const parsed = new Date(`${businessDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { weekday: "", dateLabel: businessDate };
  }
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(parsed);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
  return { weekday, dateLabel };
}

function formatSourceWindow(businessDate: string): string {
  const parsed = new Date(`${businessDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return businessDate;
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFrom(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function extractCounts(packet: CanonicalDailyBriefPacket): {
  counts: {
    meetings: number;
    emails: number;
    teams: number;
    documents: number;
  };
  filteredCount: number | null;
} {
  const coverage = packet.sourceCoverage;
  const included =
    isRecord(coverage) && isRecord(coverage.included)
      ? coverage.included
      : null;
  const fallback = packet.sourceCounts ?? {};
  const pick = (key: string) =>
    included ? numberFrom(included[key]) : numberFrom(fallback[key]);

  const counts = {
    meetings: pick("meetings"),
    emails: pick("emails"),
    teams: pick("teams"),
    documents: pick("documents"),
  };

  const skipped = isRecord(coverage) ? coverage.skipped : undefined;
  const filteredCount =
    typeof skipped === "number" && Number.isFinite(skipped) ? skipped : null;

  return { counts, filteredCount };
}

function formatAsOf(generatedAt: string | null): string | null {
  if (!generatedAt) return null;
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// ── section → structured mappers ──────────────────────────────────────────────

const READ_EYEBROWS: Record<BriefSeverity, string> = {
  critical: "Immediate blocker",
  amber: "Watch item",
  positive: "Positive signal",
  info: "For your read",
};

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  if (end === -1) return trimmed;
  return trimmed.slice(0, end + 1).trim();
}

/**
 * A punchy masthead thesis. Prefers a self-contained clause before the first
 * colon (e.g. "Two owner-level items need action now"); otherwise falls back to
 * the first sentence, capped so the masthead stays to a few lines.
 */
function deriveThesis(execBrief: string): string | null {
  const plain = stripCitations(execBrief.replace(/\*\*/g, ""));
  if (!plain) return null;
  const sentence = firstSentence(plain);

  const colon = sentence.indexOf(":");
  if (colon >= 20 && colon <= 120) {
    return sentence.slice(0, colon).trim();
  }
  if (sentence.length <= 200) return sentence.replace(/[.:]\s*$/, "");
  const cut = sentence.slice(0, 200);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : 200).trim()}…`;
}

function sourceRefsForIds(
  ids: string[],
  sources: CanonicalDailyBriefPacket["sources"],
): DecisionSource[] {
  const byKey = new Map<string, CanonicalDailyBriefPacket["sources"][number]>();
  for (const source of sources) {
    byKey.set(source.id, source);
    if (source.alias) byKey.set(source.alias, source);
  }
  return [
    ...new Set(ids.flatMap((id) => id.split(",").map((value) => value.trim()))),
  ]
    .map((id) => byKey.get(id))
    .filter((source): source is CanonicalDailyBriefPacket["sources"][number] =>
      Boolean(source),
    )
    .map((source) => ({
      title: source.title,
      url: source.url,
      lane: source.lane,
    }));
}

function citationIds(text: string): string[] {
  return [...text.matchAll(/\[([^\]]+)\]/g)].flatMap((match) =>
    match[1].split(","),
  );
}

function buildDecisions(
  sectionMap: Record<string, string>,
  sourceRefs: CanonicalDailyBriefPacket["sources"],
): DecisionItem[] {
  const seen = new Set<string>();
  const decisions: DecisionItem[] = [];

  const sources = [
    sectionMap["Highest-Leverage Owner Decisions"],
    sectionMap["Decision Candidates"],
  ].filter((body): body is string => Boolean(body));

  for (const body of sources) {
    for (const bullet of topLevelBullets(body)) {
      const { lead, rest } = splitLeadRest(bullet);
      const title = plainText(lead ?? firstSentence(rest));
      const key = title.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
      if (!title || seen.has(key)) continue;
      seen.add(key);

      const fullText = `${lead ?? ""} ${rest}`;
      const severity = classifySeverity(fullText);
      const date = detectDate(fullText);
      const reference = detectReference(fullText);

      decisions.push({
        reference,
        title,
        body: parseInline(lead ? rest : rest.replace(firstSentence(rest), "")),
        context: [],
        badge: badgeForSeverity(severity, fullText),
        severity,
        due: date ? { label: "Due", value: date } : null,
        sourceRefs: sourceRefsForIds(citationIds(fullText), sourceRefs),
      });
    }
  }

  return decisions;
}

const KNOWN_PROJECT_HINTS = [
  "Union Collective",
  "Union Food Hall",
  "McLean",
  "McLane",
  "Superior Beverage",
  "Goodwill",
  "Brooksville",
  "Noblesville",
  "Tremont",
  "Allisonville",
  "Washington",
  "Galesburg",
  "McCombs",
  "Playmakers",
  "Pensacola",
  "Westfield",
  "Sprinkler division",
  "Rack",
];

function detectReference(text: string): string | null {
  for (const hint of KNOWN_PROJECT_HINTS) {
    if (
      new RegExp(
        `\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      ).test(text)
    ) {
      return hint;
    }
  }
  return null;
}

function badgeForSeverity(severity: BriefSeverity, text: string): string {
  if (severity === "critical") {
    if (/\b(today|now|immediately)\b/i.test(text)) return "Escalate today";
    return "Act now";
  }
  if (severity === "amber") {
    const date = detectDate(text);
    return date ? `Decide by ${date}` : "Decide this week";
  }
  if (severity === "positive") return "On track";
  return "For decision";
}

function buildMoney(sectionMap: Record<string, string>): MoneyStat[] {
  const stats: MoneyStat[] = [];
  const seen = new Set<string>();

  const bodies = [
    sectionMap["Executive Brief"],
    sectionMap["Highest-Leverage Owner Decisions"],
    sectionMap["Decision Candidates"],
    sectionMap["Risk Candidates"],
    sectionMap["Project Intelligence Updates"],
  ].filter((body): body is string => Boolean(body));

  const clauses: string[] = [];
  for (const body of bodies) {
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || !/\$\s?\d/.test(trimmed)) continue;
      // split compound sentences so each money figure gets its own card
      for (const clause of trimmed.split(/;|(?<=\.)\s+(?=[A-Z*])/)) {
        if (/\$\s?\d/.test(clause)) clauses.push(clause.trim());
      }
    }
  }

  for (const clause of clauses) {
    const money = detectMoney(clause);
    if (money.length === 0) continue;
    const figure = money[0];
    // dedup by figure so the same amount doesn't repeat across sections
    if (seen.has(figure)) continue;

    const label = deriveMoneyLabel(clause, figure);
    // skip cards with no meaningful label (would just echo the amount twice)
    if (!label) continue;
    seen.add(figure);

    const { tag, severity } = moneyTag(clause);
    stats.push({
      label,
      figure,
      tag,
      severity,
      body: parseInline(clause.replace(/^-\s+/, "")),
    });
    if (stats.length >= 6) break;
  }

  return stats;
}

function deriveMoneyLabel(clause: string, figure: string): string | null {
  const reference = detectReference(clause);
  if (reference) return reference;

  // first bold span that isn't itself a money amount
  const boldSpans = [...clause.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
  const boldLabel = boldSpans.find((span) => !span.includes("$"));
  if (boldLabel)
    return stripCitations(boldLabel).replace(/[.:]$/, "").slice(0, 32);

  // otherwise the leading phrase before the figure (e.g. "Cost exposure")
  const lead = stripCitations(clause.replace(/^-\s+/, "").split("$")[0] ?? "");
  if (!lead) return null;
  const beforeColon = lead.split(":")[0].trim();
  const phrase = (beforeColon.length >= 4 ? beforeColon : lead)
    .split(/\s+/)
    .slice(0, 4)
    .join(" ")
    .replace(/[,.;:]$/, "")
    .trim();
  return phrase.length >= 4 ? phrase.slice(0, 32) : null;
}

function moneyTag(clause: string): { tag: string; severity: BriefSeverity } {
  if (/\bawarded|accepted|loi\b/i.test(clause))
    return { tag: "Awarded", severity: "positive" };
  if (/\bcontingency|pending|awaits?\b/i.test(clause))
    return { tag: "Pending", severity: "amber" };
  if (/\bexposure|risk|add\b/i.test(clause))
    return { tag: "Added cost", severity: "amber" };
  if (/\bfee|permit|registration\b/i.test(clause))
    return { tag: "Owed", severity: "info" };
  return { tag: "Watch", severity: "amber" };
}

function buildOperations(sectionMap: Record<string, string>): OperationRow[] {
  const body = sectionMap["Risk Candidates"];
  if (!body) return [];
  const seen = new Set<string>();
  const rows: OperationRow[] = [];

  for (const bullet of topLevelBullets(body)) {
    const { lead, rest } = splitLeadRest(bullet);
    const title = plainText(lead ?? firstSentence(rest));
    const key = title.toLowerCase().slice(0, 80);
    if (!title || seen.has(key)) continue;
    seen.add(key);

    const fullText = `${lead ?? ""} ${rest}`;
    const severity = classifySeverity(fullText);
    rows.push({
      title,
      body: parseInline(lead ? rest : rest.replace(firstSentence(rest), "")),
      tag: operationTag(severity),
      severity,
    });
  }

  return rows;
}

function operationTag(severity: BriefSeverity): string {
  if (severity === "critical") return "At risk";
  if (severity === "amber") return "Watch";
  if (severity === "positive") return "Improving";
  return "Tracking";
}

function buildProjects(sectionMap: Record<string, string>): ProjectCard[] {
  const body = sectionMap["Project Intelligence Updates"];
  if (!body) return [];

  const lines = body.split(/\r?\n/);
  const cards: ProjectCard[] = [];
  let current: {
    name: string;
    subtitle: string | null;
    details: string[];
  } | null = null;

  const flush = () => {
    if (!current) return;
    const detailText = current.details.join(" ");
    const severity = classifySeverity(detailText);
    const figures = buildProjectFigures(current.details);
    cards.push({
      name: current.name,
      subtitle: current.subtitle,
      pill: projectPill(severity),
      severity,
      body: parseInline(
        current.details.map((d) => stripCitations(d)).join(" "),
      ),
      figures,
    });
    current = null;
  };

  for (const line of lines) {
    // top-level project header: `- **Name**` (no deeper indentation)
    const header = line.match(/^-\s+\*\*(.+?)\*\*\s*$/);
    if (header) {
      flush();
      const raw = header[1].trim();
      const [name, ...subParts] = raw.split(/\s*[–—:]\s*/);
      current = {
        name: name.trim(),
        subtitle: subParts.length ? subParts.join(" ").trim() : null,
        details: [],
      };
      continue;
    }
    // sub-bullet detail lines (indented `- …`)
    const sub = line.match(/^\s{2,}-\s+(.*)$/);
    if (sub && current) {
      current.details.push(sub[1].trim());
    }
  }
  flush();

  return cards;
}

function buildProjectFigures(details: string[]): { label: InlineSegment[] }[] {
  const figures: { label: InlineSegment[] }[] = [];
  const seen = new Set<string>();
  for (const detail of details) {
    for (const money of detectMoney(detail)) {
      if (seen.has(money)) continue;
      seen.add(money);
      figures.push({ label: [{ text: money, bold: true }] });
    }
    const date = detectDate(detail);
    if (date && !seen.has(date)) {
      seen.add(date);
      figures.push({
        label: [
          { text: "by ", bold: false },
          { text: date, bold: true },
        ],
      });
    }
    if (figures.length >= 3) break;
  }
  return figures.slice(0, 3);
}

function projectPill(severity: BriefSeverity): string {
  if (severity === "critical") return "At risk";
  if (severity === "amber") return "Needs decision";
  if (severity === "positive") return "On track";
  return "In progress";
}

function buildRead(
  sectionMap: Record<string, string>,
  decisions: DecisionItem[],
): { lead: InlineSegment[]; supporting: InlineSegment[][]; items: ReadItem[] } {
  const execBrief = sectionMap["Executive Brief"] ?? "";
  const paragraphs = execBrief
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const lead = paragraphs.length ? parseInline(paragraphs[0]) : [];
  const supporting = paragraphs.slice(1).map((p) => parseInline(p));

  // "If you read nothing else" — top 3 decisions by severity.
  const ranked = [...decisions].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
  const items: ReadItem[] = ranked.slice(0, 3).map((decision) => ({
    eyebrow: READ_EYEBROWS[decision.severity],
    tone: decision.severity,
    body: [{ text: decision.title, bold: true }],
  }));

  return { lead, supporting, items };
}

function severityRank(severity: BriefSeverity): number {
  switch (severity) {
    case "critical":
      return 3;
    case "amber":
      return 2;
    case "info":
      return 1;
    case "positive":
      return 0;
  }
}

function buildTemperature(
  decisions: DecisionItem[],
  operations: OperationRow[],
  money: MoneyStat[],
  projects: ProjectCard[],
): TemperaturePill[] {
  const pills: TemperaturePill[] = [];
  const hasCriticalDecision = decisions.some((d) => d.severity === "critical");

  if (decisions.length) {
    pills.push({
      label: "decisions needed",
      emphasis: String(decisions.length),
      tone: hasCriticalDecision ? "critical" : "amber",
    });
  }
  if (operations.length) {
    const atRisk = operations.filter((o) => o.severity === "critical").length;
    pills.push({
      label: "schedule risks",
      emphasis: String(operations.length),
      tone: atRisk > 0 ? "critical" : "amber",
    });
  }
  if (money.length) {
    pills.push({
      label: "cash items",
      emphasis: String(money.length),
      tone: "amber",
    });
  }
  const improving = projects.filter((p) => p.severity === "positive").length;
  if (improving > 0) {
    pills.push({
      label: "on track",
      emphasis: String(improving),
      tone: "positive",
    });
  }

  return pills;
}

// ── public builder ────────────────────────────────────────────────────────────

// ── v3 structured brief → view model ────────────────────────────────────────
// The packet now carries a structured `brief` (see brief-v3-types.ts). Build the
// same view-model shape from it so the React view is unchanged. Legacy packets
// (no `brief`) fall back to the section-parsing path below.

function v3Decisions(
  packet: CanonicalDailyBriefPacket,
  brief: BriefV3,
): DecisionItem[] {
  const projects = new Map(
    brief.projects.map((project) => [project.name.toLowerCase(), project]),
  );

  return brief.callsToday.map((call) => {
    const project = projects.get(call.project.toLowerCase());
    return {
      reference: call.project,
      title: plainText(call.project),
      body: parseInline(stripCitations(call.question)),
      context: project
        ? parseInline(stripCitations(firstSentence(project.context)))
        : [],
      badge: call.optional ? "Optional" : "Decision",
      severity: call.optional
        ? "info"
        : classifySeverity(
            `${call.project} ${call.question} ${project?.context ?? ""}`,
          ),
      due: null,
      sourceRefs: sourceRefsForIds(call.sourceIds, packet.sources),
    };
  });
}

function v3Projects(brief: BriefV3): ProjectCard[] {
  return [...brief.projects]
    .sort((a, b) => (a.urgencyRank ?? 99) - (b.urgencyRank ?? 99))
    .map((project) => {
      const clean = stripCitations(project.context);
      const actionText = project.actionItems.map((item) => item.text).join(" ");
      return {
        name: project.name,
        subtitle: project.hasOwnerDecision
          ? "Needs a decision"
          : project.resolvedToday
            ? "Resolved today"
            : "On track",
        pill: project.hasOwnerDecision ? "Action" : "On track",
        severity: project.hasOwnerDecision ? classifySeverity(clean) : "info",
        body: parseInline(clean),
        figures: buildProjectFigures(detectMoney(`${clean} ${actionText}`)),
      };
    });
}

function v3Operations(brief: BriefV3): OperationRow[] {
  const rows: OperationRow[] = [];
  for (const project of brief.projects) {
    for (const item of project.actionItems) {
      const owner = item.ownerIsBrandon ? "You" : item.owner;
      const tag = item.due
        ? `Due ${item.due}`
        : item.urgency
          ? "Urgent"
          : owner;
      rows.push({
        title: `${project.name}: ${plainText(item.text)}`,
        body: parseInline(stripCitations(`${owner} — ${item.text}`)),
        tag,
        severity:
          item.due || item.urgency
            ? classifySeverity(`${item.text} ${item.urgency ?? ""}`)
            : "info",
      });
    }
  }
  return rows.slice(0, 40);
}

function v3Money(brief: BriefV3): MoneyStat[] {
  const stats: MoneyStat[] = [];
  const seen = new Set<string>();
  for (const project of brief.projects) {
    const text = `${project.context} ${project.actionItems.map((item) => item.text).join(" ")}`;
    for (const figure of detectMoney(text)) {
      if (seen.has(figure)) continue;
      seen.add(figure);
      stats.push({
        label: project.name,
        figure,
        tag: "Exposure",
        severity: classifySeverity(project.context),
        body: parseInline(stripCitations(firstSentence(project.context))),
      });
      if (stats.length >= 8) return stats;
    }
  }
  return stats;
}

function v3Read(brief: BriefV3): ExecutiveBriefViewModel["read"] {
  const signal = brief.executiveSignal;
  const signalWatchouts = signal?.watchouts ?? [];
  const items: ReadItem[] = signalWatchouts.length
    ? signalWatchouts.slice(0, 5).map((watchout) => ({
        eyebrow: READ_EYEBROWS[classifySeverity(watchout)],
        tone: classifySeverity(watchout),
        body: parseInline(stripCitations(watchout)),
      }))
    : [...brief.projects]
        .filter((project) => project.hasOwnerDecision)
        .sort((a, b) => (a.urgencyRank ?? 99) - (b.urgencyRank ?? 99))
        .slice(0, 5)
        .map((project) => ({
          eyebrow: project.name,
          tone: classifySeverity(project.context),
          body: parseInline(stripCitations(firstSentence(project.context))),
        }));
  const count = brief.callsToday.length;
  const lead = parseInline(
    signal?.headline ||
      (count
        ? `${count} decision${count === 1 ? "" : "s"} need you today.`
        : "No decisions need you today."),
  );
  const supporting = [signal?.whyNow, signal?.focus]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => parseInline(stripCitations(value)));
  return { lead, supporting, items };
}

function narrativeKind(title: string): BriefNarrativeKind {
  const normalized = title.toLowerCase();
  if (/executive (assessment|brief|read)/.test(normalized)) return "assessment";
  if (/what changed/.test(normalized)) return "change";
  if (/project-by-project|project intelligence/.test(normalized))
    return "portfolio";
  if (
    /decision|commitment|recommended executive action|highest-leverage/.test(
      normalized,
    )
  ) {
    return "action";
  }
  if (/risk|early warning/.test(normalized)) return "risk";
  if (/prevent|root.?cause|system improvement|control/.test(normalized))
    return "system";
  if (/opportunit|leverage/.test(normalized)) return "opportunity";
  if (/evidence gap|unresolved question|source coverage/.test(normalized))
    return "evidence";
  return "analysis";
}

function narrativeId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
  return `brief-${slug || "section"}-${index + 1}`;
}

function buildNarrativeSections(
  packet: CanonicalDailyBriefPacket,
): BriefNarrativeSection[] {
  return packet.sections
    .filter((section) => section.body.trim().length > 0)
    .map((section, index) => ({
      id: narrativeId(section.title, index),
      title: section.title,
      body: section.body,
      kind: narrativeKind(section.title),
    }));
}

const PREVENTION_SEVERITY: Record<string, BriefSeverity> = {
  critical: "critical",
  high: "critical",
  medium: "amber",
  low: "info",
};

/**
 * Surface the fix, not just the problem. Findings the model could not assess
 * ("cannot_determine") are excluded — a recommended system with no established
 * preventability is speculation, and the noise gate says don't render it.
 */
function v3RecommendedSystems(brief: BriefV3): RecommendedSystemItem[] {
  return (brief.preventionFindings ?? [])
    .filter(
      (finding) =>
        finding.preventability !== "cannot_determine" &&
        plainText(stripCitations(finding.recommendedSystem)).length > 0,
    )
    .map((finding, index) => ({
      id: finding.issueKey || `prevention-${index + 1}`,
      title: plainText(stripCitations(finding.title)),
      severity: PREVENTION_SEVERITY[finding.severity] ?? "info",
      missingControl: plainText(stripCitations(finding.missingControl)),
      recommendedSystem: plainText(stripCitations(finding.recommendedSystem)),
      accountableRole: finding.accountableRole
        ? plainText(stripCitations(finding.accountableRole))
        : null,
      leadingIndicator: finding.leadingIndicator
        ? plainText(stripCitations(finding.leadingIndicator))
        : null,
    }));
}

function buildViewModelFromV3(
  packet: CanonicalDailyBriefPacket,
  brief: BriefV3,
): ExecutiveBriefViewModel {
  const { weekday, dateLabel } = formatBusinessDate(packet.businessDate);
  const { counts, filteredCount } = extractCounts(packet);
  const decisions = v3Decisions(packet, brief);
  const money = v3Money(brief);
  const operations = v3Operations(brief);
  const projects = v3Projects(brief);
  const read = v3Read(brief);
  const count = brief.callsToday.length;

  return {
    weekday,
    dateLabel,
    preparedFor: EXECUTIVE_BRIEF_PREPARED_FOR,
    sourceWindowLabel: formatSourceWindow(packet.businessDate),
    counts,
    filteredCount,
    asOfLabel: formatAsOf(packet.generatedAt),
    thesis:
      brief.executiveSignal?.headline ||
      (count
        ? `${count} owner decision${count === 1 ? "" : "s"} need you today`
        : null),
    temperature: buildTemperature(decisions, operations, money, projects),
    read,
    decisions,
    money,
    operations,
    projects,
    recommendedSystems: v3RecommendedSystems(brief),
    narrativeSections: buildNarrativeSections(packet),
  };
}

export function buildExecutiveBriefViewModel(
  packet: CanonicalDailyBriefPacket,
): ExecutiveBriefViewModel {
  // v3 structured brief is the source of truth when present.
  if (packet.brief) return buildViewModelFromV3(packet, packet.brief);

  // Legacy packets: parse the markdown section map.
  const sectionMap = getSectionMap(packet);
  const { weekday, dateLabel } = formatBusinessDate(packet.businessDate);
  const { counts, filteredCount } = extractCounts(packet);

  const decisions = buildDecisions(sectionMap, packet.sources);
  const money = buildMoney(sectionMap);
  const operations = buildOperations(sectionMap);
  const projects = buildProjects(sectionMap);
  const read = buildRead(sectionMap, decisions);

  const execBrief = sectionMap["Executive Brief"] ?? "";
  const thesisText = deriveThesis(execBrief);

  return {
    weekday,
    dateLabel,
    preparedFor: EXECUTIVE_BRIEF_PREPARED_FOR,
    sourceWindowLabel: formatSourceWindow(packet.businessDate),
    counts,
    filteredCount,
    asOfLabel: formatAsOf(packet.generatedAt),
    thesis: thesisText || null,
    temperature: buildTemperature(decisions, operations, money, projects),
    read,
    decisions,
    money,
    operations,
    projects,
    // Legacy markdown packets carry no structured prevention findings; the
    // narrative "Preventable failures" section still renders for them.
    recommendedSystems: [],
    narrativeSections: buildNarrativeSections(packet),
  };
}

/**
 * Build a `title → markdown body` map from the packet's `##`-delimited sections
 * (produced by `splitDailyBriefMarkdown`). The titles match the compiler's
 * canonical section names: "Executive Brief", "Highest-Leverage Owner
 * Decisions", "Project Intelligence Updates", "Risk Candidates", etc.
 */
function getSectionMap(
  packet: CanonicalDailyBriefPacket,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const section of packet.sections) {
    map[section.title] = section.body;
  }
  return map;
}
