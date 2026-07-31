#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

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

const batchSize = Number(process.env.RAG_METADATA_COPY_BATCH_SIZE || "250");
const dryRun = process.argv.includes("--dry-run");
const scopeOnly = process.argv.includes("--scope-only");

let sourceSql;
let ragSql;

function hashContent(value) {
  if (!value) return null;
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function asIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function buildPayload(row) {
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
  if (row.business_area_id == null) {
    delete sourceMetadata.business_area_id;
  } else {
    sourceMetadata.business_area_id = Number(row.business_area_id);
  }
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

export function buildScopePayload(row) {
  return {
    id: row.id,
    project_id: row.project_id == null ? null : Number(row.project_id),
    business_area_id:
      row.business_area_id == null ? null : Number(row.business_area_id),
  };
}

async function fetchBatch(sourceTx, afterId) {
  const cursorFilter =
    afterId == null
      ? sourceTx``
      : sourceTx`where id > ${afterId}`;
  return sourceTx`
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
      business_area_id,
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
    ${cursorFilter}
    order by id
    limit ${batchSize}
  `;
}

async function reconcileScope(payloads) {
  const scopes = payloads.map(buildScopePayload);
  const [result] = await ragSql`
    with desired as (
      select id, project_id, business_area_id
      from jsonb_to_recordset(${ragSql.json(scopes)}::jsonb)
        as scope(id text, project_id integer, business_area_id bigint)
    ),
    updated_documents as (
      update public.rag_document_metadata as document
      set
        project_id = desired.project_id,
        source_metadata = case
          when desired.business_area_id is null
            then document.source_metadata - 'business_area_id'
          else jsonb_set(
            coalesce(document.source_metadata, '{}'::jsonb),
            '{business_area_id}',
            to_jsonb(desired.business_area_id),
            true
          )
        end,
        updated_at = now()
      from desired
      where document.id = desired.id
        and (
          document.project_id is distinct from desired.project_id
          or document.source_metadata->>'business_area_id'
            is distinct from desired.business_area_id::text
        )
      returning document.id
    ),
    updated_chunks as (
      update public.document_chunks as chunk
      set metadata =
        (coalesce(chunk.metadata, '{}'::jsonb)
          - 'project_id'
          - 'business_area_id')
        || jsonb_strip_nulls(jsonb_build_object(
          'project_id', desired.project_id,
          'business_area_id', desired.business_area_id
        ))
      from desired
      join public.rag_document_metadata as document
        on document.id = desired.id
      where chunk.document_id = document.id
        and (
          chunk.metadata->>'project_id'
            is distinct from desired.project_id::text
          or chunk.metadata->>'business_area_id'
            is distinct from desired.business_area_id::text
        )
      returning chunk.chunk_id
    )
    select
      (select count(*)::int from updated_documents) as documents,
      (select count(*)::int from updated_chunks) as chunks
  `;
  return result;
}

async function verifyScope(payloads) {
  const scopes = payloads.map(buildScopePayload);
  const [result] = await ragSql`
    with desired as (
      select id, project_id, business_area_id
      from jsonb_to_recordset(${ragSql.json(scopes)}::jsonb)
        as scope(id text, project_id integer, business_area_id bigint)
    )
    select
      (select count(*)::int from desired) as desired_documents,
      count(document.id)::int as existing_documents,
      count(*) filter (
        where document.id is null
      )::int as missing_documents,
      count(*) filter (
        where document.id is not null
          and (
            document.project_id is distinct from desired.project_id
            or document.source_metadata->>'business_area_id'
              is distinct from desired.business_area_id::text
          )
      )::int as document_mismatches,
      (
        select count(*)::int
        from public.document_chunks as chunk
        join desired as chunk_scope
          on chunk_scope.id = chunk.document_id
        where chunk.metadata->>'project_id'
            is distinct from chunk_scope.project_id::text
          or chunk.metadata->>'business_area_id'
            is distinct from chunk_scope.business_area_id::text
      ) as chunk_mismatches
    from desired
    left join public.rag_document_metadata as document
      on document.id = desired.id
  `;
  return result;
}

export function assertScopePostcondition(
  result,
  { requireAllDocuments },
) {
  const failed =
    result.document_mismatches !== 0 ||
    result.chunk_mismatches !== 0 ||
    (requireAllDocuments &&
      (result.missing_documents !== 0 ||
        result.existing_documents !== result.desired_documents));
  if (failed) {
    throw new Error(
      `RAG_SCOPE_POSTCONDITION_FAILED ${JSON.stringify({
        requireAllDocuments,
        ...result,
      })}`,
    );
  }
}

export function assertSourceSnapshotCount(expected, scanned) {
  if (expected !== scanned) {
    throw new Error(
      `SOURCE_SNAPSHOT_COUNT_MISMATCH expected=${expected} scanned=${scanned}`,
    );
  }
}

export const SOURCE_SNAPSHOT_TRANSACTION_OPTIONS =
  "isolation level repeatable read read only";

export function withSourceSnapshot(sourceClient, work) {
  return sourceClient.begin(SOURCE_SNAPSHOT_TRANSACTION_OPTIONS, work);
}

export async function scanKeysetSnapshot({
  expectedCount,
  fetchPage,
  processPage,
}) {
  let afterId = null;
  let scanned = 0;
  while (true) {
    const rows = await fetchPage(afterId);
    if (rows.length === 0) break;
    let previousId = afterId;
    for (const row of rows) {
      if (
        typeof row.id !== "string" ||
        (previousId !== null && row.id <= previousId)
      ) {
        throw new Error(
          `SOURCE_KEYSET_ORDER_VIOLATION after=${previousId} next=${row.id}`,
        );
      }
      previousId = row.id;
    }
    await processPage(rows);
    scanned += rows.length;
    afterId = rows.at(-1).id;
  }
  assertSourceSnapshotCount(expectedCount, scanned);
  return { scanned, lastId: afterId };
}

async function main() {
  if (!sourceUrl) {
    throw new Error(
      "APP_METADATA_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_URL is required.",
    );
  }
  if (!ragUrl) {
    throw new Error("RAG_DATABASE_URL is required.");
  }
  const { default: postgres } = await import("postgres");
  sourceSql = postgres(sourceUrl, {
    max: 1,
    ssl: "require",
    idle_timeout: 5,
  });
  ragSql = postgres(ragUrl, {
    max: 1,
    ssl: "require",
    idle_timeout: 5,
    prepare: false,
  });

  await withSourceSnapshot(
    sourceSql,
    async (sourceTx) => {
      const [{ count }] = await sourceTx`
        select count(*)::int as count
        from public.document_metadata
      `;
      console.log(`document_metadata source rows=${count}`);
      if (dryRun) return;

      let copied = 0;
      let reconciledDocuments = 0;
      let reconciledChunks = 0;
      const scopeSnapshot = [];
      await scanKeysetSnapshot({
        expectedCount: count,
        fetchPage: (afterId) => fetchBatch(sourceTx, afterId),
        processPage: async (rows) => {
          if (!scopeOnly) {
            const payloads = rows.map(buildPayload);
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

          const reconciled = await reconcileScope(rows);
          const postcondition = await verifyScope(rows);
          assertScopePostcondition(postcondition, {
            requireAllDocuments: !scopeOnly,
          });
          copied += rows.length;
          reconciledDocuments += reconciled.documents;
          reconciledChunks += reconciled.chunks;
          scopeSnapshot.push(...rows.map(buildScopePayload));
          console.log(
            `${scopeOnly ? "scanned" : "copied"}=${copied}/${count} reconciled_documents=${reconciledDocuments} reconciled_chunks=${reconciledChunks}`,
          );
        },
      });

      const finalPostcondition = await verifyScope(scopeSnapshot);
      assertScopePostcondition(finalPostcondition, {
        requireAllDocuments: !scopeOnly,
      });
      console.log(
        `final_scope_postcondition=${JSON.stringify(finalPostcondition)}`,
      );
    },
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    await main();
  } finally {
    await Promise.allSettled([
      sourceSql?.end(),
      ragSql?.end(),
    ]);
  }
}
