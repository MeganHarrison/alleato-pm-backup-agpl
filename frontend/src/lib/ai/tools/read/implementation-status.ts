/**
 * Pure helpers for the assistant's `getImplementationStatus` read tool.
 *
 * Kept free of I/O so the audit-row parsing and phase-derivation precedence
 * are unit-testable without GitHub or Supabase (mirrors the
 * `implementation-dispatch-issue.ts` pattern on the write side).
 */

import type {
  LinkedPullRequestStatus,
  RepoIssueSnapshot,
} from "@/lib/admin-feedback/github";

/** Label the autofix lane applies when automation gives up and a human must take over. */
export const AUTOFIX_NEEDS_HUMAN_LABEL = "autofix:needs-human";

export type DispatchAuditRow = {
  created_at: string;
  request_payload: unknown;
  response_payload: unknown;
};

export type DispatchRecord = {
  issueNumber: number;
  issueUrl: string;
  title: string | null;
  triggerLabel: string | null;
  dispatchedAt: string;
};

/**
 * Parses `ai_tool_write_audits` rows for `dispatchImplementationRequest`
 * successes into dispatch records. Rows without a numeric `issueNumber` in
 * `response_payload` are skipped (e.g. preview-only or malformed payloads).
 * Rows must be ordered newest-first; duplicates for the same issue keep the
 * most recent row.
 */
export function extractDispatchRecords(rows: DispatchAuditRow[]): DispatchRecord[] {
  const seen = new Set<number>();
  const records: DispatchRecord[] = [];

  for (const row of rows) {
    const response = (row.response_payload ?? null) as {
      issueNumber?: unknown;
      issueUrl?: unknown;
      triggerLabel?: unknown;
    } | null;
    const request = (row.request_payload ?? null) as { title?: unknown } | null;

    const issueNumber = response?.issueNumber;
    if (typeof issueNumber !== "number" || !Number.isFinite(issueNumber)) continue;
    if (seen.has(issueNumber)) continue;
    seen.add(issueNumber);

    records.push({
      issueNumber,
      issueUrl:
        typeof response?.issueUrl === "string" ? response.issueUrl : "",
      title: typeof request?.title === "string" ? request.title : null,
      triggerLabel:
        typeof response?.triggerLabel === "string" ? response.triggerLabel : null,
      dispatchedAt: row.created_at,
    });
  }

  return records;
}

export type ImplementationPhase =
  | "merged"
  | "issue_deleted"
  | "blocked_needs_human"
  | "in_review"
  | "closed_without_merge"
  | "queued"
  | "unknown";

export type DerivePhaseInput = {
  snapshot: RepoIssueSnapshot;
  mergedPr?: LinkedPullRequestStatus;
  openPr?: LinkedPullRequestStatus;
};

/**
 * Collapses issue + PR signals into one phase, in strict precedence order:
 * a merged PR is terminal success regardless of later labels; a deleted issue
 * is a broken link; the `autofix:needs-human` label outranks an open PR
 * (the block is the actionable signal); an open PR means review is underway;
 * a closed issue with no merged PR was abandoned; an open issue with nothing
 * else is still queued for the coding agent.
 */
export function deriveImplementationPhase(input: DerivePhaseInput): ImplementationPhase {
  if (input.mergedPr?.merged) return "merged";
  if (input.snapshot.existence === "deleted") return "issue_deleted";
  if (input.snapshot.existence === "unknown") return "unknown";
  if (input.snapshot.labels.includes(AUTOFIX_NEEDS_HUMAN_LABEL)) {
    return "blocked_needs_human";
  }
  if (input.openPr) return "in_review";
  if (input.snapshot.state === "closed") return "closed_without_merge";
  if (input.snapshot.state === "open") return "queued";
  return "unknown";
}

const PHASE_DESCRIPTIONS: Record<ImplementationPhase, string> = {
  merged: "Implemented — the pull request merged to main and the change is deploying/live.",
  issue_deleted:
    "The dispatched GitHub issue no longer exists (deleted). The pipeline cannot act on it; re-dispatch if the change is still wanted.",
  blocked_needs_human:
    "Blocked — automation escalated with the autofix:needs-human label. A human must review; remove the label and re-apply the trigger label to retry automation.",
  in_review: "In review — a pull request is open and going through automated review/checks.",
  closed_without_merge:
    "Closed without a merged pull request — the issue was closed but no fix landed.",
  queued: "Queued — the issue is open and waiting for the coding agent to pick it up.",
  unknown:
    "Status unavailable — GitHub could not be reached or is not configured, so the live state is unverified.",
};

export function describeImplementationPhase(phase: ImplementationPhase): string {
  return PHASE_DESCRIPTIONS[phase];
}
