import { z } from "zod";

export const executiveAttentionTypeSchema = z.enum([
  "decision",
  "approval",
  "risk",
  "financial_exposure",
  "schedule_exception",
  "cross_project",
]);

export const createExecutiveAttentionRequestSchema = z.object({
  type: executiveAttentionTypeSchema,
  title: z.string().trim().min(4).max(180),
  summary: z.string().trim().min(8).max(2_000),
  priority: z.enum(["critical", "high", "medium", "low"]),
  impactOfDelay: z.string().trim().min(4).max(500),
  accountableOwnerLabel: z.string().trim().min(2).max(160),
  dueAt: z.string().datetime(),
});

export function categoryForExecutiveAttentionType(
  type: z.infer<typeof executiveAttentionTypeSchema>,
) {
  return {
    decision: "decision",
    approval: "decision",
    risk: "risk",
    financial_exposure: "financial",
    schedule_exception: "schedule",
    cross_project: "process",
  }[type] as "decision" | "risk" | "financial" | "schedule" | "process";
}
