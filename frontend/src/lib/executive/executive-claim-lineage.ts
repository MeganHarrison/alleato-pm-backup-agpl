import "server-only";

import { loadDailyExecutiveBriefPacketById, type DailyBriefSourceRef } from "@/lib/daily-briefs/canonical-packets";
import { loadCanonicalExecutiveState, type CanonicalExecutiveState } from "./executive-state";
import { loadExecutiveConflictFeed, type ExecutiveConflictClaim, type ExecutiveConflictItem } from "./executive-conflicts";

export type ExecutiveLineageStage = {
  id: "source" | "event" | "fact_or_signal" | "authority_policy" | "projection" | "decision_or_artifact";
  title: string;
  owner: string;
  status: "ready";
  updatedAt: string | null;
  evidenceId: string;
  detail: string;
  href: string | null;
};

export type ExecutiveClaimLineage = { state: "ready"; claimId: string; claimLabel: string; stages: ExecutiveLineageStage[] };
export type ExecutiveClaimLineageUnavailable = { state: "lineage_unavailable"; claimId: string; missingStage: ExecutiveLineageStage["id"]; owner: string; recoveryPath: string; message: string };
export type ExecutiveClaimLineageResult = ExecutiveClaimLineage | ExecutiveClaimLineageUnavailable;

function unavailable(claimId: string, missingStage: ExecutiveLineageStage["id"], owner: string, recoveryPath: string): ExecutiveClaimLineageUnavailable {
  return { state: "lineage_unavailable", claimId, missingStage, owner, recoveryPath, message: `Lineage unavailable: ${missingStage.replaceAll("_", " ")}. Owner: ${owner}. Recovery: ${recoveryPath}` };
}

function findClaim(feed: Awaited<ReturnType<typeof loadExecutiveConflictFeed>>, claimId: string): { claim: ExecutiveConflictClaim; conflict: ExecutiveConflictItem } | null {
  for (const conflict of feed.conflicts) {
    const claim = conflict.claims.find((item) => item.id === claimId);
    if (claim) return { claim, conflict };
  }
  return null;
}

function sourceForClaim(sources: DailyBriefSourceRef[], claim: ExecutiveConflictClaim): DailyBriefSourceRef | null {
  const matches = sources.filter((source) => source.id === claim.sourceId);
  return matches.length === 1 ? matches[0] : null;
}

function projectionForSource(state: CanonicalExecutiveState, source: DailyBriefSourceRef) {
  if (source.projectId === null) return null;
  return state.projects.find((project) => project.projectId === source.projectId) ?? null;
}

/**
 * The sole claim-explanation read adapter. It only joins stable, existing
 * records from the canonical packet/state seam and AAI-1103's conflict feed.
 */
export async function loadExecutiveClaimLineage(briefId: string, claimId: string): Promise<ExecutiveClaimLineageResult> {
  const [packet, state, feed] = await Promise.all([loadDailyExecutiveBriefPacketById(briefId), loadCanonicalExecutiveState(), loadExecutiveConflictFeed()]);
  if (!packet) return unavailable(claimId, "source", "Daily Brief compiler owner", "Restore the canonical packet or open a valid Daily Brief.");
  if (feed.canonicalPacket.id !== briefId) return unavailable(claimId, "authority_policy", "Executive conflict resolver", "Open the current canonical Daily Brief before requesting a controlled claim explanation.");
  const found = findClaim(feed, claimId);
  if (!found) return unavailable(claimId, "fact_or_signal", "Executive conflict resolver", "Restore the immutable claim record through the controlled conflict workflow.");
  const source = sourceForClaim(packet.sources, found.claim);
  if (!source) return unavailable(claimId, "source", "Source/AI ops owner", "Restore the one immutable source-manifest link for this claim.");
  // The immutable source manifest is the recorded event occurrence. We never
  // invent a separate event id when a source/event linkage is missing.
  if (!source.sourceAt) return unavailable(claimId, "event", "Source/AI ops owner", "Restore the immutable source occurrence time in the packet manifest.");
  if (!found.claim.statement || !found.claim.sourceHash) return unavailable(claimId, "fact_or_signal", "Source/AI ops owner", "Restore the persisted claim statement and immutable source hash.");
  if (found.claim.authority === "unknown" || found.claim.freshness === "unknown") return unavailable(claimId, "authority_policy", "Executive conflict resolver", "Record authority and freshness from the canonical evidence; do not infer them in the UI.");
  const projection = projectionForSource(state, source);
  if (!projection || !projection.projectionWriter || !projection.projectionGeneratedAt || !projection.projectionEnvelopeId) return unavailable(claimId, "projection", "Projection owner", "Repair or replay the controlled project_current_state projection with provenance.");
  const decision = found.conflict.history.find((entry) => entry.action === "resolved") ?? null;
  if (!decision) return unavailable(claimId, "decision_or_artifact", "Executive conflict resolver", "Resolve the authoritative conflict through the controlled human workflow, or retain it as open.");

  return {
    state: "ready", claimId, claimLabel: found.claim.label,
    stages: [
      { id: "source", title: "Immutable source", owner: "Daily Brief source manifest", status: "ready", updatedAt: source.sourceAt, evidenceId: source.id, detail: `${source.title} · ${source.lane}`, href: source.url },
      { id: "event", title: "Recorded event", owner: "Daily Brief source manifest", status: "ready", updatedAt: source.sourceAt, evidenceId: source.id, detail: "Immutable source occurrence linked to this claim", href: source.url },
      { id: "fact_or_signal", title: "Fact or signal", owner: "AAI-1097 executive claim", status: "ready", updatedAt: found.claim.assertedAt, evidenceId: found.claim.id, detail: found.claim.statement, href: found.claim.sourceUrl },
      { id: "authority_policy", title: "Authority policy", owner: found.conflict.resolver, status: "ready", updatedAt: decision.createdAt, evidenceId: found.conflict.id, detail: `${found.claim.authority} authority · ${found.claim.freshness} evidence · ${found.conflict.status}`, href: null },
      { id: "projection", title: "Controlled projection", owner: projection.projectionWriter, status: "ready", updatedAt: projection.projectionGeneratedAt, evidenceId: projection.projectionEnvelopeId, detail: "project_current_state provenance through the controlled projection owner", href: null },
      { id: "decision_or_artifact", title: "Human decision", owner: decision.actorLabel, status: "ready", updatedAt: decision.createdAt, evidenceId: decision.id, detail: found.conflict.resolutionSummary ?? decision.rationale, href: null },
    ],
  };
}
