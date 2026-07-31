import { z } from "zod";

export const MaintainerStatusSchema = z.enum(["pass", "warn", "fail", "blocked"]);

export const MaintainerFindingSchema = z.object({
  status: MaintainerStatusSchema,
  checkedAt: z.string(),
  projectId: z.number().int().nullable().optional(),
  targetId: z.string().nullable().optional(),
  packetId: z.string().nullable().optional(),
  latestSourceAt: z.string().nullable().optional(),
  latestPacketAt: z.string().nullable().optional(),
  ageHours: z.number().nullable().optional(),
  sourceCoverage: z.record(z.string(), z.unknown()).nullable().optional(),
  evidenceCount: z.number().int().nullable().optional(),
  failedJobs: z.array(z.record(z.string(), z.unknown())).default([]),
  cause: z.string(),
  detectionGap: z.string(),
  prevention: z.string(),
  ownerFiles: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
});

export const MaintainerReportSchema = z.object({
  status: MaintainerStatusSchema,
  checkedAt: z.string(),
  command: z.string().optional(),
  findings: z.array(MaintainerFindingSchema),
  summary: z.string(),
});

export type MaintainerStatus = z.infer<typeof MaintainerStatusSchema>;
export type MaintainerFinding = z.infer<typeof MaintainerFindingSchema>;
export type MaintainerReport = z.infer<typeof MaintainerReportSchema>;

const STATUS_RANK: Record<MaintainerStatus, number> = {
  pass: 0,
  warn: 1,
  fail: 2,
  blocked: 3,
};

export function worstStatus(statuses: MaintainerStatus[]): MaintainerStatus {
  return statuses.reduce<MaintainerStatus>(
    (worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst),
    "pass",
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}
