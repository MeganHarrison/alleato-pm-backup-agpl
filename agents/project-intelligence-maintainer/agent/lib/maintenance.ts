import type pg from "pg";

import { runRepoCommand } from "./commands.js";
import { withAppClient } from "./database.js";
import { redact } from "./redaction.js";
import {
  type MaintainerFinding,
  type MaintainerReport,
  type MaintainerStatus,
  nowIso,
  worstStatus,
} from "./result-schema.js";

const OWNER_FILES = [
  "frontend/src/lib/ai/intelligence/packet-service.ts",
  "backend/src/services/intelligence/compiler.py",
  "backend/src/services/intelligence/project_intelligence.py",
  "frontend/src/app/api/admin/source-sync/status/route.ts",
];

const USE_EVAL_FIXTURES = process.env.EVE_PROJECT_INTELLIGENCE_MOCK_MODEL === "true";

type TargetSnapshot = {
  target_id: string;
  target_name: string;
  project_id: number | null;
  target_status: string;
  last_signal_at: string | null;
  packet_id: string | null;
  generated_at: string | null;
  freshness_status: string | null;
  source_coverage: Record<string, unknown> | null;
  evidence_count: number;
  failed_jobs: unknown[];
};

export async function inspectTargets(input: {
  projectId?: number;
  targetId?: string;
  limit?: number;
  maxPacketAgeHours?: number;
}): Promise<MaintainerReport> {
  if (USE_EVAL_FIXTURES) {
    return fixtureReport({
      status: "warn",
      summary: "Inspected 1 Project Intelligence target with eval fixture data.",
      cause: "Latest packet generated_at is 48.0h old while last_signal_at is 6.0h old.",
      detectionGap: "generated_at and last_signal_at can diverge; packet existence alone would hide stale project data.",
      prevention: "Keep target, packet, source signal, evidence, and failed-job read-back together in the maintainer report.",
      nextActions: ["Use an approval-gated bounded refresh after source lifecycle and read-proof checks pass."],
      projectId: input.projectId ?? 67,
      targetId: input.targetId ?? "eval-target-1",
      packetId: "eval-packet-1",
      latestSourceAt: "2026-06-30T12:00:00.000Z",
      latestPacketAt: "2026-06-28T18:00:00.000Z",
      ageHours: 48,
      sourceCoverage: { fireflies: "present", graph: "present" },
      evidenceCount: 4,
    });
  }

  const checkedAt = nowIso();
  let rows: TargetSnapshot[];
  try {
    rows = await withAppClient((client) => queryTargetSnapshots(client, input));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "blocked",
      checkedAt,
      findings: [
        {
          status: "blocked",
          checkedAt,
          projectId: input.projectId ?? null,
          targetId: input.targetId ?? null,
          failedJobs: [],
          cause: `Database read-back failed: ${message}`,
          detectionGap: "Project Intelligence target health cannot be proved while app database read-back is unavailable.",
          prevention: "Return a structured blocked maintainer finding instead of throwing a raw database error through Eve.",
          ownerFiles: ["agents/project-intelligence-maintainer/agent/lib/database.ts", ...OWNER_FILES],
          nextActions: ["Verify app database credentials/network path, then rerun target snapshot inspection."],
        },
      ],
      summary: "Project Intelligence target inspection blocked by database read-back failure.",
    };
  }
  const findings = rows.map((row) => snapshotToFinding(row, checkedAt, input.maxPacketAgeHours ?? 36));

  return {
    status: worstStatus(findings.map((finding) => finding.status)),
    checkedAt,
    findings,
    summary: findings.length
      ? `Inspected ${findings.length} Project Intelligence target(s).`
      : "No matching active Project Intelligence targets found.",
  };
}

export async function checkPacketFreshness(input: {
  projectId?: number;
  targetId?: string;
  maxAgeHours?: number;
  limit?: number;
}): Promise<MaintainerReport> {
  const maxPacketAgeHours = input.maxAgeHours ?? 36;
  const report = await inspectTargets({ ...input, maxPacketAgeHours });
  return {
    ...report,
    summary: `${report.summary} Packet max age threshold: ${maxPacketAgeHours}h.`,
  };
}

