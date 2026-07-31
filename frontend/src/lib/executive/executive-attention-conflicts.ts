import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/types/database.types";

const sourceTypeSchema = z.enum([
  "source_signal_candidate",
  "intelligence_packet",
  "document",
  "meeting",
  "email",
  "transactional_record",
  "project_current_state",
  "manual_attestation",
]);

const evidenceSchema = z.object({
  source_type: sourceTypeSchema,
  source_id: z.string().trim().min(1),
  source_hash: z.string().trim().min(1),
  source_url: z.string().url().optional(),
  source_excerpt: z.string().trim().min(1).optional(),
  source_occurred_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const actorKindSchema = z.enum(["human", "ai", "system"]);

export const executiveAttentionInputSchema = z.object({
  project_id: z.number().int().positive().optional(),
  category: z.enum([
    "decision",
    "risk",
    "blocker",
    "commitment",
    "financial",
    "schedule",
    "delivery",
    "process",
  ]),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  priority: z.enum(["critical", "high", "medium", "low"]),
  accountable_owner_person_id: z.string().uuid().optional(),
  accountable_owner_label: z.string().trim().min(1),
  due_at: z.string().datetime().optional(),
  escalation_level: z.number().int().min(0).max(3).default(0),
  assigned_at: z.string().datetime().optional(),
  actor_kind: actorKindSchema.default("system"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  evidence: z.array(evidenceSchema).min(1),
});

export const executiveConflictInputSchema = z.object({
  attention_id: z.string().uuid().optional(),
  project_id: z.number().int().positive().optional(),
  subject: z.string().trim().min(1),
  priority: z.enum(["critical", "high", "medium", "low"]),
  resolution_due_at: z.string().datetime(),
  accountable_resolver_person_id: z.string().uuid().optional(),
  accountable_resolver_label: z.string().trim().min(1),
  actor_kind: actorKindSchema.default("system"),
  actor_label: z.string().trim().min(1).default("Executive operating system"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  claims: z
    .array(
      evidenceSchema.extend({
        claim_label: z.string().trim().min(1),
        claim_value: z.record(z.string(), z.unknown()).default({}),
        asserted_at: z.string().datetime().optional(),
      }),
    )
    .min(2),
});

const humanResolutionSchema = z.object({
  id: z.string().uuid(),
  actor_label: z.string().trim().min(1),
  actor_user_id: z.string().uuid(),
  actor_kind: z.literal("human"),
  resolution_summary: z.string().trim().min(1),
  dismiss: z.boolean().optional(),
});

const humanAttentionTransitionSchema = z.object({
  id: z.string().uuid(),
  actor_label: z.string().trim().min(1),
  actor_user_id: z.string().uuid(),
  actor_kind: z.literal("human"),
  lifecycle: z.enum(["acknowledged", "in_progress", "escalated"]),
  escalation_level: z.number().int().min(0).max(3).optional(),
  assigned_at: z.string().datetime().optional(),
});

type ExecutiveDb = SupabaseClient<Database>;

function throwDomainError(operation: string, message: string): never {
  throw new Error(`Executive ${operation} failed: ${message}`);
}

/** Creates an open, evidence-backed attention item through the database boundary. */
export async function createExecutiveAttentionItem(
  db: ExecutiveDb,
  input: unknown,
): Promise<string> {
  const parsed = executiveAttentionInputSchema.parse(input);
  const { data, error } = await db.rpc("create_executive_attention_item", {
    p_input: parsed as unknown as Json,
  });
  if (error || !data) {
    return throwDomainError("attention creation", error?.message ?? "missing attention id");
  }
  return data;
}

/** Records competing claims without allowing the caller to choose an outcome. */
export async function createExecutiveClaimConflict(
  db: ExecutiveDb,
  input: unknown,
): Promise<string> {
  const parsed = executiveConflictInputSchema.parse(input);
  const { data, error } = await db.rpc("create_executive_claim_conflict", {
    p_input: parsed as unknown as Json,
  });
  if (error || !data) {
    return throwDomainError("conflict creation", error?.message ?? "missing conflict id");
  }
  return data;
}

/** Only a caller that explicitly identifies as human may close an attention item. */
export async function resolveExecutiveAttentionItem(
  db: ExecutiveDb,
  input: unknown,
): Promise<void> {
  const parsed = humanResolutionSchema.parse(input);
  const { error } = await db.rpc("resolve_executive_attention_item", {
    p_attention_id: parsed.id,
    p_actor_label: parsed.actor_label,
    p_actor_user_id: parsed.actor_user_id,
    p_actor_kind: parsed.actor_kind,
    p_resolution_summary: parsed.resolution_summary,
    p_dismiss: parsed.dismiss ?? false,
  });
  if (error) throwDomainError("attention resolution", error.message);
}

/** A named authenticated human owns acknowledgement, assignment, and escalation. */
export async function transitionExecutiveAttentionItem(
  db: ExecutiveDb,
  input: unknown,
): Promise<void> {
  const parsed = humanAttentionTransitionSchema.parse(input);
  const { error } = await db.rpc("transition_executive_attention_item", {
    p_attention_id: parsed.id,
    p_actor_label: parsed.actor_label,
    p_actor_user_id: parsed.actor_user_id,
    p_lifecycle: parsed.lifecycle,
    p_escalation_level: parsed.escalation_level ?? undefined,
    p_assigned_at: parsed.assigned_at ?? undefined,
  });
  if (error) throwDomainError("attention transition", error.message);
}

/** Only a caller that explicitly identifies as human may choose a conflict outcome. */
export async function resolveExecutiveClaimConflict(
  db: ExecutiveDb,
  input: unknown,
  resolution: Record<string, unknown> = {},
): Promise<void> {
  const parsed = humanResolutionSchema.parse(input);
  const { error } = await db.rpc("resolve_executive_claim_conflict", {
    p_conflict_id: parsed.id,
    p_actor_label: parsed.actor_label,
    p_actor_user_id: parsed.actor_user_id,
    p_actor_kind: parsed.actor_kind,
    p_resolution_summary: parsed.resolution_summary,
    p_resolution: resolution as Json,
    p_dismiss: parsed.dismiss ?? false,
  });
  if (error) throwDomainError("conflict resolution", error.message);
}
