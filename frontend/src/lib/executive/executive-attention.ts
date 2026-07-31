import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

import { loadCanonicalExecutiveState } from "./executive-state";

export type ExecutiveAttentionEvidence = {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceHash: string;
  sourceExcerpt: string | null;
  sourceOccurredAt: string | null;
};

export type ExecutiveAttentionHistoryEntry = {
  id: string;
  action: string;
  actorKind: string;
  actorLabel: string;
  rationale: string;
  createdAt: string;
};

export type ExecutiveAttentionItem = {
  id: string;
  projectId: number | null;
  category: string;
  attentionType: string;
  title: string;
  summary: string;
  priority: string;
  impactOfDelay: string;
  lifecycle: string;
  accountableOwnerLabel: string;
  dueAt: string | null;
  escalationLevel: number;
  assignedAt: string | null;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  createdAt: string;
  evidence: ExecutiveAttentionEvidence[];
  history: ExecutiveAttentionHistoryEntry[];
};

export type ExecutiveAttentionFeed = {
  canonicalPacket: {
    id: string;
    generatedAt: string;
    freshness: string;
    evidenceCount: number;
  };
  items: ExecutiveAttentionItem[];
};

/** Shared actionable lifecycle meaning for every executive consumer. */
export function isExecutiveAttentionActionable(lifecycle: string): boolean {
  return !["resolved", "dismissed"].includes(lifecycle);
}

function metadataValue(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableProjectId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * Canonical Executive Attention read boundary. Consumers receive action-ready
 * records only after the AAI-1101 state seam has validated its source owners.
 * No route or client should compose these tables itself.
 */
export async function loadExecutiveAttentionFeed(): Promise<ExecutiveAttentionFeed> {
  const state = await loadCanonicalExecutiveState();
  const canonicalPacket = state.inputs.find((input) => input.id === "canonical_packet");
  if (!canonicalPacket) {
    throw new Error("Executive attention read failed: canonical packet input is unavailable.");
  }

  const { data, error } = await createServiceClient().rpc("read_executive_attention_feed");
  if (error || !Array.isArray(data)) {
    throw new Error(`Executive attention read failed: ${error?.message ?? "controlled read returned an invalid payload"}`);
  }

  return {
    canonicalPacket: {
      id: state.packet.id,
      generatedAt: state.generatedAt,
      freshness: canonicalPacket.freshness,
      evidenceCount: canonicalPacket.evidenceCount,
    },
    items: data.map((rawItem) => {
      const item = asRecord(rawItem);
      const evidence = Array.isArray(item.evidence) ? item.evidence.map((rawEvidence) => {
        const entry = asRecord(rawEvidence);
        return { id: asString(entry.id), sourceType: asString(entry.source_type), sourceId: asString(entry.source_id), sourceHash: asString(entry.source_hash), sourceExcerpt: asNullableString(entry.source_excerpt), sourceOccurredAt: asNullableString(entry.source_occurred_at) };
      }) : [];
      const history = Array.isArray(item.history) ? item.history.map((rawHistory) => {
        const entry = asRecord(rawHistory);
        return { id: asString(entry.id), action: asString(entry.action), actorKind: asString(entry.actor_kind), actorLabel: asString(entry.actor_label), rationale: asString(entry.rationale), createdAt: asString(entry.created_at) };
      }) : [];
      return {
        id: asString(item.id),
        projectId: asNullableProjectId(item.project_id),
        category: asString(item.category),
        attentionType: metadataValue(item.metadata, "attention_type") || asString(item.category),
        title: asString(item.title),
        summary: asString(item.summary),
        priority: asString(item.priority),
        impactOfDelay: metadataValue(item.metadata, "impact_of_delay") || "Not specified",
        lifecycle: asString(item.lifecycle),
        accountableOwnerLabel: asString(item.accountable_owner_label),
        dueAt: asNullableString(item.due_at),
        escalationLevel: typeof item.escalation_level === "number" ? item.escalation_level : 0,
        assignedAt: asNullableString(item.assigned_at),
        resolvedAt: asNullableString(item.resolved_at),
        resolutionSummary: asNullableString(item.resolution_summary),
        createdAt: asString(item.created_at),
        evidence,
        history,
      };
    }),
  };
}