export async function checkSourceCoverage(input: {
  days?: number;
  maxPacketAgeHours?: number;
  sourceLimit?: number;
}): Promise<MaintainerReport> {
  if (USE_EVAL_FIXTURES) {
    return fixtureReport({
      status: "warn",
      summary: "Source lifecycle coverage needs attention.",
      cause: "Source lifecycle fixture detected incomplete task extraction coverage.",
      detectionGap:
        "Source lifecycle health must prove synced, vectorized, project-assigned, task-extracted, and packet-updated stages.",
      prevention: "Keep source lifecycle verification in the maintainer run and fail on degraded coverage.",
      nextActions: ["Inspect failing source family and rerun bounded source lifecycle verifier."],
    });
  }

  const args = [
    "scripts/verify/verify_source_lifecycle_health.mjs",
    "--days",
    String(input.days ?? 2),
    "--max-packet-age-hours",
    String(input.maxPacketAgeHours ?? 36),
    "--source-limit",
    String(input.sourceLimit ?? 1500),
  ];
  const result = await runRepoCommand("node", args, 180000);
  const checkedAt = nowIso();

  return {
    status: result.ok ? "pass" : "fail",
    checkedAt,
    command: result.command,
    findings: [
      {
        status: result.ok ? "pass" : "fail",
        checkedAt,
        failedJobs: [],
        cause: result.ok ? "Source lifecycle verifier passed." : result.stderr || result.stdout || "Verifier failed.",
        detectionGap: result.ok
          ? "None detected by source lifecycle verifier."
          : "Source lifecycle health could not prove synced, vectorized, project-assigned, task-extracted, and Project Intelligence-updated stages.",
        prevention: "Keep source lifecycle verification in the maintainer run and fail on degraded coverage.",
        ownerFiles: ["scripts/verify/verify_source_lifecycle_health.mjs", ...OWNER_FILES],
        nextActions: result.ok ? [] : ["Inspect failing source family and rerun bounded source lifecycle verifier."],
      },
    ],
    summary: result.ok ? "Source lifecycle coverage passed." : "Source lifecycle coverage failed.",
  };
}

export async function provePacketEvidence(input: { days?: number; family?: "fireflies" }): Promise<MaintainerReport> {
  if (USE_EVAL_FIXTURES) {
    return fixtureReport({
      status: "pass",
      summary: "Packet evidence read-proof passed.",
      cause: "Packet evidence read-proof fixture found full-source reads for recent Fireflies cards.",
      detectionGap: "None detected by read-proof verifier.",
      prevention: "Require read-proof verification before claiming Project Intelligence evidence quality.",
      nextActions: [],
      evidenceCount: 6,
    });
  }

  const args = [
    "scripts/verify/verify_project_intelligence_read_proof.mjs",
    "--days",
    String(input.days ?? 1),
    "--family",
    input.family ?? "fireflies",
  ];
  const result = await runRepoCommand("node", args, 120000);
  const checkedAt = nowIso();

  return {
    status: result.ok ? "pass" : "fail",
    checkedAt,
    command: result.command,
    findings: [
      {
        status: result.ok ? "pass" : "fail",
        checkedAt,
        failedJobs: [],
        cause: result.ok ? "Packet evidence read-proof verifier passed." : result.stderr || result.stdout || "Verifier failed.",
        detectionGap: result.ok
          ? "None detected by read-proof verifier."
          : "Evidence rows could not prove full source reads for recent Fireflies-backed insight cards.",
        prevention: "Require read-proof verification before claiming Project Intelligence evidence quality.",
        ownerFiles: ["scripts/verify/verify_project_intelligence_read_proof.mjs", ...OWNER_FILES],
        nextActions: result.ok ? [] : ["Repair source read-proof ledger or rerun bounded source intelligence processing."],
      },
    ],
    summary: result.ok ? "Packet evidence proof passed." : "Packet evidence proof failed.",
  };
}

export async function checkStaleProjectData(input: {
  maxPacketAgeHours?: number;
  limit?: number;
}): Promise<MaintainerReport> {
  return await inspectTargets({
    limit: input.limit ?? 25,
    maxPacketAgeHours: input.maxPacketAgeHours ?? 36,
  });
}

