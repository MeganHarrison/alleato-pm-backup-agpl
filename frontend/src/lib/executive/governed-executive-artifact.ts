import "server-only";

import type { Json } from "@/types/database.types";
import { loadCurrentDailyExecutiveBriefPacket, type CanonicalDailyBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import { createServiceClient } from "@/lib/supabase/service";

import { loadExecutiveConflictFeed, type ExecutiveConflictFeed } from "./executive-conflicts";
import { ExecutiveStateIntegrityError, loadCanonicalExecutiveState, type CanonicalExecutiveState } from "./executive-state";
import { evaluateExecutiveArtifactIntegrity, governedArtifactSnapshotHash, type ExecutiveArtifactIntegrity } from "./governed-executive-artifact-integrity";

export type ExecutiveArtifactKind = "daily" | "weekly" | "monthly";
export type { ExecutiveArtifactIntegrity } from "./governed-executive-artifact-integrity";

export type ExecutiveArtifactDelivery = {
  artifactIds: string[];
  deliveryAttemptIds: string[];
  deliveredCount: number;
  pendingCount: number;
};

type PersistedVersion = {
  id: string;
  issued_at: string;
  integrity_status: ExecutiveArtifactIntegrity;
  source_assessment: Json;
  state_snapshot: Json;
  attention_snapshot: Json;
  conflict_snapshot: Json;
};

export type GovernedExecutiveArtifact = {
  id: string;
  kind: ExecutiveArtifactKind;
  issuedAt: string;
  packet: CanonicalDailyBriefPacket;
  integrity: ExecutiveArtifactIntegrity;
  failures: string[];
  sourceAssessment: Record<string, unknown>;
  state: CanonicalExecutiveState | null;
  executive: ExecutiveConflictFeed | null;
  delivery: ExecutiveArtifactDelivery;
};

function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function assessment(
  state: CanonicalExecutiveState | null,
  executive: ExecutiveConflictFeed | null,
  integrity: ExecutiveArtifactIntegrity,
  failures: string[],
): Record<string, unknown> {
  return {
    integrity,
    failures,
    inputs: state?.inputs ?? [],
    attentionCount: executive?.attention.length ?? 0,
    openAttentionCount: executive?.attention.filter((item) => !["resolved", "dismissed"].includes(item.lifecycle)).length ?? 0,
    openConflictCount: executive?.conflicts.filter((item) => item.status === "open").length ?? 0,
    assessedAt: new Date().toISOString(),
  };
}

async function deliveryForPacket(packetId: string): Promise<ExecutiveArtifactDelivery> {
  const db = createServiceClient();
  const { data: artifacts, error: artifactError } = await db
    .from("ai_work_run_artifacts")
    .select("id")
    .eq("storage_table", "intelligence_packets")
    .eq("storage_id", packetId);
  if (artifactError) throw new Error(`Executive artifact delivery read failed: ${artifactError.message}`);
  const artifactIds = (artifacts ?? []).map((artifact) => artifact.id);
  if (!artifactIds.length) return { artifactIds: [], deliveryAttemptIds: [], deliveredCount: 0, pendingCount: 0 };
  const { data: attempts, error: attemptError } = await db
    .from("ai_work_run_delivery_attempts")
    .select("id,status")
    .in("artifact_id", artifactIds);
  if (attemptError) throw new Error(`Executive artifact delivery attempt read failed: ${attemptError.message}`);
  const rows = attempts ?? [];
  return {
    artifactIds,
    deliveryAttemptIds: rows.map((attempt) => attempt.id),
    deliveredCount: rows.filter((attempt) => ["sent", "delivered"].includes(attempt.status)).length,
    pendingCount: rows.filter((attempt) => !["sent", "delivered", "failed", "disabled"].includes(attempt.status)).length,
  };
}

async function persistVersion(input: {
  kind: ExecutiveArtifactKind;
  packetId: string;
  integrity: ExecutiveArtifactIntegrity;
  sourceAssessment: Record<string, unknown>;
  state: CanonicalExecutiveState | null;
  executive: ExecutiveConflictFeed | null;
  snapshotHash: string;
}): Promise<PersistedVersion> {
  const db = createServiceClient();
  const { data: existing, error: existingError } = await db
    .from("executive_artifact_versions")
    .select("id,issued_at,integrity_status,source_assessment,state_snapshot,attention_snapshot,conflict_snapshot")
    .eq("artifact_kind", input.kind)
    .eq("packet_id", input.packetId)
    .eq("snapshot_hash", input.snapshotHash)
    .maybeSingle();
  if (existingError) throw new Error(`Executive artifact version read failed: ${existingError.message}`);
  if (existing) return existing as PersistedVersion;

  const { data, error } = await db
    .from("executive_artifact_versions")
    .insert({
      artifact_kind: input.kind,
      packet_id: input.packetId,
      snapshot_hash: input.snapshotHash,
      integrity_status: input.integrity,
      source_assessment: json(input.sourceAssessment),
      state_snapshot: json(input.state ?? {}),
      attention_snapshot: json(input.executive?.attention ?? []),
      conflict_snapshot: json(input.executive?.conflicts ?? []),
    })
    .select("id,issued_at,integrity_status,source_assessment,state_snapshot,attention_snapshot,conflict_snapshot")
    .single();
  if (!error && data) return data as PersistedVersion;
  // A concurrent reader may have issued the same immutable packet version.
  const { data: raced, error: racedError } = await db
    .from("executive_artifact_versions")
    .select("id,issued_at,integrity_status,source_assessment,state_snapshot,attention_snapshot,conflict_snapshot")
    .eq("artifact_kind", input.kind)
    .eq("packet_id", input.packetId)
    .eq("snapshot_hash", input.snapshotHash)
    .single();
  if (racedError || !raced) throw new Error(`Executive artifact version issue failed: ${error?.message ?? racedError?.message ?? "unknown failure"}`);
  return raced as PersistedVersion;
}

function record(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function persistedArtifact(input: {
  version: PersistedVersion;
  kind: ExecutiveArtifactKind;
  packet: CanonicalDailyBriefPacket;
  delivery: ExecutiveArtifactDelivery;
  fallbackState: CanonicalExecutiveState | null;
  fallbackExecutive: ExecutiveConflictFeed | null;
  fallbackFailures: string[];
}): GovernedExecutiveArtifact {
  const savedState = record(input.version.state_snapshot);
  const savedAttention = Array.isArray(input.version.attention_snapshot) ? input.version.attention_snapshot : [];
  const savedConflicts = Array.isArray(input.version.conflict_snapshot) ? input.version.conflict_snapshot : [];
  const savedAssessment = record(input.version.source_assessment);
  const savedFailures = Array.isArray(savedAssessment.failures)
    ? savedAssessment.failures.filter((failure): failure is string => typeof failure === "string")
    : input.fallbackFailures;
  const state = Object.keys(savedState).length ? savedState as unknown as CanonicalExecutiveState : input.fallbackState;
  const executive = input.fallbackExecutive && (savedAttention.length || savedConflicts.length)
    ? { ...input.fallbackExecutive, attention: savedAttention as ExecutiveConflictFeed["attention"], conflicts: savedConflicts as ExecutiveConflictFeed["conflicts"] }
    : input.fallbackExecutive;
  return {
    id: input.version.id,
    kind: input.kind,
    issuedAt: input.version.issued_at,
    packet: input.packet,
    integrity: input.version.integrity_status,
    failures: savedFailures,
    sourceAssessment: savedAssessment,
    state,
    executive,
    // Explicitly current packet-correlated ledger scope; receipt append is not
    // part of the immutable action snapshot and never changes its version id.
    delivery: input.delivery,
  };
}

/**
 * Single governed delivery adapter for Daily and Weekly executive artifacts.
 * It snapshots current state once per immutable packet/version and never lets a
 * route compose raw executive-domain tables or disguise failed input health.
 */
export async function loadGovernedExecutiveArtifact(kind: ExecutiveArtifactKind): Promise<GovernedExecutiveArtifact> {
  const packet = await loadCurrentDailyExecutiveBriefPacket();
  let state: CanonicalExecutiveState | null = null;
  let executive: ExecutiveConflictFeed | null = null;
  let integrity: ExecutiveArtifactIntegrity = "ready";
  let failures: string[] = [];

  try {
    [state, executive] = await Promise.all([loadCanonicalExecutiveState(), loadExecutiveConflictFeed()]);
    if (state.packet.id !== packet.id || executive.canonicalPacket.id !== packet.id) {
      failures = ["The canonical packet changed while the governed state was being read. Refresh to issue a coherent version."];
      integrity = "limited";
    } else {
      ({ integrity, failures } = evaluateExecutiveArtifactIntegrity(state, executive));
    }
  } catch (error) {
    failures = error instanceof ExecutiveStateIntegrityError
      ? error.failures
      : [error instanceof Error ? error.message : String(error)];
    integrity = "blocked";
  }

  const sourceAssessment = assessment(state, executive, integrity, failures);
  const snapshotHash = governedArtifactSnapshotHash({ state, executive, artifactKind: kind });
  const [version, delivery] = await Promise.all([
    persistVersion({ kind, packetId: packet.id, integrity, sourceAssessment, state, executive, snapshotHash }),
    deliveryForPacket(packet.id),
  ]);
  return persistedArtifact({ version, kind, packet, delivery, fallbackState: state, fallbackExecutive: executive, fallbackFailures: failures });
}
