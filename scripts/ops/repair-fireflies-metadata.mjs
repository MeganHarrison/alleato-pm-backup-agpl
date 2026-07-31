#!/usr/bin/env node

/**
 * Repairs only metadata with a deterministic authoritative source.
 *
 * The default is a no-write preflight. `--apply` is intentionally guarded by
 * exact expected counts so a changed inventory fails loudly instead of
 * broadening the repair silently.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXPECTED_MEETINGS = 23;
const EXPECTED_RAG_REPAIRS = 20;
const EXPECTED_UNRESOLVED = 14;
const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAuthoritativeDate(value) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function dateFromMarkdown(content) {
  const match = String(content || "").match(/^\*\*Date:\*\*\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/m);
  if (!match) return null;
  const [month, day, year] = match[1].split("/").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

async function fetchFirefliesTranscript(firefliesId) {
  const query = `query Transcript($transcriptId: String!) { transcript(id: $transcriptId) { id title date dateString } }`;
  const response = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${required("FIREFLIES_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { transcriptId: firefliesId } }),
  });
  if (!response.ok) throw new Error(`Fireflies GraphQL request failed: ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(`Fireflies GraphQL error: ${JSON.stringify(payload.errors)}`);
  return payload.data?.transcript || null;
}

function classifyRagRow(row) {
  const appHasCanonicalClassification = [row.app_source, row.app_category, row.app_type].every((value) => clean(value));
  if (appHasCanonicalClassification) {
    return { source: clean(row.app_source), category: clean(row.app_category), type: clean(row.app_type), evidence: "app_document_metadata" };
  }
  if (clean(row.app_source) === "fireflies" && clean(row.app_type) === "meeting") {
    return { source: "fireflies", category: "meeting", type: "meeting", evidence: "app_fireflies_meeting_contract" };
  }
  // A Fireflies transcript ID is a stable provider identity even when the
  // historical mirror omitted source_system; it is sufficient evidence for
  // the canonical meeting classification.
  if (clean(row.fireflies_id)) {
    return { source: "fireflies", category: "meeting", type: "meeting", evidence: "fireflies_identity" };
  }
  return null;
}

loadEnv(path.join(repoRoot, ".env"));
const appSql = postgres(required("DATABASE_URL"), { max: 1, ssl: "require", idle_timeout: 5 });
const ragSql = postgres(required("RAG_DATABASE_URL"), { max: 1, ssl: "require", idle_timeout: 5, prepare: false });

async function loadMeetingCandidates() {
  return appSql`
    select m.id as meeting_id, dm.id as document_id, dm.fireflies_id, dm.title,
      dm.date, dm.content, dm.raw_text
    from public.meetings m
    join public.document_metadata dm on dm.id = m.transcript_document_id
    where m.meeting_date is null and dm.source = 'fireflies'
    order by m.id
  `;
}

async function loadRagCandidates() {
  const ragRows = await ragSql`
    select id, app_document_id, title, source_system, fireflies_id, source, category, type
    from public.rag_document_metadata
    where coalesce(btrim(source), '') = ''
      and coalesce(btrim(category), '') = ''
      and coalesce(btrim(type), '') = ''
    order by id
  `;
  const appIds = ragRows.map((row) => row.app_document_id).filter(Boolean);
  if (!appIds.length) return ragRows;
  const appRows = await appSql`
    select id, source, category, type
    from public.document_metadata
    where id in ${appSql(appIds)}
  `;
  const appById = new Map(appRows.map((row) => [row.id, row]));
  return ragRows.map((row) => {
    const app = appById.get(row.app_document_id) || {};
    return { ...row, app_source: app.source, app_category: app.category, app_type: app.type };
  });
}

async function buildPlan() {
  const meetings = await loadMeetingCandidates();
  if (meetings.length !== EXPECTED_MEETINGS) throw new Error(`Expected ${EXPECTED_MEETINGS} Fireflies meetings without dates; found ${meetings.length}. Re-preflight before writing.`);
  const plannedMeetings = [];
  const apiCandidates = [];
  for (const row of meetings) {
    const date = parseAuthoritativeDate(row.date) || dateFromMarkdown(row.content) || dateFromMarkdown(row.raw_text);
    if (date) plannedMeetings.push({ ...row, meeting_date: date, evidence: row.date ? "document_date" : "markdown_date_header" });
    else apiCandidates.push(row);
  }
  if (apiCandidates.length !== 1 || !clean(apiCandidates[0].fireflies_id)) throw new Error(`Expected exactly one Fireflies API date lookup; found ${apiCandidates.length}.`);
  const apiCandidate = apiCandidates[0];
  const transcript = await fetchFirefliesTranscript(apiCandidate.fireflies_id);
  if (!transcript || transcript.id !== apiCandidate.fireflies_id || !clean(transcript.title) || clean(transcript.title) !== clean(apiCandidate.title)) {
    throw new Error(`Fireflies API identity mismatch for meeting ${apiCandidate.meeting_id}; refusing to infer a date.`);
  }
  const apiDate = parseAuthoritativeDate(transcript.dateString || transcript.date);
  if (!apiDate) throw new Error(`Fireflies transcript ${apiCandidate.fireflies_id} has no parseable authoritative date.`);
  plannedMeetings.push({ ...apiCandidate, meeting_date: apiDate, evidence: "fireflies_api" });

  const ragRows = await loadRagCandidates();
  const plannedRag = ragRows.map((row) => ({ ...row, repair: classifyRagRow(row) })).filter((row) => row.repair);
  const unresolved = ragRows.filter((row) => !classifyRagRow(row));
  if (plannedMeetings.length !== EXPECTED_MEETINGS || plannedRag.length !== EXPECTED_RAG_REPAIRS || unresolved.length !== EXPECTED_UNRESOLVED) {
    console.error(JSON.stringify({
      preflight_inventory: { meetings: plannedMeetings.length, rag_repairs: plannedRag.length, unresolved: unresolved.length },
      unresolved_rag_rows: unresolved.map(({ id, app_document_id, title, source_system, fireflies_id, app_source, app_category, app_type }) => ({ id, app_document_id, title, source_system, fireflies_id, app_source, app_category, app_type })),
    }, null, 2));
    throw new Error(`Preflight inventory changed: meetings=${plannedMeetings.length}, rag_repairs=${plannedRag.length}, unresolved=${unresolved.length}. Refusing to write.`);
  }
  return { plannedMeetings, plannedRag, unresolved };
}

async function applyPlan(plan) {
  const meetingUpdates = await appSql.begin(async (sql) => {
    const updates = [];
    for (const row of plan.plannedMeetings) {
      const [updated] = await sql`
        update public.meetings set meeting_date = ${row.meeting_date}::date
        where id = ${row.meeting_id} and meeting_date is null
        returning id, meeting_date
      `;
      if (!updated) throw new Error(`Meeting ${row.meeting_id} changed after preflight; rolled back.`);
      updates.push(updated);
    }
    return updates;
  });
  const ragUpdates = await ragSql.begin(async (sql) => {
    const updates = [];
    for (const row of plan.plannedRag) {
      const [updated] = await sql`
        update public.rag_document_metadata
        set source = ${row.repair.source}, category = ${row.repair.category}, type = ${row.repair.type}, updated_at = now()
        where id = ${row.id}
          and coalesce(btrim(source), '') = ''
          and coalesce(btrim(category), '') = ''
          and coalesce(btrim(type), '') = ''
        returning id, source, category, type
      `;
      if (!updated) throw new Error(`RAG document ${row.id} changed after preflight; rolled back.`);
      updates.push(updated);
    }
    return updates;
  });
  return { meetingUpdates, ragUpdates };
}

async function verifyAppliedRepair() {
  const [{ count: missingMeetingDates }] = await appSql`
    select count(*)::int as count
    from public.meetings m
    join public.document_metadata dm on dm.id = m.transcript_document_id
    where m.meeting_date is null and dm.source = 'fireflies'
  `;
  const [{ count: unresolvedRagRows }] = await ragSql`
    select count(*)::int as count
    from public.rag_document_metadata
    where coalesce(btrim(source), '') = ''
      and coalesce(btrim(category), '') = ''
      and coalesce(btrim(type), '') = ''
  `;
  if (missingMeetingDates !== 0 || unresolvedRagRows !== EXPECTED_UNRESOLVED) {
    throw new Error(`Post-apply verification failed: fireflies_meetings_without_date=${missingMeetingDates}, unresolved_rag_rows=${unresolvedRagRows}.`);
  }
  return { missing_meeting_dates: missingMeetingDates, unresolved_rag_rows: unresolvedRagRows };
}

try {
  if (VERIFY) {
    console.log(JSON.stringify({ mode: "verify", ...(await verifyAppliedRepair()) }));
    process.exitCode = 0;
  } else {
  const plan = await buildPlan();
  console.log(JSON.stringify({
    mode: APPLY ? "apply" : "dry-run",
    meetings: plan.plannedMeetings.map(({ meeting_id, document_id, meeting_date, evidence }) => ({ meeting_id, document_id, meeting_date, evidence })),
    rag_repairs: plan.plannedRag.map(({ id, repair }) => ({ id, ...repair })),
    unresolved_rag_ids: plan.unresolved.map(({ id }) => id),
  }, null, 2));
  if (APPLY) {
    const result = await applyPlan(plan);
    console.log(JSON.stringify({ applied_meetings: result.meetingUpdates.length, applied_rag_repairs: result.ragUpdates.length }));
  }
  }
} finally {
  await Promise.allSettled([appSql.end({ timeout: 5 }), ragSql.end({ timeout: 5 })]);
}
