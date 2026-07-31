// Pure mapping from structured Daily Deep Read signal candidates
// (`source_signal_candidates`) to the dashboard's brief-item lanes. Kept free of
// any runtime import (types only) so it is trivially unit-testable — the IO lives
// in `canonical-operating-packet.ts`.

import type { BrandonBriefItem } from "./brandon-daily-update";

type BriefSource = "Email" | "Teams" | "Meeting" | "Document";
type BriefTone = "neutral" | "good" | "watch" | "risk";

export type CandidateRow = {
  id: string;
  signal_type: string;
  title: string;
  summary: string;
  why_it_matters: string | null;
  next_action: string | null;
  project_id: number | null;
  suggested_owner_label: string | null;
  current_status: string | null;
  status: string | null;
  confidence: string | null;
  confidence_score: number | null;
  source_document_id: string | null;
  source_occurred_at: string | null;
  normalized_signal_key: string | null;
};

// Lane caps keep the dashboard signal-dense — a brief window can carry dozens of
// routine project_update candidates that would otherwise wall the page. Owner
// decisions are the point, so they are never capped.
export const MAX_WAITING = 15;
export const MAX_UPDATES = 40;

/**
 * Infer the citation source lane from a candidate's source token. Deep-read
 * source ids are prefixed by channel (`teamsdm_…`, `outlook_…`); meeting
 * transcripts use ULIDs. Falls back to Document.
 */
function inferSource(candidate: CandidateRow): BriefSource {
  const token = `${candidate.source_document_id ?? ""} ${candidate.normalized_signal_key ?? ""}`.toLowerCase();
  if (token.includes("team")) return "Teams";
  if (token.includes("outlook") || token.includes("email")) return "Email";
  if (token.includes("meeting") || token.includes("transcript")) return "Meeting";
  return "Document";
}

function toneForCandidate(candidate: CandidateRow): BriefTone {
  const type = candidate.signal_type.toLowerCase();
  if (type === "risk") return "risk";
  if (type === "decision") return "watch";
  return "neutral";
}

export function candidateToBriefItem(
  candidate: CandidateRow,
  projectName: string | null,
): BrandonBriefItem {
  const source = inferSource(candidate);
  const date = candidate.source_occurred_at ?? "";
  const sourceDetail = candidate.title || "Daily Deep Read";
  return {
    title: candidate.title || "Untitled signal",
    summary: candidate.summary || candidate.why_it_matters || "",
    bullets: [],
    recommendedAction: candidate.next_action ?? undefined,
    whyItMatters: candidate.why_it_matters ?? undefined,
    source,
    sourceDetail,
    date,
    citations: [{ source, sourceDetail, date }],
    project: projectName ?? "Internal / cross-project",
    projectInternalId: candidate.project_id ?? null,
    owner: candidate.suggested_owner_label ?? undefined,
    status: candidate.current_status ?? undefined,
    tone: toneForCandidate(candidate),
  };
}

/**
 * Route structured signal candidates into the three dashboard lanes by
 * `signal_type`: decisions → owner decisions, tasks → waiting-on, everything
 * else (risk / process_issue / project_update) → important updates, with risks
 * and process issues surfaced ahead of routine updates so the derived risk radar
 * stays meaningful. Pure — the IO adapter calls this after loading candidates.
 */
export function routeCandidatesToSections(
  candidates: CandidateRow[],
  projectNames: Map<number, string>,
): {
  needsBrandon: BrandonBriefItem[];
  waitingOnOthers: BrandonBriefItem[];
  importantUpdates: BrandonBriefItem[];
} {
  const decisions: CandidateRow[] = [];
  const tasks: CandidateRow[] = [];
  const updates: CandidateRow[] = [];
  for (const candidate of candidates) {
    switch (candidate.signal_type.toLowerCase()) {
      case "decision":
        decisions.push(candidate);
        break;
      case "task":
        tasks.push(candidate);
        break;
      default:
        updates.push(candidate);
        break;
    }
  }

  const updatePriority = (candidate: CandidateRow): number => {
    const type = candidate.signal_type.toLowerCase();
    if (type === "risk") return 0;
    if (type === "process_issue") return 1;
    return 2;
  };
  updates.sort(
    (a, b) =>
      updatePriority(a) - updatePriority(b) ||
      (b.confidence_score ?? 0) - (a.confidence_score ?? 0),
  );

  const toItem = (candidate: CandidateRow): BrandonBriefItem =>
    candidateToBriefItem(
      candidate,
      candidate.project_id != null
        ? (projectNames.get(candidate.project_id) ?? null)
        : null,
    );

  return {
    needsBrandon: decisions.map(toItem),
    waitingOnOthers: tasks.slice(0, MAX_WAITING).map(toItem),
    importantUpdates: updates.slice(0, MAX_UPDATES).map(toItem),
  };
}
