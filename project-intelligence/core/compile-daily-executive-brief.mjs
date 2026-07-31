#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "../../scripts/verify/app-db-connection.mjs";
import {
  renderBriefMarkdownV3,
  validateBriefV3,
} from "./brief-v3.mjs";
import {
  annotateSourceProjectMentions,
  buildSourcesMap,
  collectCitedAliases,
  draftExecutiveBrief,
  parseModelJson,
} from "./executive-synthesis.mjs";
import { callModel, isProviderAvailabilityError } from "./model-transport.mjs";
import { writeIntelligencePacket } from "./packet-repository.mjs";
import {
  applySharePointAttributionEvidence,
  buildSharePointAttributionIndex,
  fetchSharePointAttributionRows,
} from "./project-attribution-evidence.mjs";
import {
  assertBriefProjectCoverage,
  assertProjectRecordCoverage,
  extractProjectRecords,
} from "./project-records.mjs";
import { runConsumersForPacket } from "../projections/run-consumers.mjs";
import {
  buildLaneReadReceipts,
  canonicalSourceProvenance,
  chunkSourcesForModel,
  fetchCompleteSourceRows,
  packSourceChunks,
} from "../ingestion/daily-source-corpus.mjs";
import { RAG_DATABASE_CONNECTION_OPTIONS } from "../ingestion/rag-database-connection.mjs";
import { previousBusinessDateInTimeZone } from "../runner/daily-executive-brief-schedule.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), quiet: true });

const COMPILER_VERSION = "manual_daily_executive_brief_v1";
const TIME_ZONE = "America/New_York";
const args = parseArgs(process.argv.slice(2));
const businessDate = args.date ?? previousBusinessDateInTimeZone(new Date(), TIME_ZONE);
const shouldWrite = !args["no-write"] && !args["dry-run"];
const model = args.model ?? "openai/gpt-5.6-terra";
const modelCall = (messages, maxCompletionTokens = 2200, options = {}) =>
  callModel(messages, { model, maxCompletionTokens, ...options });
const packetType = args.packetType ?? "current";
if (!["current", "snapshot"].includes(packetType)) {
  throw new Error(`--packetType must be current or snapshot, received: ${packetType}`);
}

const windowBounds = resolveWindowBounds(businessDate, args);
const evidenceRoot =
  (typeof args.evidenceDir === "string" && args.evidenceDir) ||
  (typeof args["evidence-dir"] === "string" && args["evidence-dir"]) ||
  "tmp/evidence/2026-07-07-manual-daily-executive-brief";
const evidenceDir = path.join(process.cwd(), evidenceRoot, businessDate);

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

function businessDayBoundsUtc(date) {
  // The source day is the completed New York business day. EDT is fixed for July
  // 2026; this runner is intentionally date-scoped for the current emergency path.
  const start = new Date(`${date}T00:00:00.000-04:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() };
}

function parseRequiredDateArg(value, flagName) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${flagName} must be an ISO timestamp, received: ${value}`);
  }
  return parsed;
}

function resolveWindowBounds(date, parsedArgs) {
  const defaultBounds = businessDayBoundsUtc(date);
  const start =
    parseRequiredDateArg(parsedArgs.coveredStartAt, "--coveredStartAt") ??
    parseRequiredDateArg(parsedArgs["covered-start-at"], "--covered-start-at") ??
    defaultBounds.start;
  const end =
    parseRequiredDateArg(parsedArgs.coveredEndAt, "--coveredEndAt") ??
    parseRequiredDateArg(parsedArgs["covered-end-at"], "--covered-end-at") ??
    defaultBounds.end;
  if (end <= start) {
    throw new Error(`Covered end must be after covered start: ${start.toISOString()} >= ${end.toISOString()}`);
  }
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() };
}

