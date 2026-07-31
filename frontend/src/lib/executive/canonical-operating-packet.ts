// Builds the executive operating packet (the shape /executive consumes) from the
// CANONICAL Daily Executive Brief — the gpt-5.5 deep-read stored in
// `intelligence_packets` plus its structured `source_signal_candidates`.
//
// This replaces the retired `daily_recaps` brief generator. There is now exactly
// ONE brief pipeline: the intelligence deep-read. The /executive dashboard's
// structured cards (owner decisions, risk radar, waiting-on, by-project) are
// hydrated from the deep-read's structured signal candidates; the financial
// tiles come from the same Acumatica reader as before (`loadFinancialPulse`).

import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { resolveProjectNames } from "@/lib/intelligence/content-source";
import {
  loadCurrentDailyExecutiveBriefPacket,
  type CanonicalDailyBriefPacket,
} from "@/lib/daily-briefs/canonical-packets";
import { loadFinancialPulse } from "./financial-pulse";
import {
  DEFAULT_EXECUTIVE_WINDOW_DAYS,
  type BrandonBriefSourceCoverage,
  type BrandonDailyUpdatePacket,
} from "./brandon-daily-update";
import {
  routeCandidatesToSections,
  type CandidateRow,
} from "./canonical-operating-packet-map";

export {
  routeCandidatesToSections,
  type CandidateRow,
} from "./canonical-operating-packet-map";

/** The deep-read consumer that writes structured candidates for the brief. */
const DAILY_DEEP_READ_COMPILER = "daily_deep_read_consumers_v1";

/** Candidate statuses that should never surface on the live dashboard. */
const HIDDEN_CANDIDATE_STATUSES = new Set([
  "dismissed",
  "rejected",
  "resolved",
  "superseded",
  "archived",
]);

/**
 * Load the structured signal candidates that belong to the current brief window,
 * deduped by their stable signal key (keeping the highest-confidence instance).
 */
async function loadBriefSignalCandidates(
  coveredStartAt: string | null,
  coveredEndAt: string | null,
): Promise<CandidateRow[]> {
  const rag = createRagServiceClient();
  let query = rag
    .from("source_signal_candidates")
    .select(
      "id,signal_type,title,summary,why_it_matters,next_action,project_id,suggested_owner_label,current_status,status,confidence,confidence_score,source_document_id,source_occurred_at,normalized_signal_key",
    )
    .eq("compiler_version", DAILY_DEEP_READ_COMPILER)
    .order("confidence_score", { ascending: false })
    .limit(400);

  // Bound to the same window the canonical brief covers, when known.
  if (coveredStartAt) query = query.gte("source_occurred_at", coveredStartAt);
  if (coveredEndAt) query = query.lte("source_occurred_at", coveredEndAt);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load Daily Brief signal candidates: ${error.message}`);
  }

  const rows = (data ?? []) as CandidateRow[];
  const visible = rows.filter(
    (row) => !HIDDEN_CANDIDATE_STATUSES.has((row.status ?? "").toLowerCase()),
  );

  // Dedup by normalized signal key — the same signal recurs across days.
  const seen = new Map<string, CandidateRow>();
  const byConfidenceDesc = (a: CandidateRow, b: CandidateRow): number =>
    (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
  for (const row of visible.sort(byConfidenceDesc)) {
    const key = row.normalized_signal_key || row.id;
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}

function buildSourceCoverage(
  packet: CanonicalDailyBriefPacket,
): BrandonBriefSourceCoverage[] {
  const laneToLabel: Record<string, BrandonBriefSourceCoverage["label"]> = {
    emails: "Email",
    email: "Email",
    teams: "Teams",
    meetings: "Meeting",
    meeting: "Meeting",
    documents: "Document",
    document: "Document",
  };
  const latest = packet.generatedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      }).format(new Date(packet.generatedAt))
    : "";
  const coverage: BrandonBriefSourceCoverage[] = [];
  for (const [lane, count] of Object.entries(packet.sourceCounts)) {
    const label = laneToLabel[lane.toLowerCase()];
    if (!label) continue;
    coverage.push({
      label,
      detail: `Recent ${label.toLowerCase()} evidence`,
      count,
      latest,
      status: count > 0 ? "loaded" : "empty",
    });
  }
  return coverage;
}

/**
 * Build the operating packet the /executive dashboard consumes, sourced entirely
 * from the canonical intelligence brief. `hydrateExecutiveOperatingBrief` derives
 * the full operating brief (Start Here, risk radar, focus, waiting-on) from these
 * `sections`, so producing well-routed sections is all the dashboard needs.
 */
export async function buildCanonicalOperatingPacket(
  canonicalOverride?: CanonicalDailyBriefPacket,
): Promise<BrandonDailyUpdatePacket> {
  const canonical =
    canonicalOverride ?? (await loadCurrentDailyExecutiveBriefPacket());
  const [candidates, financialPulse] = await Promise.all([
    loadBriefSignalCandidates(canonical.coveredStartAt, canonical.coveredEndAt),
    loadFinancialPulse().catch(() => undefined),
  ]);

  const projectNames = await resolveProjectNames(
    createServiceClient(),
    candidates.map((candidate) => candidate.project_id),
  );

  const { needsBrandon, waitingOnOthers, importantUpdates } =
    routeCandidatesToSections(candidates, projectNames);

  return {
    generatedAt: canonical.generatedAt ?? new Date(0).toISOString(),
    windowDays: DEFAULT_EXECUTIVE_WINDOW_DAYS,
    canonicalName: "Daily Brief",
    audiencePreset: "brandon",
    retrievalOrder: [],
    retrievalNotes: [],
    sections: { needsBrandon, waitingOnOthers, importantUpdates },
    financialPulse,
    sourceCoverage: buildSourceCoverage(canonical),
  };
}
