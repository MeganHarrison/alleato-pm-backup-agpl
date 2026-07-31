#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "../../scripts/verify/app-db-connection.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), quiet: true });

const args = parseArgs(process.argv.slice(2));
const start = requireDateArg("start");
const end = requireDateArg("end");
const evidenceRoot =
  stringArg("evidence-dir") ||
  stringArg("evidenceDir") ||
  "docs/ops/evidence/2026-07-07-daily-deep-read-backfill";
const maxDocumentsPerDay = numberArg("maxDocumentsPerDay", 125);
const maxSourceCharsPerDay = numberArg("maxSourceCharsPerDay", 900_000);
const dryRun = Boolean(args["dry-run"] || args.dryRun);
const noWrite = Boolean(args["no-write"] || args.noWrite);
const shouldWrite = !dryRun && !noWrite;
const forceAbnormalDays = Boolean(args.forceAbnormalDays || args["force-abnormal-days"]);
const stopOnError = Boolean(args.stopOnError || args["stop-on-error"]);
const model = stringArg("model");

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith("--") ? next : true;
    if (parsed[key] === next) index += 1;
  }
  return parsed;
}

function stringArg(key) {
  return typeof args[key] === "string" && args[key].trim() ? args[key].trim() : null;
}

function numberArg(key, fallback) {
  const value = Number(args[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function requireDateArg(key) {
  const value = stringArg(key);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`--${key} YYYY-MM-DD is required.`);
  }
  return value;
}

function datesInclusive(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T12:00:00.000Z`);
  const endCursor = new Date(`${endDate}T12:00:00.000Z`);
  if (cursor > endCursor) throw new Error("--start must be before or equal to --end.");
  while (cursor <= endCursor) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function businessDayBoundsUtc(date) {
  const startDate = new Date(`${date}T00:00:00.000-04:00`);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { startIso: startDate.toISOString(), endIso: endDate.toISOString() };
}

async function withPg(rawUrl, options, callback) {
  const pool = new pg.Pool({
    connectionString: await buildAppDatabaseConnectionString(rawUrl, options),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query("set statement_timeout = '45000ms'");
    return await callback(client);
  } finally {
    client.release();
    await pool.end();
  }
}

function laneSql() {
  return `
    case
      when coalesce(source_system,'') ilike '%fireflies%'
        or coalesce(type,'') ilike '%meeting%'
        or coalesce(category,'') ilike '%meeting%'
        or coalesce(source,'') = 'fireflies'
      then 'meetings'
      when coalesce(source_system,'') ilike '%teams%'
        or coalesce(source,'') ilike '%teams%'
        or coalesce(type,'') ilike '%teams%'
      then 'teams'
      when coalesce(source_system,'') ilike '%outlook%'
        or coalesce(type,'') ilike '%email%'
        or coalesce(source,'') ilike '%email%'
      then 'emails'
      else 'documents'
    end
  `;
}

async function preflightDate(date) {
  const bounds = businessDayBoundsUtc(date);
  const laneCounts = await withPg(
    getRagDatabaseUrl(),
    { includeSslMode: false, rewriteSupabaseDirectHost: false },
    async (client) => {
      const { rows } = await client.query(
        `
          with src as (
            select
              ${laneSql()} as lane,
              length(coalesce(content, raw_text, summary, overview, ''))::int as source_chars
            from public.rag_document_metadata
            where coalesce(last_content_loaded_at, last_indexed_at, last_synced_at, updated_at, created_at)
              >= $1::timestamptz
              and coalesce(last_content_loaded_at, last_indexed_at, last_synced_at, updated_at, created_at)
              < $2::timestamptz
              and source is distinct from 'ai_memory'
          )
          select lane, count(*)::int as count, coalesce(sum(source_chars), 0)::int as source_chars
          from src
          group by lane
        `,
        [bounds.startIso, bounds.endIso],
      );
      return Object.fromEntries(
        rows.map((row) => [
          row.lane,
          { count: row.count, sourceChars: row.source_chars },
        ]),
      );
    },
  );

  const normalized = {
    meetings: laneCounts.meetings?.count ?? 0,
    emails: laneCounts.emails?.count ?? 0,
    teams: laneCounts.teams?.count ?? 0,
    documents: laneCounts.documents?.count ?? 0,
  };
  const sourceChars = {
    meetings: laneCounts.meetings?.sourceChars ?? 0,
    emails: laneCounts.emails?.sourceChars ?? 0,
    teams: laneCounts.teams?.sourceChars ?? 0,
    documents: laneCounts.documents?.sourceChars ?? 0,
  };
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const totalSourceChars = Object.values(sourceChars).reduce((sum, value) => sum + value, 0);
  return {
    date,
    bounds,
    laneCounts: normalized,
    sourceChars,
    total,
    totalSourceChars,
    threshold: { maxDocumentsPerDay, maxSourceCharsPerDay },
  };
}

async function packetForDate(date) {
  return withPg(getAppDatabaseUrl(), { includeSslMode: false }, async (client) => {
    const { rows } = await client.query(
      `
        select p.id, p.packet_type, p.generated_at, p.packet_json->>'kind' as kind
        from public.intelligence_packets p
        join public.intelligence_targets t on t.id = p.target_id
        where t.slug = 'daily-executive-brief'
          and coalesce(p.packet_json->>'businessDate', p.covered_start_at::date::text) = $1
        order by p.generated_at desc
        limit 1
      `,
      [date],
    );
    return rows[0] ?? null;
  });
}

function runNodeScript(scriptPath, scriptArgs) {
  const command = [scriptPath, ...scriptArgs];
  const result = spawnSync(process.execPath, command, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    command: `${process.execPath} ${command.join(" ")}`,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseLastJson(stdout) {
  const text = String(stdout || "").trim();
  const start = text.lastIndexOf("\n{");
  const candidate = start >= 0 ? text.slice(start + 1) : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function processDate(date) {
  const dayDir = path.join(process.cwd(), evidenceRoot, date);
  await fs.mkdir(dayDir, { recursive: true });
  const preflight = await preflightDate(date);
  await writeJson(path.join(dayDir, "preflight.json"), preflight);

  const isAbnormal =
    preflight.laneCounts.documents > maxDocumentsPerDay ||
    preflight.totalSourceChars > maxSourceCharsPerDay;
  if (isAbnormal && !forceAbnormalDays) {
    const reasons = [
      preflight.laneCounts.documents > maxDocumentsPerDay
        ? `documents=${preflight.laneCounts.documents} exceeds maxDocumentsPerDay=${maxDocumentsPerDay}`
        : null,
      preflight.totalSourceChars > maxSourceCharsPerDay
        ? `sourceChars=${preflight.totalSourceChars} exceeds maxSourceCharsPerDay=${maxSourceCharsPerDay}`
        : null,
    ].filter(Boolean);
    return {
      date,
      status: "skipped_abnormal_volume",
      reason: reasons.join("; "),
      preflight,
      packet: await packetForDate(date),
    };
  }

  if (!shouldWrite) {
    return {
      date,
      status: isAbnormal ? "dry_run_forced_abnormal_volume" : "dry_run_ready",
      reason: "Dry run only; no model or database writes executed.",
      preflight,
      packet: await packetForDate(date),
    };
  }

  const briefArgs = [
    "project-intelligence/core/compile-daily-executive-brief.mjs",
    "--date",
    date,
    "--packetType",
    "snapshot",
    "--evidence-dir",
    evidenceRoot,
    // Backfill owns the consumer step below so it can capture per-day evidence;
    // skip the brief runner's built-in consumer chaining to avoid a double run.
    "--skip-consumers",
  ];
  if (model) briefArgs.push("--model", model);
  const briefRun = runNodeScript(briefArgs[0], briefArgs.slice(1));
  const briefJson = parseLastJson(briefRun.stdout);
  await writeJson(path.join(dayDir, "brief-run.json"), { ...briefRun, parsed: briefJson });
  if (briefRun.exitCode !== 0 || !briefJson?.packet?.packetId) {
    return {
      date,
      status: "brief_failed",
      reason: "Daily Deep Read packet generation failed.",
      preflight,
      briefRun: { exitCode: briefRun.exitCode, stderr: briefRun.stderr.slice(0, 4000) },
    };
  }

  const packetId = briefJson.packet.packetId;
  const consumerRun = runNodeScript("project-intelligence/projections/daily-deep-read-consumers.mjs", ["--packetId", packetId]);
  const consumerJson = parseLastJson(consumerRun.stdout);
  await writeJson(path.join(dayDir, "consumer-run.json"), { ...consumerRun, parsed: consumerJson });
  if (consumerRun.exitCode !== 0) {
    return {
      date,
      status: "consumer_failed",
      reason: "Daily Deep Read consumer failed.",
      preflight,
      packetId,
      consumerRun: { exitCode: consumerRun.exitCode, stderr: consumerRun.stderr.slice(0, 4000) },
    };
  }

  return {
    date,
    status: isAbnormal ? "completed_forced_abnormal_volume" : "completed",
    preflight,
    packetId,
    brief: briefJson,
    consumer: consumerJson,
  };
}

async function main() {
  const dates = datesInclusive(start, end);
  const summary = {
    ok: true,
    startedAt: new Date().toISOString(),
    completedAt: null,
    start,
    end,
    dryRun,
    shouldWrite,
    maxDocumentsPerDay,
    maxSourceCharsPerDay,
    forceAbnormalDays,
    evidenceRoot: path.join(process.cwd(), evidenceRoot),
    days: [],
  };

  for (const date of dates) {
    try {
      const result = await processDate(date);
      summary.days.push(result);
      if (stopOnError && /failed$/.test(result.status)) break;
    } catch (error) {
      const failed = {
        date,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      };
      summary.days.push(failed);
      if (stopOnError) break;
    }
    await writeJson(path.join(process.cwd(), evidenceRoot, "backfill-summary.json"), summary);
  }

  summary.completedAt = new Date().toISOString();
  summary.ok = summary.days.every((day) => !/failed$/.test(day.status));
  await writeJson(path.join(process.cwd(), evidenceRoot, "backfill-summary.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