function parseDateFromText(text) {
  if (!text) return null;
  const rawDate =
    text.match(/\*\*Date:\*\*\s*([^\n]+)/i)?.[1]?.trim() ??
    text.match(/^Date:\s*([^\n]+)/im)?.[1]?.trim();
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
      date: parsed,
      // "Date: 2026-07-07" is a day label, not an event time. Time-of-day is the
      // signal that the header carries a real timestamp.
      dateOnly: !/\d{1,2}:\d{2}/.test(rawDate),
      dateString: rawDate.match(/(20\d{2}-\d{2}-\d{2})/)?.[1] ?? null,
    };
  }
  const bracketDate = text.match(/\[(20\d{2}-\d{2}-\d{2})[^\]]*\]/)?.[1];
  if (bracketDate) {
    return {
      date: new Date(`${bracketDate}T12:00:00.000-04:00`),
      dateOnly: true,
      dateString: bracketDate,
    };
  }
  return null;
}

// Teams ingestion (backend/src/services/integrations/microsoft_graph/teams.py) writes
// message markers as `[{createdDateTime[:19] with T→space}]` from Microsoft Graph,
// so these per-message timestamps are UTC.
const TEAMS_MESSAGE_TIMESTAMP_PATTERN = /\[(20\d{2}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\]/g;

function parseTeamsMessageTimestamps(text) {
  const timestamps = [];
  for (const match of String(text ?? "").matchAll(TEAMS_MESSAGE_TIMESTAMP_PATTERN)) {
    const parsed = new Date(`${match[1]}T${match[2]}.000Z`);
    if (!Number.isNaN(parsed.getTime())) timestamps.push(parsed);
  }
  return timestamps;
}

function rowFallbackTimestamp(row) {
  const fallback =
    row.source_at ??
    row.last_content_loaded_at ??
    row.last_indexed_at ??
    row.last_synced_at ??
    row.updated_at ??
    row.created_at;
  const parsed = fallback ? new Date(fallback) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r\n/g, "\n")
    .trim();
}

function classifyLane(row) {
  const type = String(row.type ?? "").toLowerCase();
  const source = String(row.source ?? "").toLowerCase();
  if (source === "fireflies" || type === "meeting") return "meetings";
  if (type.includes("team") || type.includes("teams")) return "teams";
  if (type.includes("email") || row.source_system === "outlook_email") return "emails";
  if (source === "ai_memory") return "ignored";
  return "documents";
}

const FULL_DAY_MS = 24 * 60 * 60 * 1000;
const windowIsFullDayOrLonger =
  windowBounds.end.getTime() - windowBounds.start.getTime() >= FULL_DAY_MS;

function isInWindow(timeMs) {
  return timeMs >= windowBounds.start.getTime() && timeMs < windowBounds.end.getTime();
}

function includeByRowFallback(row, basis) {
  const fallbackDate = rowFallbackTimestamp(row);
  return {
    include: fallbackDate !== null && isInWindow(fallbackDate.getTime()),
    basis,
    sourceAt: fallbackDate ? fallbackDate.toISOString() : null,
  };
}

