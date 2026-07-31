#!/usr/bin/env node

/**
 * Sync Job Planner daily reports into Alleato `daily_logs`.
 *
 * Deliberately lightweight: syncs status, date, weather, and a text summary of
 * work performed / notes / delays. Does NOT run photo attachments through any
 * AI vision pipeline — that stays owned by the site-scribe capture flow.
 *
 * Job Planner surfaces used:
 *   GET /projects/{jp}/dailyreports?startDate=...&endDate=...   -> list (id, date, status, delay)
 *   GET /projects/{jp}/dailyreports?reportDate=YYYY-MM-DD        -> detail (workLogs, notes, weather, delay)
 *
 * Only list rows with status !== 0 (submitted) or wasDelayed/delayNotes set are
 * fetched in detail and imported — draft/empty Job Planner reports are skipped
 * so we don't flood daily_logs with hundreds of blank rows per project.
 *
 * Safety: an existing app daily_logs row is left untouched (reported as
 * "skipped: human data present") unless it is empty or was itself produced by
 * a prior run of this importer (general_notes carries the IMPORT_MARKER).
 *
 * Usage:
 *   node scripts/jobplanner/import-daily-reports.mjs --jp=<jpProjectId> --app=<appProjectId> [--dry-run] [--since=YYYY-MM-DD]
 *   node scripts/jobplanner/import-daily-reports.mjs --batch [--dry-run] [--since=YYYY-MM-DD]   # all active matched projects
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const API_V1 = "https://api.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const IMPORT_MARKER = "Imported from Job Planner";
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-10-jobplanner-daily-reports-sync");

const argValue = (name, fallback = null) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = process.argv.includes("--batch");
const JP_PROJECT_ID = Number(argValue("jp"));
const APP_PROJECT_ID = Number(argValue("app"));
const SINCE = argValue("since", "2023-01-01");
const UNTIL = argValue("until", new Date().toISOString().slice(0, 10));

if (!BATCH && (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID))) {
  console.error(
    "Usage: node scripts/jobplanner/import-daily-reports.mjs --jp=<jobplannerProjectId> --app=<alleatoProjectId> [--dry-run] [--since=YYYY-MM-DD]\n" +
      "   or: node scripts/jobplanner/import-daily-reports.mjs --batch [--dry-run] [--since=YYYY-MM-DD]",
  );
  process.exit(1);
}

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

if (!JP_KEY) {
  console.error("Missing JOBPLANNER_API_KEY.");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function jpGet(url, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      headers: { ApiKey: JP_KEY, Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw new Error(`Job Planner request timed out after ${timeoutMs}ms on ${url.replace(API_V1, "")}`);
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`Job Planner ${response.status} on ${url.replace(API_V1, "")}`);
  }
  return response.json();
}

const normNum = (s) => {
  const m = String(s ?? "").match(/(\d{2})\s*-\s*(\d{2,3})/);
  return m ? `${m[1]}-${m[2]}` : null;
};

function jpStatusToDailyLogStatus(jpStatus) {
  return Number(jpStatus) === 1 ? "complete" : "draft";
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildGeneralNotes(report) {
  const lines = [`${IMPORT_MARKER} (daily report #${report.dailyReportId}, ${report.reportDate.slice(0, 10)})`];

  for (const log of report.workLogs ?? []) {
    const company = cleanText(log.workBy?.companyName) || cleanText(log.workBy?.contactName);
    const desc = cleanText(log.description);
    if (!desc) continue;
    lines.push(company ? `${company} — ${desc}` : desc);
  }

  for (const note of report.notes ?? []) {
    const desc = cleanText(note.description) || cleanText(note.text) || cleanText(note.note);
    if (desc) lines.push(desc);
  }

  if (report.wasDelayed) {
    const delayNote = cleanText(report.delayNotes);
    lines.push(delayNote ? `Delayed: ${delayNote}` : "Delayed (no reason given in Job Planner)");
  }

  return lines.join("\n");
}

function buildWeatherSummary(weather) {
  if (!weather || typeof weather !== "object") return null;
  const parts = [weather.sky, weather.temperature ? `${weather.temperature}°` : null, weather.precipitation, weather.wind, weather.comments]
    .map(cleanText)
    .filter(Boolean);
  return parts.length ? parts.join(" / ") : null;
}

async function syncProject(sb, { jpProjectId, appProjectId, label }) {
  const result = { jpProjectId, appProjectId, label, imported: 0, updated: 0, skippedHumanData: 0, skippedEmpty: 0, errors: [] };

  const listUrl = `${API_V1}/projects/${jpProjectId}/dailyreports?startDate=${SINCE}&endDate=${UNTIL}`;
  let list;
  try {
    list = await jpGet(listUrl);
  } catch (e) {
    result.errors.push(`list: ${e.message}`);
    return result;
  }

  const candidates = list.filter((r) => Number(r.status) !== 0 || r.wasDelayed || cleanText(r.delayNotes));
  result.jpTotalReports = list.length;
  result.jpCandidateReports = candidates.length;

  const { data: existingRows, error: existingErr } = await sb
    .from("daily_logs")
    .select("id, log_date, general_notes, site_scribe_session_id")
    .eq("project_id", appProjectId);
  if (existingErr) {
    result.errors.push(`existing rows read: ${existingErr.message}`);
    return result;
  }
  const existingByDate = new Map((existingRows ?? []).map((r) => [r.log_date, r]));

  let processed = 0;
  for (const candidate of candidates) {
    processed += 1;
    if (candidates.length > 20 && processed % 20 === 0) {
      console.log(`  ...${label}: ${processed}/${candidates.length} candidates processed`);
    }
    const date = candidate.reportDate.slice(0, 10);
    let detail;
    try {
      detail = await jpGet(`${API_V1}/projects/${jpProjectId}/dailyreports?reportDate=${date}`);
    } catch (e) {
      result.errors.push(`detail ${date}: ${e.message}`);
      continue;
    }

    const generalNotes = buildGeneralNotes(detail);
    const hasRealContent =
      (detail.workLogs ?? []).some((l) => cleanText(l.description)) ||
      (detail.notes ?? []).length > 0 ||
      detail.wasDelayed;
    if (!hasRealContent) {
      result.skippedEmpty += 1;
      continue;
    }

    const existing = existingByDate.get(date);
    if (existing && existing.site_scribe_session_id) {
      result.skippedHumanData += 1;
      continue;
    }
    if (existing && cleanText(existing.general_notes) && !existing.general_notes.startsWith(IMPORT_MARKER)) {
      result.skippedHumanData += 1;
      continue;
    }

    const row = {
      project_id: appProjectId,
      log_date: date,
      status: jpStatusToDailyLogStatus(detail.status),
      general_notes: generalNotes,
      weather_conditions: buildWeatherSummary(detail.weather),
      updated_at: new Date().toISOString(),
    };
    if (row.status === "complete") {
      row.completed_at = new Date(candidate.reportDate).toISOString();
    }

    if (DRY_RUN) {
      existing ? (result.updated += 1) : (result.imported += 1);
      continue;
    }

    const { error: upsertErr } = await sb.from("daily_logs").upsert(row, { onConflict: "project_id,log_date" });
    if (upsertErr) {
      result.errors.push(`upsert ${date}: ${upsertErr.message}`);
      continue;
    }
    existing ? (result.updated += 1) : (result.imported += 1);
  }

  return result;
}

async function resolveBatchProjects(sb) {
  const { data: appProjects, error } = await sb.from("projects").select("id, project_number, name, phase, archived");
  if (error) throw new Error(`projects read: ${error.message}`);
  const active = appProjects.filter((p) => !p.archived && p.phase === "Current");

  const jpProjects = await jpGet(`${API_V1}/projects`);
  const jpByNum = new Map();
  for (const j of jpProjects) {
    const n = normNum(j.projectName);
    if (n && !jpByNum.has(n)) jpByNum.set(n, j);
  }

  const matched = [];
  for (const p of active) {
    const n = normNum(p.project_number);
    const jp = n ? jpByNum.get(n) : null;
    if (jp) matched.push({ jpProjectId: jp.projectId, appProjectId: p.id, label: `${p.project_number} ${p.name}` });
  }
  return matched;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const targets = BATCH
    ? await resolveBatchProjects(sb)
    : [{ jpProjectId: JP_PROJECT_ID, appProjectId: APP_PROJECT_ID, label: `JP ${JP_PROJECT_ID} -> app ${APP_PROJECT_ID}` }];

  console.log(
    `Syncing Job Planner daily reports for ${targets.length} project(s), window ${SINCE}..${UNTIL}${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  const results = [];
  for (const target of targets) {
    console.log(`\n=== ${target.label} ===`);
    const result = await syncProject(sb, target);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }

  const totals = results.reduce(
    (acc, r) => ({
      imported: acc.imported + r.imported,
      updated: acc.updated + r.updated,
      skippedHumanData: acc.skippedHumanData + r.skippedHumanData,
      skippedEmpty: acc.skippedEmpty + r.skippedEmpty,
      errors: acc.errors + r.errors.length,
    }),
    { imported: 0, updated: 0, skippedHumanData: 0, skippedEmpty: 0, errors: 0 },
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, `sync-results${DRY_RUN ? "-dry-run" : ""}.json`),
    JSON.stringify({ generatedAt: new Date().toISOString(), since: SINCE, until: UNTIL, dryRun: DRY_RUN, totals, results }, null, 2) + "\n",
  );

  console.log("\n=== TOTALS ===");
  console.log(JSON.stringify(totals, null, 2));

  if (totals.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