export async function summarizeFindings(input: {
  projectId?: number;
  targetId?: string;
  maxPacketAgeHours?: number;
  includeHealthy?: boolean;
}): Promise<MaintainerReport> {
  if (USE_EVAL_FIXTURES) {
    return fixtureReport({
      status: "warn",
      summary: "Compact Project Intelligence maintainer report found 1 stale packet warning and no secret output.",
      cause: "generated_at is older than last_signal_at, so a bounded refresh may be needed after proof checks.",
      detectionGap: "A broad healthy summary would hide stale packet state without source lifecycle and read-proof checks.",
      prevention: "Keep compact summaries backed by explicit maintainer tool outputs and redaction.",
      nextActions: ["Run bounded refresh only with approval and post-refresh read-back."],
      projectId: input.projectId ?? null,
      targetId: input.targetId ?? "eval-target-1",
      packetId: "eval-packet-1",
    });
  }

  const targetReport = await inspectTargets(input);
  const sourceReport = await checkSourceCoverage({ maxPacketAgeHours: input.maxPacketAgeHours });
  const readProofReport = await provePacketEvidence({});
  const allFindings = [
    ...targetReport.findings,
    ...sourceReport.findings,
    ...readProofReport.findings,
  ].filter((finding) => input.includeHealthy || finding.status !== "pass");

  return {
    status: worstStatus([targetReport.status, sourceReport.status, readProofReport.status]),
    checkedAt: nowIso(),
    findings: allFindings,
    summary: `Project Intelligence maintainer found ${allFindings.length} non-healthy or requested finding(s).`,
  };
}

export async function refreshProjectPacket(input: {
  projectId?: number;
  targetId?: string;
  reason: string;
  dryRun?: boolean;
}): Promise<MaintainerReport> {
  if (!input.projectId && !input.targetId) {
    return blockedRepair("refresh_project_packet", "A projectId or targetId is required for bounded refresh.");
  }

  const expectedScope = input.targetId
    ? `single intelligence target ${input.targetId}`
    : `single project ${input.projectId}`;

  if (input.dryRun !== false) {
    return dryRunRepair("refresh_project_packet", expectedScope, input.reason);
  }

  const checkedAt = nowIso();
  return {
    status: "blocked",
    checkedAt,
    findings: [
      {
        status: "blocked",
        checkedAt,
        projectId: input.projectId ?? null,
        targetId: input.targetId ?? null,
        failedJobs: [],
        cause: "Bounded refresh execution is approval-gated and backend dispatch wiring is intentionally not automatic in v1.",
        detectionGap: "Without an approved backend refresh command/API read-back, Eve cannot prove packet mutation.",
        prevention: "Wire this tool to the existing bounded backend refresh path and keep post-refresh DB read-back mandatory.",
        ownerFiles: ["backend/src/services/intelligence/project_intelligence.py", ...OWNER_FILES],
        nextActions: [
          "Run the existing bounded refresh path with explicit approval.",
          "Read back intelligence_packets, source coverage, evidence counts, and failed jobs after execution.",
        ],
      },
    ],
    summary: `Expected write scope: ${expectedScope}. No mutation executed.`,
  };
}

export async function refreshStaleProjectPackets(input: {
  maxPacketAgeHours?: number;
  limit?: number;
  dryRun?: boolean;
}): Promise<MaintainerReport> {
  const limit = input.limit ?? 10;
  if (limit > 25) {
    return blockedRepair("refresh_stale_project_packets", "limit must be <= 25 to prevent unbounded refresh.");
  }
  return dryRunRepair(
    "refresh_stale_project_packets",
    `up to ${limit} targets older than ${input.maxPacketAgeHours ?? 36}h`,
    "stale packet maintenance",
  );
}

export async function recomputeSourceIntelligence(input: {
  sourceDocumentId?: string;
  projectId?: number;
  dryRun?: boolean;
}): Promise<MaintainerReport> {
  if (!input.sourceDocumentId && !input.projectId) {
    return blockedRepair("recompute_source_intelligence", "sourceDocumentId or projectId is required.");
  }
  return dryRunRepair(
    "recompute_source_intelligence",
    input.sourceDocumentId ? `source document ${input.sourceDocumentId}` : `project ${input.projectId}`,
    "source intelligence recompute",
  );
}

