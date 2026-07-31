import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

import { isExecutiveConflictActionable, loadExecutiveConflictFeed, type ExecutiveConflictFeed } from "./executive-conflicts";
import { loadCanonicalExecutiveState, type CanonicalExecutiveState, type ExecutiveFreshness, type ExecutiveProjectState } from "./executive-state";
import { isExecutiveAttentionActionable } from "./executive-attention";

export type ExecutivePortfolioCoverageState = "ready" | "limited";

export type ExecutivePortfolioLimitedReason = {
  code: "missing_controlled_projection" | "incomplete_projection_provenance" | "missing_packet_evidence";
  owner: string;
  recoveryPath: string;
};

export type ExecutivePortfolioProject = {
  projectId: number;
  projectName: string;
  phase: "Current";
  coverage: ExecutivePortfolioCoverageState;
  freshness: ExecutiveFreshness;
  sourceEvidenceCount: number;
  healthStatus: string | null;
  projection: Pick<ExecutiveProjectState, "updatedAt" | "projectionWriter" | "projectionGeneratedAt" | "projectionEnvelopeId"> | null;
  openAttentionIds: string[];
  openConflictIds: string[];
  limitedReasons: ExecutivePortfolioLimitedReason[];
};

export type ExecutivePortfolioState = {
  governedArtifactVersionId: string | null;
  canonicalPacket: { id: string; generatedAt: string; freshness: ExecutiveFreshness };
  eligibility: { owner: "public.projects"; criteria: "archived = false and phase = Current" };
  projects: ExecutivePortfolioProject[];
  summary: { eligibleProjectCount: number; readyProjectCount: number; limitedProjectCount: number; openAttentionCount: number; openConflictCount: number; portfolioAttentionIds: string[]; portfolioConflictIds: string[] };
};

type EligibleProject = { id: number; name: string | null; phase: string | null };


function sourceProjectIds(state: CanonicalExecutiveState, sourceId: string): number[] {
  return state.packet.sources.filter((source) => source.id === sourceId && source.projectId !== null).map((source) => source.projectId as number);
}

function attentionProjectIds(state: CanonicalExecutiveState, executive: ExecutiveConflictFeed, attentionId: string): number[] {
  const attention = executive.attention.find((item) => item.id === attentionId);
  if (!attention) return [];
  if (typeof attention.projectId === "number") return [attention.projectId];
  return [...new Set(attention.evidence.flatMap((evidence) => sourceProjectIds(state, evidence.sourceId)))];
}

function conflictProjectIds(state: CanonicalExecutiveState, conflict: ExecutiveConflictFeed["conflicts"][number]): number[] {
  if (typeof conflict.projectId === "number") return [conflict.projectId];
  return [...new Set(conflict.claims.flatMap((claim) => sourceProjectIds(state, claim.sourceId)))];
}

function projectCoverage(project: EligibleProject, state: CanonicalExecutiveState, executive: ExecutiveConflictFeed): ExecutivePortfolioProject {
  const projection = state.projects.find((item) => item.projectId === project.id) ?? null;
  const evidence = state.packet.sources.filter((source) => source.projectId === project.id);
  const openAttention = executive.attention.filter((item) => isExecutiveAttentionActionable(item.lifecycle));
  const openConflicts = executive.conflicts.filter((item) => isExecutiveConflictActionable(item.status));
  const openAttentionIds = openAttention.filter((attention) => attentionProjectIds(state, executive, attention.id).includes(project.id)).map((attention) => attention.id);
  const openConflictIds = openConflicts.filter((conflict) => conflictProjectIds(state, conflict).includes(project.id)).map((conflict) => conflict.id);
  const limitedReasons: ExecutivePortfolioLimitedReason[] = [];
  if (!projection) limitedReasons.push({ code: "missing_controlled_projection", owner: "Projection owner", recoveryPath: "Repair or replay the controlled project_current_state projection; never write state from the portfolio view." });
  else if (!projection.projectionWriter || !projection.projectionGeneratedAt || !projection.projectionEnvelopeId) limitedReasons.push({ code: "incomplete_projection_provenance", owner: "Projection owner", recoveryPath: "Restore projection writer, generated-at time, and envelope provenance through the controlled projection owner." });
  if (!evidence.length) limitedReasons.push({ code: "missing_packet_evidence", owner: "Daily Brief compiler owner", recoveryPath: "Restore canonical packet source coverage for this eligible project; do not infer project evidence in the UI." });
  const coverage = limitedReasons.length ? "limited" : "ready";
  return {
    projectId: project.id,
    projectName: project.name?.trim() || `Project ${project.id}`,
    phase: "Current",
    coverage,
    freshness: coverage === "ready" ? "fresh" : projection ? "partial" : "unknown",
    sourceEvidenceCount: evidence.length,
    healthStatus: projection?.healthStatus ?? null,
    projection: projection ? { updatedAt: projection.updatedAt, projectionWriter: projection.projectionWriter, projectionGeneratedAt: projection.projectionGeneratedAt, projectionEnvelopeId: projection.projectionEnvelopeId } : null,
    openAttentionIds,
    openConflictIds,
    limitedReasons,
  };
}

