/**
 * Structured representation of a v3 Daily Executive Brief.
 *
 * This is the single source of truth the generator emits into
 * `intelligence_packets.packet_json.brief`. The reader page renders from it and
 * the learning-loop promotion derives candidates from it — nothing parses
 * markdown section headings anymore.
 *
 * Format contract: see
 * docs/ops/evidence/2026-07-07-manual-daily-executive-brief/BRIEF-FORMAT-SPEC.md
 * Golden sample: .../2026-07-08/brief-richer-0708.md
 */

/** A cited source, keyed by its short alias (e.g. "S247"). */
export interface BriefV3Source {
  /** Human title of the source (email subject, meeting name, …). */
  title: string;
  /** Lane the source came from. */
  type: "meeting" | "email" | "teams" | "document";
  /** Deep link to the underlying record, or null when none exists (e.g. Teams). */
  url: string | null;
  /** Project the source belongs to, or null when unassigned. */
  project: string | null;
}

/** One action item inside a project block or the loose-ends list. */
export interface BriefV3ActionItem {
  /** True when the item is the owner's (Brandon's) own decision/approval. */
  ownerIsBrandon: boolean;
  /** Display owner: "You" when ownerIsBrandon, otherwise a person's name. */
  owner: string;
  /** The action, as a plain sentence. */
  text: string;
  /** Human-readable due date ("July 14"), or null when there is no real date. */
  due: string | null;
  /** ISO due date for the task system, when known. */
  dueIso: string | null;
  /** Honest urgency phrase used when there is no due date ("Blocking submittals; as soon as possible"). */
  urgency: string | null;
  /** True for a genuinely optional call (rendered with an "(optional)" marker). */
  optional: boolean;
  /** Source aliases backing this item (e.g. ["S247"]). */
  sourceIds: string[];
}

/** One line in the "Your calls today" decision index. */
export interface BriefV3Call {
  /** Project the decision belongs to. */
  project: string;
  /** The decision phrased as a question/call — no status, no context. */
  question: string;
  /** True for a genuinely optional call. */
  optional: boolean;
  sourceIds: string[];
}

export interface BriefV3ExecutiveSignal {
  headline: string;
  whyNow: string;
  focus: string;
  watchouts: string[];
}

/** One project block. */
export interface BriefV3Project {
  name: string;
  /** 1 = most urgent. Drives ordering. */
  urgencyRank: number;
  /** True when the project has at least one Brandon decision (keeps it in the main stream). */
  hasOwnerDecision: boolean;
  /** True when the project's only news is that something resolved today. */
  resolvedToday: boolean;
  actionItems: BriefV3ActionItem[];
  /** Advisor-voice prose (plain sentences), already including inline source aliases. */
  context: string;
}

/** A loose end not tied to any project (the "went quiet" cluster). */
export interface BriefV3LooseEnd {
  text: string;
  sourceIds: string[];
}

export interface BriefV3SourceCoverage {
  meetings: number;
  emails: number;
  teams: number;
  documents: number;
  /** Which lanes were thin, if any. */
  thinLanes: string[];
  /** Free-text coverage note (dedup caveat, citation gaps, …). */
  note: string | null;
}

/** A packet-linked prevention finding. It is review-gated evidence, not a blame or loss verdict. */
export interface BriefV3PreventionFinding {
  issueKey: string;
  title: string;
  category: "change_management" | "financial_controls" | "procurement" | "reporting" | "accountability" | "scheduling" | "owner_relations" | "safety" | "other";
  severity: "low" | "medium" | "high" | "critical";
  observedCondition: string;
  preventability: "preventable" | "partially_preventable" | "cannot_determine";
  preventabilityBasis: string;
  missingControl: string;
  recommendedSystem: string;
  accountableRole: string | null;
  leadingIndicator: string | null;
  confidence: "high" | "medium" | "low";
  sourceIds: string[];
}

/** A statement in the executive synthesis with explicit epistemic status. */
export interface BriefV3SynthesisClaim {
  id: string;
  statement: string;
  sourceIds: string[];
  confidence: "high" | "medium" | "low";
}

export interface BriefV3SynthesisRecommendation extends BriefV3SynthesisClaim {
  owner: string | null;
  rationale: string;
}

export interface BriefV3ExecutiveSynthesis {
  /** Cross-source patterns and their business implication. */
  patterns: BriefV3SynthesisClaim[];
  /** Evidence-backed causal hypotheses; never presented as established fact. */
  rootCauses: BriefV3SynthesisClaim[];
  facts: BriefV3SynthesisClaim[];
  inferences: BriefV3SynthesisClaim[];
  recommendations: BriefV3SynthesisRecommendation[];
  risks: BriefV3SynthesisClaim[];
  opportunities: BriefV3SynthesisClaim[];
  financial: BriefV3SynthesisClaim[];
  schedule: BriefV3SynthesisClaim[];
  decisions: BriefV3SynthesisClaim[];
  /** Number of eligible sources represented by claims and unresolved lanes. */
  evidenceCoverage: {
    eligibleSourceCount: number;
    citedSourceCount: number;
    uncoveredSourceIds: string[];
    note: string | null;
  };
}

/** The full structured brief. */
export interface BriefV3 {
  version: "v3";
  /** Business date, YYYY-MM-DD. */
  businessDate: string;
  executiveSignal: BriefV3ExecutiveSignal;
  callsToday: BriefV3Call[];
  /** Ordered most urgent first. */
  projects: BriefV3Project[];
  looseEnds: BriefV3LooseEnd[];
  preventionFindings: BriefV3PreventionFinding[];
  /** Optional for backwards-compatible reads of pre-Ticket-04 packets. */
  executiveSynthesis?: BriefV3ExecutiveSynthesis;
  sourceCoverage: BriefV3SourceCoverage;
  /** Alias → source metadata, for rendering links. */
  sources: Record<string, BriefV3Source>;
}
