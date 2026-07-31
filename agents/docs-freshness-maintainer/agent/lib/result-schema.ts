import { z } from "zod";

export const DocStatusSchema = z.enum(["pass", "warn", "fail", "blocked"]);

export const DocFindingSchema = z.object({
  artifact: z.string(),
  status: DocStatusSchema,
  checkedAt: z.string(),
  generator: z.string().nullable().optional(),
  file: z.string().nullable().optional(),
  // For generated docs: how many lines regeneration would add/remove.
  driftAdded: z.number().int().nullable().optional(),
  driftRemoved: z.number().int().nullable().optional(),
  // For hand-verified docs: days since "Last verified" + offending commits.
  staleSinceDays: z.number().nullable().optional(),
  offendingCommits: z.array(z.string()).default([]),
  cause: z.string(),
  detectionGap: z.string(),
  prevention: z.string(),
  ownerFiles: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
});

export const DocReportSchema = z.object({
  status: DocStatusSchema,
  checkedAt: z.string(),
  command: z.string().optional(),
  findings: z.array(DocFindingSchema),
  summary: z.string(),
});

export type DocStatus = z.infer<typeof DocStatusSchema>;
export type DocFinding = z.infer<typeof DocFindingSchema>;
export type DocReport = z.infer<typeof DocReportSchema>;

const STATUS_RANK: Record<DocStatus, number> = {
  pass: 0,
  warn: 1,
  fail: 2,
  blocked: 3,
};

export function worstStatus(statuses: DocStatus[]): DocStatus {
  return statuses.reduce<DocStatus>(
    (worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst),
    "pass",
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}
