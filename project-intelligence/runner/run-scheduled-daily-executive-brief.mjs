#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
} from "../../scripts/verify/app-db-connection.mjs";
import {
  DEFAULT_DAILY_BRIEF_LOCAL_TIME,
  DEFAULT_DAILY_BRIEF_TIMEZONE,
  recoveryWindowDecision,
  localScheduleDecision,
  parseWeekdays,
  previousBusinessDateInTimeZone,
} from "./daily-executive-brief-schedule.mjs";
import {
  EXECUTIVE_INTELLIGENCE_COMPILER_VERSION as COMPILER_VERSION,
  EXECUTIVE_INTELLIGENCE_TARGET_SLUG as TARGET_SLUG,
  assertPublishableRun,
} from "../core/executive-intelligence-run.mjs";
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RECOVERY_WINDOW_MINUTES,
  EXECUTIVE_SCHEDULE_WORKFLOW_ID,
  nextRetryAt,
  recoveryDecision,
} from "./executive-intelligence-recovery.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });


function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

async function withAppDatabase(callback) {
  const rawUrl = getAppDatabaseUrl();
  if (!rawUrl) {
    throw new Error(
      "APP_DATABASE_URL, DATABASE_URL, SUPABASE_DB_URL, or APP_METADATA_DATABASE_URL is required for scheduled Daily Brief idempotency and readback.",
    );
  }
  const client = new pg.Client({
    connectionString: await buildAppDatabaseConnectionString(rawUrl, {
      includeSslMode: false,
    }),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function findPacketForScheduledDay(client, { businessDate, localRunDate, timezone }) {
  const result = await client.query(
    `
      select p.id, p.generated_at, p.packet_json->>'businessDate' as business_date,
             p.compiler_version, p.packet_type, p.freshness_status,
             p.packet_json->'runContract' as run_contract
      from public.intelligence_packets p
      join public.intelligence_targets t on t.id = p.target_id
      where t.slug = $1
        and p.packet_json->>'businessDate' = $2
        and (p.generated_at at time zone $3)::date = $4::date
        and p.packet_type = 'current'
        and p.freshness_status = 'fresh'
        and p.packet_json->'runContract'->>'status' = 'completed'
      order by p.generated_at desc
      limit 1
    `,
    [TARGET_SLUG, businessDate, timezone, localRunDate],
  );
  return result.rows[0] ?? null;
}

async function withSchedulerLock(client, callback) {
  await client.query("select pg_advisory_lock(hashtext($1))", [EXECUTIVE_SCHEDULE_WORKFLOW_ID]);
  try { return await callback(); } finally { await client.query("select pg_advisory_unlock(hashtext($1))", [EXECUTIVE_SCHEDULE_WORKFLOW_ID]); }
}

async function loadSchedulerRun(client, businessDate) {
  const result = await client.query(
    `select id, status, attempt_count, next_attempt_at, started_at, completed_at
       from public.ai_work_runs
      where workflow_id = $1 and business_date = $2::date
      limit 1`,
    [EXECUTIVE_SCHEDULE_WORKFLOW_ID, businessDate],
  );
  return result.rows[0] ?? null;
}

async function claimSchedulerRun(client, businessDate, current, existing) {
  const attemptCount = (existing?.attempt_count ?? 0) + 1;
  if (existing) {
    await client.query(
      `update public.ai_work_runs set status = 'running', attempt_count = $2,
         started_at = $3, blocker = null, next_attempt_at = null, failure_code = null,
         failure_message = null, completed_at = null, updated_at = $3 where id = $1`,
      [existing.id, attemptCount, current.toISOString()],
    );
    return { ...existing, status: "running", attempt_count: attemptCount };
  }
  const result = await client.query(
    `insert into public.ai_work_runs
      (workflow_id, trigger_type, surface, title, status, business_date, attempt_count, started_at, metadata)
     values ($1, 'scheduled', 'project_intelligence', 'Morning Project Intelligence', 'running', $2::date, 1, $3, $4::jsonb)
     returning id, status, attempt_count, next_attempt_at`,
    [EXECUTIVE_SCHEDULE_WORKFLOW_ID, businessDate, current.toISOString(), JSON.stringify({ scheduler: "render-cron" })],
  );
  return result.rows[0];
}

async function markSchedulerSuccess(client, runId, current) {
  await client.query(
    `update public.ai_work_runs set status = 'succeeded', blocker = null, next_attempt_at = null,
       completed_at = $2, updated_at = $2 where id = $1`,
    [runId, current.toISOString()],
  );
}

export async function markSchedulerFailure(client, run, current, error, options = {}) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1800);
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const terminal = run.attempt_count >= maxAttempts;
  const retryAt = terminal ? null : nextRetryAt(current, run.attempt_count);
  await client.query(
    `update public.ai_work_runs set status = $2, blocker = $3, next_attempt_at = $4::timestamptz,
       failure_code = 'EXECUTIVE_INTELLIGENCE_SCHEDULE_FAILED', failure_message = $3,
       completed_at = case when $2::text = 'failed_permanent' then $5::timestamptz else null::timestamptz end,
       updated_at = $5::timestamptz
       where id = $1`,
    [run.id, terminal ? "failed_permanent" : "failed_retryable", message, retryAt, current.toISOString()],
  );
  return { message, terminal, nextAttemptAt: retryAt };
}

export function assertCompletedDailyBriefPacket(packet, { businessDate } = {}) {
  return assertPublishableRun(packet, { businessDate });
}

export function resolveSchedulerExecutionDecision({ regenerate = false, recovery }) {
  if (regenerate) {
    return { action: "resume", reason: "explicit_regeneration_requested" };
  }
  return recovery;
}

function runCompiler({ businessDate, localRunDate }) {
  const evidenceDir =
    process.env.EXECUTIVE_DAILY_BRIEF_EVIDENCE_DIR ??
    `docs/ops/evidence/runtime/daily-executive-brief/${localRunDate}`;
  const compilerArgs = [
    "project-intelligence/core/compile-daily-executive-brief.mjs",
    "--date",
    businessDate,
    "--packetType",
    "current",
    "--evidence-dir",
    evidenceDir,
  ];
  const result = spawnSync(process.execPath, compilerArgs, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    timeout: Number(process.env.EXECUTIVE_DAILY_BRIEF_TIMEOUT_MS ?? 30 * 60 * 1000),
  });
  if (result.error) {
    throw new Error(`Executive Daily Brief compiler failed to start: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`Executive Daily Brief compiler terminated by signal ${result.signal}.`);
  }
  if (result.status !== 0) {
    throw new Error(
      `Executive Daily Brief compiler exited ${result.status}; command: node ${compilerArgs.join(" ")}`,
    );
  }
}

export async function runScheduledDailyExecutiveBrief({ argv = process.argv.slice(2), now = null } = {}) {
  const args = parseArgs(argv);
  const effectiveNow = now ?? new Date(typeof args.now === "string" ? args.now : Date.now());
  if (Number.isNaN(effectiveNow.getTime())) {
    throw new Error(`--now must be an ISO timestamp; received '${args.now}'.`);
  }
  const timezone =
    process.env.EXECUTIVE_DAILY_BRIEF_TARGET_TIMEZONE?.trim() ||
    DEFAULT_DAILY_BRIEF_TIMEZONE;
  const targetLocalTime =
    process.env.EXECUTIVE_DAILY_BRIEF_TARGET_LOCAL_TIME?.trim() ||
    DEFAULT_DAILY_BRIEF_LOCAL_TIME;
  const weekdays = parseWeekdays(process.env.EXECUTIVE_DAILY_BRIEF_TARGET_WEEKDAYS);
  const schedule = recoveryWindowDecision(effectiveNow, {
    timezone,
    targetLocalTime,
    weekdays,
  });

  if (!args.force && !schedule.inRecoveryWindow) {
    return { ok: true, skipped: true, reason: "outside_target_local_schedule", schedule };
  }

  const businessDate =
    typeof args.date === "string"
      ? args.date
      : previousBusinessDateInTimeZone(effectiveNow, timezone);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error(`--date must be YYYY-MM-DD; received '${businessDate}'.`);
  }

  return withAppDatabase((client) => withSchedulerLock(client, async () => {
    let schedulerRun = await loadSchedulerRun(client, businessDate);
    const existing = await findPacketForScheduledDay(client, {
      businessDate,
      localRunDate: schedule.currentLocalDate,
      timezone,
    });
    if (existing && !args.regenerate) {
      assertCompletedDailyBriefPacket(existing, { businessDate });
      schedulerRun = await claimSchedulerRun(client, businessDate, effectiveNow, schedulerRun);
      await markSchedulerSuccess(client, schedulerRun.id, effectiveNow);
      return {
        ok: true,
        skipped: true,
        reason: "canonical_packet_already_generated_for_scheduled_day",
        schedule,
        businessDate,
        packet: existing,
      };
    }
    const decision = resolveSchedulerExecutionDecision({
      regenerate: args.regenerate === true,
      recovery: recoveryDecision(effectiveNow, schedulerRun, {
        maxAttempts: Number(process.env.EXECUTIVE_DAILY_BRIEF_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS),
      }),
    });
    if (decision.action === "skip") return { ok: true, skipped: true, reason: decision.reason, schedule, businessDate, schedulerRun };
    if (decision.action === "fail") throw new Error(`Executive Intelligence scheduler cannot run: ${decision.reason}.`);

    schedulerRun = await claimSchedulerRun(client, businessDate, effectiveNow, schedulerRun);
    try {
      runCompiler({ businessDate, localRunDate: schedule.currentLocalDate });
    } catch (error) {
      const failure = await markSchedulerFailure(client, schedulerRun, effectiveNow, error, {
        maxAttempts: Number(process.env.EXECUTIVE_DAILY_BRIEF_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS),
      });
      console.error(JSON.stringify({ event: "executive_intelligence_schedule_failure", businessDate, runId: schedulerRun.id, ...failure }));
      throw error;
    }
    const packet = await findPacketForScheduledDay(client, {
      businessDate,
      localRunDate: schedule.currentLocalDate,
      timezone,
    });
    if (!packet) {
      const failure = await markSchedulerFailure(client, schedulerRun, effectiveNow, new Error(
        `Executive Daily Brief compiler exited successfully but no canonical packet was found for businessDate=${businessDate} and localRunDate=${schedule.currentLocalDate}.`,
      ), {
        maxAttempts: Number(process.env.EXECUTIVE_DAILY_BRIEF_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS),
      });
      console.error(JSON.stringify({ event: "executive_intelligence_schedule_failure", businessDate, runId: schedulerRun.id, ...failure }));
      throw new Error(failure.message);
    }
    assertCompletedDailyBriefPacket(packet, { businessDate });
    await markSchedulerSuccess(client, schedulerRun.id, effectiveNow);
    return { ok: true, skipped: false, schedule, businessDate, packet };
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runScheduledDailyExecutiveBrief()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(`[executive-daily-brief-schedule] ${error.stack ?? error.message}`);
      process.exit(1);
    });
}