/**
 * The only portfolio-wide executive-state reader. Eligibility is intentionally
 * owned by public.projects while each project's operating fields remain owned
 * by the published state/evidence/attention/conflict contracts. Missing
 * coverage is returned as a visible limitation, never silently filtered out.
 */
export async function loadExecutivePortfolioState(snapshot?: { state: CanonicalExecutiveState | null; executive: ExecutiveConflictFeed | null; governedArtifactVersionId?: string }): Promise<ExecutivePortfolioState> {
  const db = createServiceClient();
  const eligiblePromise = db.from("projects").select("id,name,phase").eq("archived", false).eq("phase", "Current").order("name", { ascending: true });
  const [eligibleResult, liveState, liveExecutive] = snapshot
    ? await Promise.all([eligiblePromise, Promise.resolve(snapshot.state), Promise.resolve(snapshot.executive)])
    : await Promise.all([eligiblePromise, loadCanonicalExecutiveState(), loadExecutiveConflictFeed()]);
  const state = liveState;
  const executive = liveExecutive;
  if (eligibleResult.error) throw new Error(`Executive portfolio eligibility read failed: ${eligibleResult.error.message}`);
  if (!state || !executive) throw new Error("Executive portfolio state is unavailable because the governed artifact lacks its canonical state or controlled action snapshot. Reissue the governed artifact after repairing its source owner.");
  if (state.packet.id !== executive.canonicalPacket.id) throw new Error("Executive portfolio state is unavailable because the canonical packet changed while coverage was being read. Refresh and retry.");
  const projects = (eligibleResult.data as EligibleProject[] ?? []).map((project) => projectCoverage(project, state, executive));
  const openAttention = executive.attention.filter((item) => isExecutiveAttentionActionable(item.lifecycle));
  const openConflicts = executive.conflicts.filter((item) => isExecutiveConflictActionable(item.status));
  const scopedAttention = new Set(projects.flatMap((project) => project.openAttentionIds));
  const scopedConflicts = new Set(projects.flatMap((project) => project.openConflictIds));
  return {
    governedArtifactVersionId: snapshot?.governedArtifactVersionId ?? null,
    canonicalPacket: { id: state.packet.id, generatedAt: state.generatedAt, freshness: state.inputs.find((input) => input.id === "canonical_packet")?.freshness ?? "unknown" },
    eligibility: { owner: "public.projects", criteria: "archived = false and phase = Current" },
    projects,
    summary: {
      eligibleProjectCount: projects.length,
      readyProjectCount: projects.filter((project) => project.coverage === "ready").length,
      limitedProjectCount: projects.filter((project) => project.coverage === "limited").length,
      openAttentionCount: openAttention.length,
      openConflictCount: openConflicts.length,
      portfolioAttentionIds: openAttention.filter((attention) => !scopedAttention.has(attention.id)).map((attention) => attention.id),
      portfolioConflictIds: openConflicts.filter((conflict) => !scopedConflicts.has(conflict.id)).map((conflict) => conflict.id),
    },
  };
}

export const __testables = { projectCoverage };
