import { z } from "zod";

const sourceType = z.enum(["source_signal_candidate", "intelligence_packet", "document", "meeting", "email", "transactional_record", "project_current_state", "manual_attestation"]);
const authority = z.enum(["authoritative", "observed", "predicted"]);
const freshness = z.enum(["fresh", "stale", "partial", "unknown"]);

export const ownershipRoutes = {
  finance: "Finance owner",
  schedule_operations: "Operations owner",
  project: "Project owner",
  executive_priority: "Executive owner",
} as const;

export const createExecutiveConflictRequestSchema = z.object({
  briefId: z.string().uuid(),
  attentionId: z.string().uuid(),
  domain: z.enum(["finance", "schedule_operations", "project", "executive_priority"]),
  subject: z.string().trim().min(8).max(240),
  priority: z.enum(["critical", "high", "medium", "low"]),
  impactOfDelay: z.string().trim().min(8).max(1_000),
  accountableResolverLabel: z.string().trim().min(2).max(160),
  dueAt: z.string().datetime(),
  claims: z.array(z.object({
    label: z.string().trim().min(2).max(160),
    statement: z.string().trim().min(4).max(2_000),
    authority,
    freshness,
    sourceType,
    sourceId: z.string().trim().min(1).max(300),
    sourceHash: z.string().trim().min(8).max(256),
    sourceUrl: z.string().url().optional(),
    sourceExcerpt: z.string().trim().min(1).max(2_000).optional(),
    assertedAt: z.string().datetime().optional(),
  })).min(2).max(8),
});

export const resolveExecutiveConflictRequestSchema = z.object({
  briefId: z.string().uuid(),
  resolutionSummary: z.string().trim().min(10).max(2_000),
  currentOperationalMeaning: z.string().trim().min(4).max(2_000),
  dismiss: z.boolean().optional(),
});