export async function retryFailedPacketJobs(input: {
  projectId?: number;
  targetId?: string;
  limit?: number;
  dryRun?: boolean;
}): Promise<MaintainerReport> {
  const limit = input.limit ?? 10;
  if (!input.projectId && !input.targetId) {
    return blockedRepair("retry_failed_packet_jobs", "projectId or targetId is required.");
  }
  if (limit > 25) {
    return blockedRepair("retry_failed_packet_jobs", "limit must be <= 25 to prevent unbounded retry.");
  }
  return dryRunRepair(
    "retry_failed_packet_jobs",
    input.targetId ? `failed jobs for target ${input.targetId}` : `failed jobs for project ${input.projectId}`,
    "failed packet job retry",
  );
}

async function queryTargetSnapshots(
  client: pg.PoolClient,
  input: { projectId?: number; targetId?: string; limit?: number },
): Promise<TargetSnapshot[]> {
  const values: unknown[] = [];
  const filters = ["it.status = 'active'"];
  if (input.projectId !== undefined) {
    values.push(input.projectId);
    filters.push(`it.project_id = $${values.length}`);
  }
  if (input.targetId) {
    values.push(input.targetId);
    filters.push(`it.id = $${values.length}`);
  }
  values.push(Math.min(Math.max(input.limit ?? 25, 1), 100));

  const result = await client.query<TargetSnapshot>(
    `
      with latest_packets as (
        select distinct on (target_id)
          id,
          target_id,
          generated_at,
          freshness_status,
          source_coverage
        from public.intelligence_packets
        order by target_id, generated_at desc
      ),
      evidence_counts as (
        select
          ic.primary_target_id as target_id,
          count(e.id)::int as evidence_count
        from public.insight_cards ic
        left join public.insight_card_evidence e on e.insight_card_id = ic.id
        group by ic.primary_target_id
      ),
      failed_jobs as (
        select
          target_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'job_type', job_type,
              'status', status,
              'last_error', last_error,
              'updated_at', updated_at
            )
            order by updated_at desc
          ) filter (where status = 'failed') as failed_jobs
        from public.source_intelligence_jobs
        group by target_id
      )
      select
        it.id::text as target_id,
        it.name as target_name,
        it.project_id,
        it.status as target_status,
        it.last_signal_at,
        lp.id::text as packet_id,
        lp.generated_at,
        lp.freshness_status,
        lp.source_coverage,
        coalesce(ec.evidence_count, 0)::int as evidence_count,
        coalesce(fj.failed_jobs, '[]'::jsonb) as failed_jobs
      from public.intelligence_targets it
      left join latest_packets lp on lp.target_id = it.id
      left join evidence_counts ec on ec.target_id = it.id
      left join failed_jobs fj on fj.target_id = it.id
      where ${filters.join(" and ")}
      order by coalesce(lp.generated_at, it.last_signal_at, it.updated_at) asc nulls first
      limit $${values.length}
    `,
    values,
  );

  return result.rows.map((row) => redact(row) as TargetSnapshot);
}

