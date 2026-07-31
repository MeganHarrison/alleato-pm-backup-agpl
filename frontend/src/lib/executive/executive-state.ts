/**
 * Canonical Executive State seam.
 *
 * Executive readers must consume this adapter instead of quietly composing
 * page-local packet, finance, project-state, or delivery queries. It is
 * deliberately read-only and backend-neutral: each input retains its existing
 * canonical owner and the adapter exposes the authority/freshness/evidence
 * contract needed to decide whether the assembled state is safe to present.
 *
 * Attention and conflict lifecycle records are intentionally absent. AAI-1097
 * owns that bounded domain and its tables; adding them here would create a
 * second owner before that contract exists.
 */
import { loadCurrentDailyExecutiveBriefPacket, type CanonicalDailyBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import { serviceDb } from "@/lib/supabase/service-db";
import { loadFinancialPulse, type FinancialPulseData } from "./financial-pulse";

export type ExecutiveAuthority = "authoritative" | "derived" | "delivery_receipt";
export type ExecutiveFreshness = "fresh" | "stale" | "partial" | "unknown";

export type ExecutiveStateInput = {
  id: "canonical_packet" | "project_operating_record" | "financial_truth" | "derived_schedule_read" | "delivery_receipts";
  /** Stable identifiers for the source records behind this seam. */
  sourceIds: string[];
  canonicalSource: string;
  authority: ExecutiveAuthority;
  readOwner: string;
  freshness: ExecutiveFreshness;
  evidenceCount: number;
  required: boolean;
};

export type ExecutiveStateDiagnostic = {
  code: "attention_conflicts_deferred" | "no_delivery_receipt";
  severity: "info" | "warning";
  message: string;
  owner: string;
};

export type ExecutiveProjectState = {
  projectId: number;
  healthStatus: string;
  currentSummary: string | null;
  scheduleRead: string | null;
  financialRead: string | null;
  updatedAt: string;
  projectionWriter: string | null;
  projectionGeneratedAt: string | null;
  projectionEnvelopeId: string | null;
  projectionProvenance: Record<string, unknown>;
};

export type ExecutiveDeliveryReceipt = {
  id: string;
  status: string;
  channel: string;
  attemptedAt: string;
};

export type CanonicalExecutiveState = {
  state: "ready";
  generatedAt: string;
  packet: CanonicalDailyBriefPacket;
  projects: ExecutiveProjectState[];
  financial: FinancialPulseData;
  deliveryReceipts: ExecutiveDeliveryReceipt[];
  inputs: ExecutiveStateInput[];
  diagnostics: ExecutiveStateDiagnostic[];
};

export class ExecutiveStateIntegrityError extends Error {
  readonly failures: string[];

  constructor(failures: string[]) {
    super(`Executive state integrity failure: ${failures.join("; ")}`);
    this.name = "ExecutiveStateIntegrityError";
    this.failures = failures;
  }
}

type ComposeExecutiveStateInput = Omit<CanonicalExecutiveState, "state" | "inputs" | "diagnostics"> & {
  inputs: ExecutiveStateInput[];
};

function packetFreshness(value: string | null): ExecutiveFreshness {
  if (value === "fresh") return "fresh";
  if (value === "stale" || value === "failed") return "stale";
  if (value === "partial" || value === "working_sample") return "partial";
  return "unknown";
}

/** Validate input ownership before any executive surface can consume it. */
export function validateExecutiveStateInputs(inputs: ExecutiveStateInput[]): void {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const input of inputs) {
    if (ids.has(input.id)) failures.push(`duplicate input owner for ${input.id}`);
    ids.add(input.id);
    if (!input.canonicalSource) failures.push(`missing canonical source for ${input.id}`);
    if (!input.readOwner) failures.push(`missing read owner for ${input.id}`);
    if (input.required && input.sourceIds.length === 0) {
      failures.push(`required ${input.id} has no source identifiers`);
    }
    if (input.required && input.freshness !== "fresh") {
      failures.push(`required ${input.id} is ${input.freshness}`);
    }
    if (input.required && input.evidenceCount < 1) {
      failures.push(`required ${input.id} has no evidence`);
    }
  }
  if (failures.length) throw new ExecutiveStateIntegrityError(failures);
}

/**
 * Pure composition boundary for consumers and tests. The caller provides values
 * from existing owners; this function never invents state or hides a broken
 * authority/freshness/evidence contract.
 */
export function composeCanonicalExecutiveState(
  input: ComposeExecutiveStateInput,
): CanonicalExecutiveState {
  validateExecutiveStateInputs(input.inputs);
  return {
    state: "ready",
    ...input,
    diagnostics: [
      {
        code: "attention_conflicts_deferred",
        severity: "info",
        owner: "AAI-1097",
        message: "Executive attention and conflict lifecycle records are deferred to AAI-1097; this state seam does not read them.",
      },
      ...(input.deliveryReceipts.length === 0
        ? [{
            code: "no_delivery_receipt" as const,
            severity: "warning" as const,
            owner: "public.ai_work_run_delivery_attempts",
            message: "No delivery receipt is available for this read; content is canonical but delivery is unproven.",
          }]
        : []),
    ],
  };
}

