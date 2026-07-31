#!/usr/bin/env node

import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "../verify/app-db-connection.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), quiet: true });

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? next : true;
    if (args[key] === next) index += 1;
  }
  return args;
}

function required(args, key) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`--${key} is required`);
  return value.trim();
}

async function openDatabase(rawUrl, options = {}) {
  if (!rawUrl) throw new Error(`${options.label} database URL is required`);
  const connectionString = await buildAppDatabaseConnectionString(rawUrl, {
    includeSslMode: false,
    rewriteSupabaseDirectHost: options.rewriteSupabaseDirectHost ?? true,
  });
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

const args = parseArgs(process.argv.slice(2));
const subject = required(args, "subject");
const date = required(args, "date");
const projectId = Number(required(args, "project-id"));
const expectedCount = args["expected-count"] ? Number(args["expected-count"]) : null;
const packetId = typeof args["packet-id"] === "string" ? args["packet-id"] : null;
const candidateId = typeof args["candidate-id"] === "string" ? args["candidate-id"] : null;
const taskId = typeof args["task-id"] === "string" ? args["task-id"] : null;
const shouldWrite = Boolean(args.write);
if (!Number.isInteger(projectId)) throw new Error("--project-id must be an integer");
if (expectedCount !== null && !Number.isInteger(expectedCount)) {
  throw new Error("--expected-count must be an integer");
}
if ((candidateId || taskId) && !packetId) {
  throw new Error("--packet-id is required when deleting a candidate or task");
}

const start = new Date(`${date}T00:00:00.000Z`);
const end = new Date(start);
end.setUTCDate(end.getUTCDate() + 1);
const rag = await openDatabase(getRagDatabaseUrl(), { label: "RAG" });
const app = await openDatabase(getAppDatabaseUrl(), {
  label: "app",
  rewriteSupabaseDirectHost: false,
});

const output = {
  ok: false,
  mode: shouldWrite ? "write" : "dry-run",
  scope: { subject, date, projectId, expectedCount, packetId, candidateId, taskId },
};

try {
  const sourceResult = await rag.query(
    `
      select id, project_id, assignment_method, assignment_confidence, document_metadata_id
      from public.outlook_email_intake
      where deleted_at is null
        and received_at >= $1::timestamptz
        and received_at < $2::timestamptz
        and subject ilike ('%' || $3 || '%')
      order by id
    `,
    [start.toISOString(), end.toISOString(), subject],
  );
  if (!sourceResult.rowCount) throw new Error("Scoped repair matched no Outlook intake rows");
  if (expectedCount !== null && sourceResult.rowCount !== expectedCount) {
    throw new Error(
      `Scoped repair expected ${expectedCount} Outlook rows but matched ${sourceResult.rowCount}`,
    );
  }

  const wrongRows = sourceResult.rows.filter((row) => Number(row.project_id) !== projectId);
  const sourceIds = sourceResult.rows.map((row) => String(row.id));
  const wrongDocumentIds = wrongRows.map((row) => row.document_metadata_id).filter(Boolean);
  const relatedDocumentResult = await rag.query(
    `
      select distinct id, project_id
      from public.rag_document_metadata document
      where id = any($1::text[])
         or exists (
           select 1
           from jsonb_array_elements_text(
             coalesce(document.source_metadata->'source_intake_ids', '[]'::jsonb)
           ) source_id
           where source_id = any($2::text[])
         )
      order by id
    `,
    [wrongDocumentIds, sourceIds],
  );
  const relatedDocumentIds = relatedDocumentResult.rows.map((row) => row.id);

  output.before = {
    sourceRows: sourceResult.rows,
    wrongSourceCount: wrongRows.length,
    relatedDocuments: relatedDocumentResult.rows,
  };

  if (shouldWrite) {
    await rag.query("begin");
    try {
      const intakeUpdate = await rag.query(
        `
          update public.outlook_email_intake
          set
            project_id = $1,
            status = 'Matched',
            match_status = 'matched',
            assignment_method = 'conversation_repair:authoritative_consensus',
            assignment_confidence = 1.0,
            source_metadata = jsonb_set(
              jsonb_set(
                coalesce(source_metadata, '{}'::jsonb),
                '{attribution_repair_history}',
                coalesce(source_metadata->'attribution_repair_history', '[]'::jsonb)
                  || jsonb_build_array(jsonb_build_object(
                    'repaired_at', now(),
                    'from_project_id', project_id,
                    'from_method', assignment_method,
                    'to_project_id', $1,
                    'reason', 'authoritative conversation consensus'
                  )),
                true
              ),
              '{project_assignment}',
              jsonb_build_object(
                'status', 'assigned',
                'method', 'conversation_repair:authoritative_consensus',
                'confidence', 1.0,
                'assigned_at', now()
              ),
              true
            ),
            updated_at = now()
          where id = any($2::bigint[])
            and project_id is distinct from $1
          returning id
        `,
        [projectId, wrongRows.map((row) => Number(row.id))],
      );
      const documentUpdate = relatedDocumentIds.length
        ? await rag.query(
            `
              update public.rag_document_metadata
              set
                project_id = $1,
                source_metadata = jsonb_set(
                  coalesce(source_metadata, '{}'::jsonb),
                  '{project_assignment_repair}',
                  jsonb_build_object(
                    'repaired_at', now(),
                    'method', 'conversation_repair:authoritative_consensus',
                    'project_id', $1
                  ),
                  true
                ),
                updated_at = now()
              where id = any($2::text[])
                and project_id is distinct from $1
              returning id
            `,
            [projectId, relatedDocumentIds],
          )
        : { rows: [] };
      const chunkUpdate = relatedDocumentIds.length
        ? await rag.query(
            `
              update public.document_chunks
              set
                metadata = jsonb_set(
                  jsonb_set(coalesce(metadata, '{}'::jsonb), '{project_id}', to_jsonb($1::int), true),
                  '{project_assignment_method}',
                  to_jsonb('conversation_repair:authoritative_consensus'::text),
                  true
                ),
                updated_at = now()
              where document_id = any($2::text[])
              returning chunk_id
            `,
            [projectId, relatedDocumentIds],
          )
        : { rows: [] };
      const candidateDelete = candidateId
        ? await rag.query(
            `
              delete from public.source_signal_candidates
              where id = $1::uuid
                and extraction_json->>'daily_packet_id' = $2::text
              returning id
            `,
            [candidateId, packetId],
          )
        : { rows: [] };
      await rag.query("commit");
      output.ragWrite = {
        intakeRowsUpdated: intakeUpdate.rows.map((row) => Number(row.id)),
        documentsUpdated: documentUpdate.rows.map((row) => row.id),
        chunksUpdated: chunkUpdate.rows.length,
        candidatesDeleted: candidateDelete.rows.map((row) => row.id),
      };
    } catch (error) {
      await rag.query("rollback");
      throw error;
    }

    await app.query("begin");
    try {
      const taskDelete = taskId
        ? await app.query(
            `
              delete from public.tasks
              where id = $1::uuid
                and extraction_metadata->>'daily_packet_id' = $2::text
              returning id
            `,
            [taskId, packetId],
          )
        : { rows: [] };
      await app.query("commit");
      output.appWrite = { tasksDeleted: taskDelete.rows.map((row) => row.id) };
    } catch (error) {
      await app.query("rollback");
      throw error;
    }
  }

  const readBack = await rag.query(
    `
      select id, project_id, assignment_method, assignment_confidence, document_metadata_id
      from public.outlook_email_intake
      where id = any($1::bigint[])
      order by id
    `,
    [sourceResult.rows.map((row) => Number(row.id))],
  );
  output.after = { sourceRows: readBack.rows };
  output.ok = shouldWrite
    ? readBack.rows.every((row) => Number(row.project_id) === projectId)
    : true;
  console.log(JSON.stringify(output, null, 2));
} finally {
  await rag.end();
  await app.end();
}
