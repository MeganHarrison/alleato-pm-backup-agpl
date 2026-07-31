/**
 * Pure decision layer for autonomous triage — no IO, so the safety gate is
 * unit-testable without pulling the AI provider / Supabase dependency graph.
 * The orchestrator in `autonomous-triage.ts` consumes these.
 */

export type TriageDecision = "promote" | "archive" | "keep";
export type TriageAction = "promote" | "archive" | "keep";

export interface TriageVerdict {
  decision: TriageDecision;
  confidence: number;
  rationale: string;
}

export interface TriageConfig {
  /** Min model confidence to auto-activate. Conservative by design. */
  promoteThreshold: number;
  /** Min model confidence to auto-archive as junk. */
  archiveThreshold: number;
}

export const DEFAULT_TRIAGE_CONFIG: TriageConfig = {
  promoteThreshold: 0.8,
  archiveThreshold: 0.8,
};

/**
 * Maps a model verdict to a concrete action. Anything below the confidence bar —
 * or a `keep` verdict — stays a candidate for human review. A `promote` verdict
 * can only ever promote (never archive) and vice versa.
 */
export function decideTriageAction(
  verdict: TriageVerdict,
  config: TriageConfig = DEFAULT_TRIAGE_CONFIG,
): TriageAction {
  if (verdict.decision === "promote" && verdict.confidence >= config.promoteThreshold) {
    return "promote";
  }
  if (verdict.decision === "archive" && verdict.confidence >= config.archiveThreshold) {
    return "archive";
  }
  return "keep";
}