/** Load the canonical state from existing owners. No attention/conflict reads. */
export async function loadCanonicalExecutiveState(): Promise<CanonicalExecutiveState> {
  const [packet, financialResult, projectsResult] = await Promise.all([
    loadCurrentDailyExecutiveBriefPacket(),
    loadFinancialPulse(),
    serviceDb.from("project_current_state")
      .select("project_id,health_status,current_summary,schedule_read,financial_read,updated_at,projection_writer,projection_generated_at,projection_envelope_id,projection_provenance")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  if (projectsResult.error) {
    throw new ExecutiveStateIntegrityError([`project operating record read failed: ${projectsResult.error.message}`]);
  }
  // A delivery receipt is evidence only when its artifact points at this exact
  // current packet. Global "latest delivery" rows are deliberately excluded:
  // they cannot prove this executive packet reached a recipient.
  const { data: artifactRows, error: artifactError } = await serviceDb
    .from("ai_work_run_artifacts")
    .select("id,work_run_id")
    .eq("storage_table", "intelligence_packets")
    .eq("storage_id", packet.id)
    .limit(50);
  if (artifactError) {
    throw new ExecutiveStateIntegrityError([`packet delivery artifact read failed: ${artifactError.message}`]);
  }
  const artifactIds = (artifactRows ?? []).map((artifact) => artifact.id);
  const { data: deliveryRows, error: deliveryError } = artifactIds.length
    ? await serviceDb.from("ai_work_run_delivery_attempts")
      .select("id,status,channel,attempted_at,artifact_id,work_run_id")
      .in("artifact_id", artifactIds)
      .in("status", ["sent", "delivered"])
      .order("attempted_at", { ascending: false })
      .limit(25)
    : { data: [], error: null };
  if (deliveryError) {
    throw new ExecutiveStateIntegrityError([`packet delivery receipt read failed: ${deliveryError.message}`]);
  }

  const projects = (projectsResult.data ?? []).map((row) => ({
    projectId: row.project_id,
    healthStatus: row.health_status,
    currentSummary: row.current_summary,
    scheduleRead: row.schedule_read,
    financialRead: row.financial_read,
    updatedAt: row.updated_at,
    projectionWriter: row.projection_writer,
    projectionGeneratedAt: row.projection_generated_at,
    projectionEnvelopeId: row.projection_envelope_id,
    projectionProvenance: (row.projection_provenance && typeof row.projection_provenance === "object" && !Array.isArray(row.projection_provenance) ? row.projection_provenance : {}) as Record<string, unknown>,
  }));
  const deliveryReceipts = (deliveryRows ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    channel: row.channel,
    attemptedAt: row.attempted_at,
  }));
  const financialFreshness: ExecutiveFreshness = financialResult.warnings.length ? "partial" : "fresh";

  return composeCanonicalExecutiveState({
    generatedAt: packet.generatedAt ?? new Date(0).toISOString(),
    packet,
    projects,
    financial: financialResult,
    deliveryReceipts,
    inputs: [
      {
        id: "canonical_packet",
        sourceIds: [packet.id],
        canonicalSource: "public.intelligence_packets / daily-executive-brief current packet",
        authority: "authoritative",
        readOwner: "loadCurrentDailyExecutiveBriefPacket",
        freshness: packetFreshness(packet.freshnessStatus),
        evidenceCount: packet.sourceCount,
        required: true,
      },
      {
        id: "project_operating_record",
        sourceIds: projects.map((project) => String(project.projectId)),
        canonicalSource: "public.project_current_state / controlled projection RPC",
        authority: "derived",
        readOwner: "loadCanonicalExecutiveState",
        freshness: projects.length ? "fresh" : "partial",
        evidenceCount: projects.length,
        required: true,
      },
      {
        id: "financial_truth",
        sourceIds: [
          ...financialResult.arByProject.map((project) => String(project.projectId)),
          ...financialResult.pendingCOsByProject.map((project) => String(project.projectId)),
        ],
        canonicalSource: "Acumatica-backed PM tables through loadFinancialPulse",
        authority: "authoritative",
        readOwner: "loadFinancialPulse",
        freshness: financialFreshness,
        evidenceCount: financialResult.arByProject.length + financialResult.pendingCOsByProject.length,
        required: false,
      },
      {
        id: "derived_schedule_read",
        sourceIds: projects.filter((project) => project.scheduleRead).map((project) => String(project.projectId)),
        canonicalSource: "Derived public.project_current_state.schedule_read (not authoritative schedule truth)",
        authority: "derived",
        readOwner: "loadCanonicalExecutiveState",
        freshness: projects.some((project) => project.scheduleRead) ? "fresh" : "partial",
        evidenceCount: projects.filter((project) => project.scheduleRead).length,
        required: false,
      },
      {
        id: "delivery_receipts",
        sourceIds: deliveryReceipts.map((receipt) => receipt.id),
        canonicalSource: "public.ai_work_run_delivery_attempts joined through an artifact whose storage_id equals the current packet id",
        authority: "delivery_receipt",
        readOwner: "loadCanonicalExecutiveState",
        freshness: deliveryReceipts.length ? "fresh" : "unknown",
        evidenceCount: deliveryReceipts.length,
        required: false,
      },
    ],
  });
}