function isIncludedForBusinessDate(row, text, lane) {
  if (lane === "teams") {
    // Teams content headers carry a date-only day label; the real event times are
    // the per-message UTC timestamps. Include the conversation row if any message
    // falls inside the covered window.
    const messageTimes = parseTeamsMessageTimestamps(text);
    if (messageTimes.length > 0) {
      const inWindowTimes = messageTimes.filter((time) => isInWindow(time.getTime()));
      const anchor = inWindowTimes[inWindowTimes.length - 1] ?? messageTimes[messageTimes.length - 1];
      return {
        include: inWindowTimes.length > 0,
        basis: "teams-message-timestamps-utc",
        sourceAt: anchor.toISOString(),
        inWindowMessageCount: inWindowTimes.length,
        messageCount: messageTimes.length,
      };
    }
    return includeByRowFallback(row, "loaded-or-row-timestamp");
  }

  const parsed = parseDateFromText(text);
  if (parsed && !parsed.dateOnly) {
    return {
      include: isInWindow(parsed.date.getTime()),
      basis: "parsed-source-timestamp",
      sourceAt: parsed.date.toISOString(),
    };
  }
  if (parsed?.dateOnly) {
    // A date-only header is day evidence: it may include a row on a full-day run,
    // but it must never exclude a row from a sub-day window — midnight coercion is
    // what silently dropped every Teams row from the July 7 workday packet.
    if (windowIsFullDayOrLonger && parsed.dateString === businessDate) {
      return {
        include: true,
        basis: "date-only-source-day",
        sourceAt: parsed.date.toISOString(),
      };
    }
    return includeByRowFallback(row, "row-timestamp-with-date-only-header");
  }
  return includeByRowFallback(row, "loaded-or-row-timestamp");
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

async function fetchRows() {
  return withPg(
    getRagDatabaseUrl(),
    // Supabase's direct database host can resolve to an IPv6-only address from
    // Render. Use the same regional Supavisor normalization as the app DB so
    // the scheduled compiler does not fail before it can read source rows.
    RAG_DATABASE_CONNECTION_OPTIONS,
    (client) =>
      fetchCompleteSourceRows(client, {
        startIso: windowBounds.startIso,
        endIso: windowBounds.endIso,
        pageSize: Number(process.env.EXECUTIVE_DAILY_BRIEF_SOURCE_PAGE_SIZE ?? 500),
      }),
  );
}

// Project names live in the PM APP `projects` table, not the RAG DB the corpus
// is drawn from. Resolve id -> name so the brief never surfaces a bare numeric
// project id (e.g. "Project 67") to the owner — always a real name.
async function fetchProjectNames(projectIds) {
  const ids = [
    ...new Set(
      projectIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id)),
    ),
  ];
  if (ids.length === 0) return new Map();
  return withPg(
    getAppDatabaseUrl(),
    { includeSslMode: false, rewriteSupabaseDirectHost: false },
    async (client) => {
      const { rows } = await client.query(
        `select id, name, project_number
           from public.projects
          where id = any($1::int[])`,
        [ids],
      );
      const map = new Map();
      for (const row of rows) {
        // `projects.id` is int8, which node-pg returns as a string — coerce to
        // Number so the key matches the numeric lookup below.
        const id = Number(row.id);
        const label =
          (typeof row.name === "string" && row.name.trim()) ||
          (typeof row.project_number === "string" && row.project_number.trim()) ||
          null;
        if (Number.isFinite(id) && label) map.set(id, label);
      }
      return map;
    },
  );
}

// --- #807: attribution backstop -----------------------------------------------
// The upstream classifier that stamps rag_document_metadata.project_id sometimes
// gets it wrong (e.g. a "Shawnee Collective Reconnect" email labeled Westfield
// Collective). Fixing the classifier is the real fix; here we backstop it, but
// CONSERVATIVELY: only when a source's title contains the FULL, specific name of
// exactly one real project that differs from the assigned one. Matching on loose
// tokens ("sprinkler", "alleato") over-corrects and corrupts attribution, so we
// deliberately don't — a false correction is worse than a missed one.

function normalizeForMatch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

// All real (non-internal) projects with their normalized names for exact matching.
async function fetchAllProjects() {
  return withPg(
    getAppDatabaseUrl(),
    { includeSslMode: false, rewriteSupabaseDirectHost: false },
    async (client) => {
      const { rows } = await client.query(
        "select id, name, project_number, type from public.projects where name is not null",
      );
      return rows
        .filter((row) => {
          const name = String(row.name || "");
          return (
            !/^temporary project code/i.test(name) &&
            !/^budget audit seed/i.test(name) &&
            row.type !== "Internal"
          );
        })
        .map((row) => ({
          id: Number(row.id),
          name: row.name,
          projectNumber: row.project_number,
          normalizedName: normalizeForMatch(row.name),
        }));
    },
  );
}

