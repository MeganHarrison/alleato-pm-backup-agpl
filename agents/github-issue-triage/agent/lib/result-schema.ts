import { z } from "zod";

export const TriageRouteSchema = z.enum([
  "blocked",
  "direct-to-main",
  "pr-required",
  "wait-for-clarification",
]);

export const TriageDecisionSchema = z.object({
  approvalRequired: z.boolean(),
  blockedReason: z.string().optional(),
  boundedScopeSummary: z.string(),
  clarificationQuestions: z.array(z.string()),
  issueNumber: z.number().int().positive(),
  owner: z.string(),
  reasonCodes: z.array(z.string()).min(1),
  repo: z.string(),
  route: TriageRouteSchema,
  summary: z.string(),
  verificationPlan: z.array(z.string()).min(1),
});

export const FixWorkflowRequestSchema = z.object({
  boundedScopeSummary: z.string(),
  issueNumber: z.number().int().positive(),
  owner: z.string(),
  repo: z.string(),
  route: TriageRouteSchema.exclude(["blocked", "wait-for-clarification"]),
  verificationPlan: z.array(z.string()).min(1),
});

export const FixWorkflowApprovalSchema = z.object({
  boundedScopeSummary: z.string(),
  deliveryMode: z.enum(["main", "pull-request"]),
  issueNumber: z.number().int().positive(),
  owner: z.string(),
  repo: z.string(),
  route: TriageRouteSchema.exclude(["blocked", "wait-for-clarification"]),
  status: z.literal("approved"),
  verificationPlan: z.array(z.string()).min(1),
});
