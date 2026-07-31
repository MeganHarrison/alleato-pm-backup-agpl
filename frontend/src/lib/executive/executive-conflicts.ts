import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { loadExecutiveAttentionFeed, type ExecutiveAttentionItem } from "./executive-attention";

export type ExecutiveConflictClaim = {
  id: string;
  label: string;
  statement: string;
  authority: "authoritative" | "observed" | "predicted" | "unknown";
  freshness: "fresh" | "stale" | "partial" | "unknown";
  sourceType: string;
  sourceId: string;
  sourceHash: string;
  sourceUrl: string | null;
  sourceExcerpt: string | null;
  assertedAt: string | null;
};

export type ExecutiveConflictHistory = { id: string; action: string; actorKind: string; actorLabel: string; rationale: string; resolution: Record<string, unknown>; createdAt: string };
export type ExecutiveConflictItem = { id: string; attentionId: string | null; attentionTitle: string | null; projectId: number | null; subject: string; domain: "finance" | "schedule_operations" | "project" | "executive_priority" | "unknown"; ownershipRoute: string; impactOfDelay: string; status: string; priority: string; resolver: string; dueAt: string; resolutionSummary: string | null; claims: ExecutiveConflictClaim[]; history: ExecutiveConflictHistory[] };
export type ExecutiveConflictFeed = { canonicalPacket: { id: string; generatedAt: string; freshness: string; evidenceCount: number; authority: "authoritative" }; attention: ExecutiveAttentionItem[]; conflicts: ExecutiveConflictItem[] };

/** Shared actionable lifecycle meaning for every executive consumer. */
export function isExecutiveConflictActionable(status: string): boolean {
  return !["resolved", "dismissed"].includes(status);
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function asString(value: unknown): string { return typeof value === "string" ? value : ""; }
function nullableString(value: unknown): string | null { return typeof value === "string" ? value : null; }
function nullableProjectId(value: unknown): number | null { return typeof value === "number" && Number.isInteger(value) ? value : null; }
function metadataValue(metadata: unknown, key: string): string { return asString(asRecord(metadata)[key]); }
function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T { return typeof value === "string" && values.includes(value as T) ? value as T : fallback; }

/** The only read adapter for executive conflict UI and API consumers. */
export async function loadExecutiveConflictFeed(): Promise<ExecutiveConflictFeed> {
  const attentionFeed = await loadExecutiveAttentionFeed();
  const { data, error } = await createServiceClient().rpc("read_executive_conflict_feed");
  if (error || !Array.isArray(data)) throw new Error(`Executive conflict read failed: ${error?.message ?? "controlled read returned an invalid payload"}`);
  const attentionById = new Map(attentionFeed.items.map((item) => [item.id, item]));
  return {
    canonicalPacket: { ...attentionFeed.canonicalPacket, authority: "authoritative" },
    attention: attentionFeed.items,
    conflicts: data.map((rawConflict) => {
      const conflict = asRecord(rawConflict);
      const attentionId = nullableString(conflict.attention_id);
      const claims = Array.isArray(conflict.claims) ? conflict.claims.map((rawClaim) => {
        const claim = asRecord(rawClaim); const value = asRecord(claim.claim_value);
        return { id: asString(claim.id), label: asString(claim.claim_label), statement: asString(value.statement), authority: enumValue(value.authority, ["authoritative", "observed", "predicted", "unknown"] as const, "unknown"), freshness: enumValue(value.freshness, ["fresh", "stale", "partial", "unknown"] as const, "unknown"), sourceType: asString(claim.source_type), sourceId: asString(claim.source_id), sourceHash: asString(claim.source_hash), sourceUrl: nullableString(claim.source_url), sourceExcerpt: nullableString(claim.source_excerpt), assertedAt: nullableString(claim.asserted_at) };
      }) : [];
      const history = Array.isArray(conflict.history) ? conflict.history.map((rawHistory) => { const item = asRecord(rawHistory); return { id: asString(item.id), action: asString(item.action), actorKind: asString(item.actor_kind), actorLabel: asString(item.actor_label), rationale: asString(item.rationale), resolution: asRecord(item.resolution), createdAt: asString(item.created_at) }; }) : [];
      return { id: asString(conflict.id), attentionId, attentionTitle: attentionId ? attentionById.get(attentionId)?.title ?? null : null, projectId: nullableProjectId(conflict.project_id), subject: asString(conflict.subject), domain: enumValue(metadataValue(conflict.metadata, "domain"), ["finance", "schedule_operations", "project", "executive_priority", "unknown"] as const, "unknown"), ownershipRoute: metadataValue(conflict.metadata, "ownership_route") || "Routing not recorded", impactOfDelay: metadataValue(conflict.metadata, "impact_of_delay") || "Impact not recorded", status: asString(conflict.status), priority: asString(conflict.priority), resolver: asString(conflict.accountable_resolver_label), dueAt: asString(conflict.resolution_due_at), resolutionSummary: nullableString(conflict.resolution_summary), claims, history };
    }),
  };
}
