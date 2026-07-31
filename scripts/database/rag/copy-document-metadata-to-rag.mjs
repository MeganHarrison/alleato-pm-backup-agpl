#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(repoRoot, ".env"));

const sourceUrl = process.env.APP_METADATA_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const ragUrl = process.env.RAG_DATABASE_URL;
if (!sourceUrl) throw new Error("APP_METADATA_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_URL is required.");
if (!ragUrl) throw new Error("RAG_DATABASE_URL is required.");

const batchSize = Number(process.env.RAG_METADATA_COPY_BATCH_SIZE || "250");
const dryRun = process.argv.includes("--dry-run");

const sourceSql = postgres(sourceUrl, { max: 1, ssl: "require", idle_timeout: 5 });
const ragSql = postgres(ragUrl, { max: 1, ssl: "require", idle_timeout: 5, prepare: false });

function hashContent(value) {
  if (!value) return null;
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function asIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function buildPayload(row) {
  const content = row.content || null;
  const rawText = row.raw_text || null;
  const sourceMetadata = {
    ...(row.source_metadata || {}),
    migrated_from_app_document_metadata: true,
    app_deleted_at: asIso(row.deleted_at),
    fireflies_link: row.fireflies_link || null,
    meeting_link: row.meeting_link || null,
    source_drive_id: row.source_drive_id || null,
    source_site_id: row.source_site_id || null,
    source_path: row.source_path || null,
    source_etag: row.source_etag || null,
    source_size: row.source_size || null,
    organizer_email: row.organizer_email || null,
    host_email: row.host_email || null,
    participants_array: row.participants_array || null,
    tags: row.tags || null,
    phase: row.phase || null,
    workflow_target: row.workflow_target || null,
    division: row.division || null,
    trade: row.trade || null,
  };
  const processingMetadata = {
    migrated_from: "public.document_metadata",
    migrated_at: new Date().toISOString(),
    app_status: row.status || null,
    app_deleted_at: asIso(row.deleted_at),
    has_content: Boolean(content),
    has_raw_text: Boolean(rawText),
    has_summary_embedding: Boolean(row.summary_embedding),
  };

  return {
    id: row.id,
    app_document_id: row.id,
    project_id: row.project_id == null ? null : Number(row.project_id),
    source: row.source || null,
    source_system: row.source_system || null,
    source_item_id: row.source_item_id || row.fireflies_id || row.file_id?.toString?.() || row.id,
    fireflies_id: row.fireflies_id || null,
    title: row.title || row.file_name || row.id,
    type: row.type || null,
    category: row.category || null,
    source_web_url: row.source_web_url || row.url || row.fireflies_link || row.meeting_link || null,
    url: row.url || row.source_web_url || null,
    storage_bucket: row.storage_bucket || null,
    storage_path: row.file_path || null,
    file_name: row.file_name || null,
    content,
    raw_text: rawText,
    content_hash: row.content_hash || hashContent(content || rawText),
    content_length: content ? String(content).length : rawText ? String(rawText).length : 0,
    summary: row.summary || null,
    overview: row.overview || null,
    summary_embedding: row.summary_embedding || null,
    parsing_status: row.status || null,
    embedding_status: row.summary_embedding || row.status === "embedded" ? "embedded" : row.status || null,
    processing_metadata: processingMetadata,
    source_metadata: sourceMetadata,
    last_synced_at: asIso(row.date || row.captured_at || row.source_last_modified_at || row.created_at),
    last_content_loaded_at: content || rawText ? new Date().toISOString() : null,
    last_indexed_at: row.summary_embedding || row.status === "embedded" ? new Date().toISOString() : null,
    created_at: asIso(row.created_at) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function fetchBatch(offset) {
  return sourceSql`
    select
      id,
      title,
      url,
      created_at,
      type,
      source,
      content,
      summary,
      tags,
      category,
      fireflies_id,
      fireflies_link,
      project_id,
      project,
      date,
      file_id,
      overview,
      status,
      captured_at,
      content_hash,
      participants_array,
      phase,
      file_name,
      file_path,
      storage_bucket,
      raw_text,
      summary_embedding::text as summary_embedding,
      organizer_email,
      host_email,
      meeting_link,
      source_system,
      source_drive_id,
      source_item_id,
      source_site_id,
      source_path,
      source_web_url,
      source_etag,
      source_last_modified_at,
      source_size,
      workflow_target,
      division,
      trade,
      source_metadata,
      deleted_at
    from public.document_metadata
    order by id
    limit ${batchSize}
    offset ${offset}
  `;
}

async function main() {
  const [{ count }] = await sourceSql`select count(*)::int as count from public.document_metadata`;
  console.log(`document_metadata source rows=${count}`);
  if (dryRun) return;

  let copied = 0;
  for (let offset = 0; offset < count; offset += batchSize) {
    const rows = await fetchBatch(offset);
    const payloads = rows.map(buildPayload);
    if (payloads.length) {
      await ragSql`
        insert into public.rag_document_metadata ${ragSql(payloads)}
        on conflict (id) do update set
          app_document_id = excluded.app_document_id,
          project_id = excluded.project_id,
          source = excluded.source,
          source_system = excluded.source_system,
          source_item_id = excluded.source_item_id,
          fireflies_id = excluded.fireflies_id,
          title = excluded.title,
          type = excluded.type,
          category = excluded.category,
          source_web_url = excluded.source_web_url,
          url = excluded.url,
          storage_bucket = excluded.storage_bucket,
          storage_path = excluded.storage_path,
          file_name = excluded.file_name,
          content = excluded.content,
          raw_text = excluded.raw_text,
          content_hash = excluded.content_hash,
          content_length = excluded.content_length,
          summary = excluded.summary,
          overview = excluded.overview,
          summary_embedding = excluded.summary_embedding,
          parsing_status = excluded.parsing_status,
          embedding_status = excluded.embedding_status,
          processing_metadata = excluded.processing_metadata,
          source_metadata = excluded.source_metadata,
          last_synced_at = excluded.last_synced_at,
          last_content_loaded_at = excluded.last_content_loaded_at,
          last_indexed_at = excluded.last_indexed_at,
          updated_at = excluded.updated_at
      `;
    }
    copied += payloads.length;
    console.log(`copied=${copied}/${count}`);
  }
}

try {
  await main();
} finally {
  await Promise.allSettled([sourceSql.end(), ragSql.end()]);
}