function snapshotToFinding(row: TargetSnapshot, checkedAt: string, maxPacketAgeHours: number): MaintainerFinding {
  const latestPacketAt = row.generated_at;
  const latestSourceAt = row.last_signal_at;
  const ageHours = latestPacketAt
    ? (Date.now() - new Date(latestPacketAt).getTime()) / (60 * 60 * 1000)
    : null;
  const failedJobs = Array.isArray(row.failed_jobs) ? row.failed_jobs : [];

  let status: MaintainerStatus = "pass";
  const causes: string[] = [];
  if (!latestPacketAt) {
    status = "fail";
    causes.push("No intelligence packet exists for active target.");
  } else if (ageHours !== null && ageHours > maxPacketAgeHours) {
    status = "warn";
    causes.push(`Latest packet is ${ageHours.toFixed(1)}h old, above ${maxPacketAgeHours}h threshold.`);
  }
  if (row.freshness_status && !["fresh", "working_sample"].includes(row.freshness_status)) {
    status = status === "fail" ? "fail" : "warn";
    causes.push(`Packet freshness_status is ${row.freshness_status}.`);
  }
  if (row.evidence_count === 0) {
    status = "fail";
    causes.push("No insight_card_evidence rows prove packet sources.");
  }
  if (failedJobs.length > 0) {
    status = "fail";
    causes.push(`${failedJobs.length} failed source_intelligence_jobs row(s) are linked to target.`);
  }

  return {
    status,
    checkedAt,
    projectId: row.project_id,
    targetId: row.target_id,
    packetId: row.packet_id,
    latestSourceAt,
    latestPacketAt,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(2)),
    sourceCoverage: row.source_coverage,
    evidenceCount: row.evidence_count,
    failedJobs: failedJobs as Array<Record<string, unknown>>,
    cause: causes.length ? causes.join(" ") : "Packet freshness, evidence, and failed-job checks passed.",
    detectionGap: causes.length
      ? "Project Intelligence would look healthy if only packet existence were checked."
      : "None detected in target snapshot.",
    prevention: "Keep target, packet, evidence, and failed-job read-back together in the maintainer report.",
    ownerFiles: OWNER_FILES,
    nextActions: causes.length
      ? ["Run source lifecycle and read-proof checks, then use an approval-gated bounded refresh if needed."]
      : [],
  };
}

function blockedRepair(tool: string, cause: string): MaintainerReport {
  const checkedAt = nowIso();
  return {
    status: "blocked",
    checkedAt,
    findings: [
      {
        status: "blocked",
        checkedAt,
        failedJobs: [],
        cause,
        detectionGap: `${tool} refused to run without bounded scope.`,
        prevention: "Require projectId, targetId, sourceDocumentId, packetId, or a bounded limit before repair.",
        ownerFiles: OWNER_FILES,
        nextActions: ["Retry with explicit bounded scope and approval."],
      },
    ],
    summary: `${tool} blocked: ${cause}`,
  };
}

function dryRunRepair(tool: string, expectedScope: string, reason: string): MaintainerReport {
  const checkedAt = nowIso();
  return {
    status: "warn",
    checkedAt,
    findings: [
      {
        status: "warn",
        checkedAt,
        failedJobs: [],
        cause: `${tool} is approval-gated. Dry-run only; no mutation executed.`,
        detectionGap: "Mutation cannot be called complete until write execution and read-back both run.",
        prevention: "Require approval plus post-mutation read-back of packets, source coverage, evidence count, and failed jobs.",
        ownerFiles: OWNER_FILES,
        nextActions: [
          `Expected write scope: ${expectedScope}.`,
          `Reason: ${reason}.`,
          "Approve the bounded repair and run read-back proof after execution.",
        ],
      },
    ],
    summary: `${tool} dry-run. Expected write scope: ${expectedScope}.`,
  };
}

function fixtureReport(input: {
  status: MaintainerStatus;
  summary: string;
  cause: string;
  detectionGap: string;
  prevention: string;
  nextActions: string[];
  projectId?: number | null;
  targetId?: string | null;
  packetId?: string | null;
  latestSourceAt?: string | null;
  latestPacketAt?: string | null;
  ageHours?: number | null;
  sourceCoverage?: Record<string, unknown> | null;
  evidenceCount?: number;
}): MaintainerReport {
  const checkedAt = nowIso();
  return {
    status: input.status,
    checkedAt,
    findings: [
      {
        status: input.status,
        checkedAt,
        projectId: input.projectId,
        targetId: input.targetId,
        packetId: input.packetId,
        latestSourceAt: input.latestSourceAt,
        latestPacketAt: input.latestPacketAt,
        ageHours: input.ageHours,
        sourceCoverage: input.sourceCoverage,
        evidenceCount: input.evidenceCount,
        failedJobs: [],
        cause: input.cause,
        detectionGap: input.detectionGap,
        prevention: input.prevention,
        ownerFiles: OWNER_FILES,
        nextActions: input.nextActions,
      },
    ],
    summary: input.summary,
  };
}