async function fetchSharePointAttributionIndex(projects) {
  return withPg(
    getAppDatabaseUrl(),
    { includeSslMode: false, rewriteSupabaseDirectHost: false },
    async (client) => {
      const rows = await fetchSharePointAttributionRows(client);
      return buildSharePointAttributionIndex(rows, projects);
    },
  );
}

// The single project whose FULL name appears as a whole phrase in the title, or
// null. Requires a name specific enough to be an identifier (>= 8 chars) matched
// on word boundaries. Ambiguous (0 or >1 matches) → null. Never a guess.
function projectIdFromTitle(title, projects) {
  const norm = ` ${normalizeForMatch(title)} `;
  if (norm.trim().length === 0) return null;
  const matches = projects.filter(
    (project) =>
      project.normalizedName &&
      project.normalizedName.length >= 8 &&
      norm.includes(` ${project.normalizedName} `),
  );
  return matches.length === 1 ? matches[0].id : null;
}

// Words that are a shared project-naming suffix — the last token of 2+ real
// project names (e.g. "collective" from Union/Westfield Collective). A one-off
// place name like "morrisville" (only Exol Morrisville) is NOT a category, so we
// won't treat "erw01 morrisville" as a sibling of "exol morrisville".
function categorySuffixWords(projects) {
  const counts = new Map();
  for (const project of projects) {
    const parts = (project.normalizedName || "").split(" ");
    const last = parts[parts.length - 1];
    if (last && last.length >= 6) counts.set(last, (counts.get(last) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([word]) => word));
}

// True when the title names a same-category SIBLING of the assigned project —
// e.g. assigned "Westfield Collective" but the title says "Shawnee Collective".
// Requires: assigned name absent from the title; the shared last word is a real
// category suffix (2+ projects); and the differing prefix is a plain word (not a
// code like "erw01"). Signals the source is about a different entity.
function titleNamesDifferentSibling(source, assignedNorm, categoryWords) {
  if (!assignedNorm) return false;
  const titleNorm = ` ${normalizeForMatch(source.title)} `;
  if (titleNorm.includes(` ${assignedNorm} `)) return false; // title names the assigned project → trust it
  const parts = assignedNorm.split(" ");
  if (parts.length < 2) return false;
  const category = parts[parts.length - 1];
  const assignedPrefix = parts[parts.length - 2];
  if (!categoryWords.has(category)) return false; // not a project-naming convention
  const re = new RegExp(`\\b([a-z]{4,})\\s+${category}\\b`, "g");
  for (const match of titleNorm.matchAll(re)) {
    if (match[1] !== assignedPrefix && match[1] !== category) return true;
  }
  return false;
}

// Backstop the upstream project classifier. Two conservative moves, both keyed
// on the source title. Mutates sources; returns corrections for the manifest/log.
function correctAttribution(sources, projects) {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const categoryWords = categorySuffixWords(projects);
  const corrections = [];
  for (const source of sources) {
    const assignedNorm = source.projectName ? normalizeForMatch(source.projectName) : "";
    const titleNamesAssigned = assignedNorm && ` ${normalizeForMatch(source.title)} `.includes(` ${assignedNorm} `);
    if (titleNamesAssigned) continue; // title confirms the assignment — leave it

    // 1. Title names the full name of a different REAL project → re-attribute to it.
    const titleProjectId = projectIdFromTitle(source.title, projects);
    if (titleProjectId && titleProjectId !== Number(source.projectId)) {
      const to = byId.get(titleProjectId);
      corrections.push({
        alias: source.alias,
        title: source.title,
        from: { projectId: source.projectId ?? null, projectName: source.projectName ?? null },
        to: { projectId: titleProjectId, projectName: to?.name ?? null },
      });
      source.projectId = titleProjectId;
      source.projectName = to?.name ?? null;
      source.attributionCorrected = true;
      continue;
    }

    // 2. Title names a same-category SIBLING that isn't a project (e.g. "Shawnee
    //    Collective" when only "Westfield Collective" exists) → de-attribute, so
    //    the brief doesn't confidently assert the wrong project.
    if (source.projectId != null && titleNamesDifferentSibling(source, assignedNorm, categoryWords)) {
      corrections.push({
        alias: source.alias,
        title: source.title,
        from: { projectId: source.projectId, projectName: source.projectName ?? null },
        to: { projectId: null, projectName: null },
        reason: "title names a different same-category entity than the assigned project",
      });
      source.projectId = null;
      source.projectName = null;
      source.attributionCorrected = true;
    }
  }
  return corrections;
}

function transcriptUrl(row) {
  const url = row.url || row.source_web_url;
  if (typeof url === "string" && url.includes("/storage/v1/object/public/transcripts/")) return url;
  return null;
}

async function downloadTranscriptMarkdown(row) {
  const url = transcriptUrl(row);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Transcript download failed ${response.status} for ${row.id}`);
  }
  const text = await response.text();
  return cleanText(text);
}

// Content signature for dedup: same title + same normalized body = the same
// message ingested twice (e.g. one email delivered to two mailboxes → two
// rag_document_metadata rows with different ids but identical content). Collapsing
// them stops the brief from citing / counting the same source twice (#806).
function contentSignature(title, text) {
  const normTitle = String(title || "").toLowerCase().replace(/\s+/g, " ").trim();
  const normText = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  const hash = crypto.createHash("sha1").update(normText).digest("hex").slice(0, 20);
  return `${normTitle}::${hash}`;
}

async function materializeSources(rows) {
  const sources = [];
  const skipped = [];
  const seenSignatures = new Map(); // content signature -> alias of the kept source
  for (const row of rows) {
    const lane = classifyLane(row);
    if (lane === "ignored") continue;
    let text = cleanText(row.content || row.raw_text || row.summary || row.overview);
    let usedStorage = false;
    if (lane === "meetings") {
      const markdown = await downloadTranscriptMarkdown(row).catch((error) => {
        skipped.push({ id: row.id, title: row.title, lane, reason: error.message });
        return null;
      });
      if (markdown) {
        text = markdown;
        usedStorage = true;
      }
    }
    if (!text) {
      skipped.push({ id: row.id, title: row.title, lane, reason: "source has no usable full content" });
      continue;
    }
    const inclusion = isIncludedForBusinessDate(row, text, lane);
    if (!inclusion.include) {
      skipped.push({
        id: row.id,
        title: row.title,
        lane,
        reason: `not in ${businessDate} by ${inclusion.basis}`,
        sourceAt: inclusion.sourceAt,
      });
      continue;
    }
    const hasTranscriptMarker = lane !== "meetings" || /##\s*Transcript/i.test(text);
    if (lane === "meetings" && !hasTranscriptMarker) {
      skipped.push({ id: row.id, title: row.title, lane, reason: "meeting source lacks ## Transcript marker" });
      continue;
    }
    // #806 — deduplicate identical content before it gets an alias, so aliases
    // stay sequential and gap-free and the source counts are honest.
    const signature = contentSignature(row.title, text);
    const duplicateOf = seenSignatures.get(signature);
    if (duplicateOf) {
      skipped.push({ id: row.id, title: row.title, lane, reason: `duplicate content of ${duplicateOf}` });
      continue;
    }
    const alias = `S${sources.length + 1}`;
    seenSignatures.set(signature, alias);
    sources.push({
      id: row.id,
      ...canonicalSourceProvenance(row),
      // Short, stable, mangle-proof citation token. The model is only ever
      // shown this alias (never the raw id), so it cannot truncate a long
      // Outlook id into an ambiguous prefix. The packet manifest maps the alias
      // back to `id`, and the review-page/consumer resolvers do the same.
      alias,
      appDocumentId: row.app_document_id,
      title: row.title || row.file_name || row.id,
      lane,
      projectId: row.project_id,
      source: row.source,
      sourceSystem: row.source_system,
      type: row.type,
      category: row.category,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
      url: row.url || row.source_web_url,
      sourceAt: inclusion.sourceAt,
      inclusionBasis: inclusion.basis,
      usedStorage,
      hasTranscriptMarker,
      charCount: text.length,
      text,
    });
  }
  return { sources, skipped };
}

function assertSourceMaterializationComplete(sources, skipped) {
  const includedIds = new Set(sources.map((source) => String(source.id)));
  const allowedExclusion = (reason) =>
    String(reason).startsWith("not in ") || String(reason).startsWith("duplicate content of ");
  const criticalFailures = skipped.filter(
    (item) => !includedIds.has(String(item.id)) && !allowedExclusion(item.reason),
  );
  if (criticalFailures.length) {
    throw new Error(
      `Daily Source Corpus materialization failure: ${criticalFailures.length} eligible sources ` +
        `could not be read in full: ${JSON.stringify(criticalFailures.slice(0, 25))}.`,
    );
  }
  return {
    status: "complete",
    materializedSources: sources.length,
    excludedOutsideWindow: skipped.filter((item) => String(item.reason).startsWith("not in ")).length,
    deduplicatedSources: skipped.filter((item) => String(item.reason).startsWith("duplicate content of ")).length,
    criticalFailures: 0,
  };
}

function groupByLane(sources) {
  const grouped = { meetings: [], emails: [], teams: [], documents: [] };
  for (const source of sources) grouped[source.lane]?.push(source);
  return grouped;
}

function assertLaneCoverage(rows, sources) {
  const included = groupByLane(sources);
  const gaps = [];
  for (const lane of ["meetings", "emails", "teams", "documents"]) {
    if (included[lane].length > 0) continue;
    const inWindowRows = rows.filter((row) => {
      if (classifyLane(row) !== lane) return false;
      const fallback = rowFallbackTimestamp(row);
      return fallback !== null && isInWindow(fallback.getTime());
    });
    if (inWindowRows.length > 0) {
      gaps.push({ lane, inWindowRowCount: inWindowRows.length });
    }
  }
  if (gaps.length === 0) return;
  const message =
    `Lane coverage failure for ${businessDate}: rows exist inside the covered window ` +
    `but zero were included: ${JSON.stringify(gaps)}.`;
  if (shouldWrite && !args["allow-empty-lanes"]) {
    throw new Error(`${message} Fix source inclusion or pass --allow-empty-lanes to override.`);
  }
  console.warn(`[warn] ${message}`);
}

function renderCorpus(sources, skipped) {
  const lines = [
    `# Daily Executive Brief Source Corpus - ${businessDate}`,
    "",
    `Window: ${windowBounds.startIso} to ${windowBounds.endIso} (${TIME_ZONE} business day)`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Included Sources",
    "",
  ];
  const grouped = groupByLane(sources);
  for (const lane of ["meetings", "emails", "teams", "documents"]) {
    lines.push(`### ${lane}`, "");
    if (!grouped[lane].length) {
      lines.push("_No included sources._", "");
      continue;
    }
    for (const source of grouped[lane]) {
      lines.push(
        `- ${source.alias} = ${source.id} | ${source.title} | project=${source.attributionLabel ?? source.projectName ?? "unassigned"} | attribution=${source.attributionStatus ?? "not_evaluated"} | sourceAt=${source.sourceAt ?? "unknown"} | chars=${source.charCount} | basis=${source.inclusionBasis} | storage=${source.usedStorage ? "yes" : "no"}`,
      );
    }
    lines.push("");
  }
  lines.push("## Full Source Text", "");
  for (const source of sources) {
    lines.push(
      `### ${source.lane.toUpperCase()} | ${source.title}`,
      "",
      `Source ID: ${source.alias} = ${source.id}`,
      `Project: ${source.attributionLabel ?? source.projectName ?? "Unassigned"}`,
      `Attribution: ${source.attributionStatus ?? "not_evaluated"}`,
      `Source at: ${source.sourceAt ?? "unknown"}`,
      `URL: ${source.url ?? "none"}`,
      "",
      "```text",
      cleanText(source.text),
      "```",
      "",
    );
  }
  lines.push("## Skipped Candidates", "", "```json", JSON.stringify(skipped, null, 2), "```", "");
  return lines.join("\n");
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const { rows, receipt: corpusEnumerationReceipt } = await fetchRows();
  const { sources, skipped } = await materializeSources(rows);
  const projectNames = await fetchProjectNames(sources.map((s) => s.projectId));
  for (const source of sources) {
    const key = Number(source.projectId);
    source.projectName = Number.isFinite(key)
      ? (projectNames.get(key) ?? null)
      : null;
  }
  // #807: backstop the upstream project classifier against each source's title.
  const allProjects = await fetchAllProjects();
  const attributionCorrections = correctAttribution(sources, allProjects);
  // SharePoint job folders, proposals, and estimates are the authoritative
  // identity reference. Apply them before any model input is constructed so a
  // complete read can never become a confidently misattributed report.
  const sharePointAttributionIndex = await fetchSharePointAttributionIndex(allProjects);
  const sharePointAttribution = applySharePointAttributionEvidence(sources, sharePointAttributionIndex);
  attributionCorrections.push(...sharePointAttribution.corrections);
  annotateSourceProjectMentions(sources);
  if (attributionCorrections.length) {
    console.error(`[attribution] corrected ${attributionCorrections.length} source assignment(s) before synthesis:`);
    for (const correction of attributionCorrections) {
      console.error(
        `  ${correction.alias} "${correction.title}": ${correction.from.projectName ?? "unassigned"} -> ${correction.to.projectName ?? "unassigned"}`,
      );
    }
  }
  assertLaneCoverage(rows, sources);
  const materializationReceipt = assertSourceMaterializationComplete(sources, skipped);
  const laneCorpusReceipts = buildLaneReadReceipts(rows, sources, skipped, { classifyLane });
  const corpusMarkdown = renderCorpus(sources, skipped);
  await fs.writeFile(path.join(evidenceDir, "source-corpus.md"), corpusMarkdown);
  await fs.writeFile(
    path.join(evidenceDir, "source-manifest.json"),
    JSON.stringify(
      {
        businessDate,
        window: windowBounds,
        generatedAt: new Date().toISOString(),
        shouldWrite,
        rowsConsidered: rows.length,
        corpusEnumeration: corpusEnumerationReceipt,
        materialization: materializationReceipt,
        lanes: laneCorpusReceipts,
        fullContentRead: { status: "pending" },
        sharePointAttribution: {
          ...sharePointAttribution.receipt,
          unresolvedConflicts: sharePointAttribution.unresolvedConflicts,
        },
        attributionCorrections,
        sources: sources.map(({ text, ...source }) => source),
        skipped,
      },
      null,
      2,
    ),
  );

  if (args["sources-only"]) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "sources-only",
          businessDate,
          evidenceDir,
          rowsConsidered: rows.length,
          corpusEnumeration: corpusEnumerationReceipt,
          materialization: materializationReceipt,
          lanes: laneCorpusReceipts,
          sharePointAttribution: sharePointAttribution.receipt,
          included: Object.fromEntries(
            Object.entries(groupByLane(sources)).map(([key, value]) => [key, value.length]),
          ),
          skipped: skipped.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const { structured, laneNotes, detailedReport, sourceReadReceipt } = await draftExecutiveBrief({
    sources,
    corpusLaneReceipts: laneCorpusReceipts,
    businessDate,
    modelCall,
  });
  await fs.writeFile(
    path.join(evidenceDir, "source-manifest.json"),
    JSON.stringify(
      {
        businessDate,
        window: windowBounds,
        generatedAt: new Date().toISOString(),
        shouldWrite,
        rowsConsidered: rows.length,
        corpusEnumeration: corpusEnumerationReceipt,
        materialization: materializationReceipt,
        lanes: laneCorpusReceipts,
        fullContentRead: sourceReadReceipt,
        sharePointAttribution: {
          ...sharePointAttribution.receipt,
          unresolvedConflicts: sharePointAttribution.unresolvedConflicts,
        },
        attributionCorrections,
        sources: sources.map(({ text, ...source }) => source),
        skipped,
      },
      null,
      2,
    ),
  );
  // Fail before the second, more expensive per-project model pass if the brief
  // dropped an active project. This keeps an incomplete brief from consuming
  // more model budget and makes the first broken boundary explicit.
  const briefCoverage = assertBriefProjectCoverage(sources, structured);
  const briefMarkdown = detailedReport;
  const dashboardMarkdown = renderBriefMarkdownV3(structured);
  await fs.writeFile(path.join(evidenceDir, "brief.md"), briefMarkdown);
  await fs.writeFile(path.join(evidenceDir, "dashboard-brief.md"), dashboardMarkdown);
  await fs.writeFile(path.join(evidenceDir, "brief.json"), JSON.stringify(structured, null, 2));

  // Candidate B: structured per-project operating records (health/risks/etc).
  // Written to evidence ALWAYS (incl. --dry-run) so quality is inspectable
  // without a production packet write.
  const projectRecords = await extractProjectRecords({ sources, detailedReport, businessDate, modelCall });
  const projectCoverage = assertProjectRecordCoverage(sources, structured, projectRecords);
  await fs.writeFile(
    path.join(evidenceDir, "project-records.json"),
    JSON.stringify({ businessDate, coverage: projectCoverage, count: projectRecords.length, projectRecords }, null, 2),
  );

  let packet = null;
  let consumers = null;
  if (shouldWrite) {
    if (packetType === "current" && args["skip-consumers"]) {
      throw new Error("Refusing --packetType current with --skip-consumers: a current Daily Brief requires a completed run receipt.");
    }
    packet = await writeIntelligencePacket({
      sources,
      structured,
      briefMarkdown,
      dashboardMarkdown,
      laneNotes,
      projectRecords,
      corpusReceipt: {
        ...corpusEnumerationReceipt,
        ...materializationReceipt,
        lanes: laneCorpusReceipts,
        skippedRows: skipped.length,
        sharePointAttribution: {
          ...sharePointAttribution.receipt,
          unresolvedConflicts: sharePointAttribution.unresolvedConflicts,
        },
        attributionCorrections,
      },
      sourceReadReceipt,
      businessDate,
      windowBounds,
      packetType,
      compilerVersion: COMPILER_VERSION,
    });
    await fs.writeFile(path.join(evidenceDir, "packet-write.json"), JSON.stringify(packet, null, 2));
    if (!args["skip-consumers"]) {
      consumers = runConsumersForPacket(packet.packetId);
      await fs.writeFile(path.join(evidenceDir, "consumer-run.json"), JSON.stringify(consumers, null, 2));
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        businessDate,
        evidenceDir,
        rowsConsidered: rows.length,
        included: Object.fromEntries(Object.entries(groupByLane(sources)).map(([key, value]) => [key, value.length])),
        skipped: skipped.length,
        packet,
        consumers,
      },
      null,
      2,
    ),
  );
}

// Pure helpers exported for unit testing (no DB, no model). The CLI entry point
// only runs when this file is executed directly, not when imported.
export {
  parseModelJson,
  buildSourcesMap,
  collectCitedAliases,
  renderBriefMarkdownV3,
  validateBriefV3,
  contentSignature,
  projectIdFromTitle,
  correctAttribution,
  assertProjectRecordCoverage,
  assertBriefProjectCoverage,
  assertSourceMaterializationComplete,
  isProviderAvailabilityError,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
