#!/usr/bin/env node

import fs from "node:fs/promises";
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

function sameNumbers(left, right) {
  return JSON.stringify([...left].map(Number).sort((a, b) => a - b))
    === JSON.stringify([...right].map(Number).sort((a, b) => a - b));
}

function identityWhere(item) {
  if (item.kind === "internet_message") {
    return { clause: "internet_message_id = $1", params: [item.key] };
  }
  if (item.kind === "mailbox_conversation") {
    const separator = item.key.indexOf("|");
    if (separator < 1) throw new Error(`Invalid mailbox conversation key: ${item.key}`);
    return {
      clause: "mailbox_user_id = $1 and conversation_id = $2",
      params: [item.key.slice(0, separator), item.key.slice(separator + 1)],
    };
  }
  throw new Error(`Unsupported identity kind: ${item.kind}`);
}

const args = parseArgs(process.argv.slice(2));
const ledgerPath = path.resolve(
  typeof args.ledger === "string"
    ? args.ledger
    : "docs/ops/evidence/2026-07-14-historical-outlook-attribution-adjudication/ledger.json",
);
const shouldWrite = Boolean(args.write);
const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8"));
if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.dispositions)) {
  throw new Error(`Unsupported adjudication ledger: ${ledgerPath}`);
}

const rawUrl = getRagDatabaseUrl();
if (!rawUrl) throw new Error("RAG_DATABASE_URL is required");
const connectionString = await buildAppDatabaseConnectionString(rawUrl, {
  includeSslMode: false,
});
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
const appConnectionString = await buildAppDatabaseConnectionString(getAppDatabaseUrl(), {
  includeSslMode: false,
  rewriteSupabaseDirectHost: false,
});
const appClient = new pg.Client({
  connectionString: appConnectionString,
  ssl: { rejectUnauthorized: false },
});
const output = {
  ok: false,
  mode: shouldWrite ? "write" : "dry-run",
  ledgerPath,
  repairs: [],
  exclusions: [],
};

await client.connect();
await appClient.connect();
try {
  for (const item of ledger.dispositions) {
    const identity = identityWhere(item);
    const sourceResult = await client.query(
      `
        select id, project_id, assignment_method, assignment_confidence, document_metadata_id
        from public.outlook_email_intake
        where deleted_at is null
          and project_id is not null
          and ${identity.clause}
        order by id
      `,
      identity.params,
    );
    const intakeIds = sourceResult.rows.map((row) => Number(row.id));
    const projectIds = [...new Set(sourceResult.rows.map((row) => Number(row.project_id)))].sort(
      (left, right) => left - right,
    );
    if (!sameNumbers(intakeIds, item.expectedIntakeIds)) {
      throw new Error(
        `${item.kind}:${item.key} intake drift: expected ${item.expectedIntakeIds.join(",")}, got ${intakeIds.join(",")}`,
      );
    }

    if (item.disposition === "exclude") {
      if (!sameNumbers(projectIds, item.expectedProjectIds)) {
        throw new Error(
          `${item.kind}:${item.key} project drift: expected ${item.expectedProjectIds.join(",")}, got ${projectIds.join(",")}`,
        );
      }
      output.exclusions.push({
        kind: item.kind,
        key: item.key,
        intakeIds,
        projectIds,
        reason: item.exclusionReason,
      });
      continue;
    }

    if (item.disposition !== "repair" || !Number.isInteger(item.targetProjectId)) {
      throw new Error(`${item.kind}:${item.key} has an invalid disposition`);
    }
    const alreadyRepaired = projectIds.length === 1 && projectIds[0] === item.targetProjectId;
    if (!alreadyRepaired && !sameNumbers(projectIds, item.expectedProjectIds)) {
      throw new Error(
        `${item.kind}:${item.key} project drift: expected ${item.expectedProjectIds.join(",")}, got ${projectIds.join(",")}`,
      );
    }

    const wrongRows = sourceResult.rows.filter(
      (row) => Number(row.project_id) !== item.targetProjectId,
    );
    const wrongIds = wrongRows.map((row) => Number(row.id));
    const directDocumentIds = wrongRows.map((row) => row.document_metadata_id).filter(Boolean);
    const attachmentResult = wrongIds.length
      ? await client.query(
          `
            select id, intake_email_id, project_id, document_metadata_id
            from public.outlook_email_intake_attachments
            where intake_email_id = any($1::bigint[])
            order by id
          `,
          [wrongIds],
        )
      : { rows: [] };
    const preservedAttachmentRows = item.preserveAttachments ? attachmentResult.rows : [];
    const mutableAttachmentRows = item.preserveAttachments ? [] : attachmentResult.rows;
    const preservedDocumentIds = new Set(
      preservedAttachmentRows.map((row) => row.document_metadata_id).filter(Boolean),
    );
    const attachmentDocumentIds = mutableAttachmentRows
      .map((row) => row.document_metadata_id)
      .filter(Boolean);
    const relatedDocumentResult = wrongIds.length
      ? await client.query(
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
          [[...new Set([...directDocumentIds, ...attachmentDocumentIds])], wrongIds.map(String)],
        )
      : { rows: [] };
    const relatedDocumentIds = relatedDocumentResult.rows
      .map((row) => row.id)
      .filter((id) => !preservedDocumentIds.has(id));
    const candidateResult = relatedDocumentIds.length
      ? await client.query(
          `
            select id, source_document_id, project_id, status, promoted_insight_card_id
            from public.source_signal_candidates
            where source_document_id = any($1::text[])
              and project_id is distinct from $2
            order by created_at, id
          `,
          [relatedDocumentIds, item.targetProjectId],
        )
      : { rows: [] };
    const targetResult = await appClient.query(
      `
        select id
        from public.intelligence_targets
        where project_id = $1
          and target_type = 'client_project'
        order by created_at
      `,
      [item.targetProjectId],
    );
    if (targetResult.rowCount !== 1) {
      throw new Error(
        `Project ${item.targetProjectId} expected one intelligence target, found ${targetResult.rowCount}`,
      );
    }
    const targetId = targetResult.rows[0].id;

    const result = {
      kind: item.kind,
      key: item.key,
      targetProjectId: item.targetProjectId,
      intakeIds,
      wrongIntakeIds: wrongIds,
      attachmentIds: mutableAttachmentRows.map((row) => Number(row.id)),
      preservedAttachmentIds: preservedAttachmentRows.map((row) => Number(row.id)),
      documentIds: relatedDocumentIds,
      downstreamCandidates: candidateResult.rows,
      targetId,
      alreadyRepaired,
    };

    if (shouldWrite && wrongIds.length) {
      const promotedCardIds = candidateResult.rows
        .map((row) => row.promoted_insight_card_id)
        .filter(Boolean);
      if (promotedCardIds.length) {
        const reviewedCards = await appClient.query(
          `
            select distinct insight_card_id
            from public.intelligence_reviews
            where insight_card_id = any($1::uuid[])
          `,
          [promotedCardIds],
        );
        if (reviewedCards.rowCount) {
          throw new Error(
            `Refusing to delete ${reviewedCards.rowCount} reviewed contaminated insight cards`,
          );
        }
        const cardDelete = await appClient.query(
          `
            delete from public.insight_cards
            where id = any($1::uuid[])
            returning id
          `,
          [promotedCardIds],
        );
        result.cardsDeleted = cardDelete.rows.map((row) => row.id);
      } else {
        result.cardsDeleted = [];
      }

      await client.query("begin");
      try {
        const intakeUpdate = await client.query(
          `
            update public.outlook_email_intake
            set
              project_id = $1,
              status = 'Matched',
              match_status = 'matched',
              assignment_method = 'historical_adjudication:source_evidence',
              assignment_confidence = 1.0,
              source_metadata = jsonb_set(
                jsonb_set(
                  coalesce(source_metadata, '{}'::jsonb),
                  '{attribution_repair_history}',
                  coalesce(source_metadata->'attribution_repair_history', '[]'::jsonb)
                    || jsonb_build_array(jsonb_build_object(
                      'repaired_at', now(),
                      'task_id', $3::text,
                      'from_project_id', project_id,
                      'from_method', assignment_method,
                      'to_project_id', $1,
                      'reason', $4::text
                    )),
                  true
                ),
                '{project_assignment}',
                jsonb_build_object(
                  'status', 'assigned',
                  'method', 'historical_adjudication:source_evidence',
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
          [item.targetProjectId, wrongIds, ledger.taskId, item.evidence],
        );
        const attachmentUpdate = mutableAttachmentRows.length
          ? await client.query(
              `
                update public.outlook_email_intake_attachments
                set project_id = $1, updated_at = now()
                where id = any($2::bigint[])
                  and project_id is distinct from $1
                returning id
              `,
              [item.targetProjectId, mutableAttachmentRows.map((row) => Number(row.id))],
            )
          : { rows: [] };
        const documentUpdate = relatedDocumentIds.length
          ? await client.query(
              `
                update public.rag_document_metadata
                set
                  project_id = $1::int,
                  source_metadata = jsonb_set(
                    coalesce(source_metadata, '{}'::jsonb),
                    '{project_assignment_repair}',
                    jsonb_build_object(
                      'repaired_at', now(),
                      'task_id', $3::text,
                      'method', 'historical_adjudication:source_evidence',
                      'project_id', $1
                    ),
                    true
                  ),
                  updated_at = now()
                where id = any($2::text[])
                  and project_id is distinct from $1
                returning id
              `,
              [item.targetProjectId, relatedDocumentIds, ledger.taskId],
            )
          : { rows: [] };
        const chunkUpdate = relatedDocumentIds.length
          ? await client.query(
              `
                update public.document_chunks
                set
                  metadata = jsonb_set(
                    jsonb_set(
                      coalesce(metadata, '{}'::jsonb),
                      '{project_id}',
                      to_jsonb($1::int),
                      true
                    ),
                    '{project_assignment_method}',
                    to_jsonb('historical_adjudication:source_evidence'::text),
                    true
                  ),
                  updated_at = now()
                where document_id = any($2::text[])
                returning chunk_id
              `,
              [item.targetProjectId, relatedDocumentIds],
            )
          : { rows: [] };
        const candidateUpdate = candidateResult.rows.length
          ? await client.query(
              `
                update public.source_signal_candidates
                set
                  project_id = $1,
                  target_id = $2::uuid,
                  status = 'needs_review',
                  promoted_insight_card_id = null,
                  extraction_json = jsonb_set(
                    coalesce(extraction_json, '{}'::jsonb),
                    '{attribution_repair}',
                    jsonb_build_object(
                      'repaired_at', now(),
                      'task_id', $4::text,
                      'from_project_id', project_id,
                      'from_promoted_insight_card_id', promoted_insight_card_id,
                      'to_project_id', $1::int,
                      'reason', $5::text
                    ),
                    true
                  ),
                  updated_at = now()
                where id = any($3::uuid[])
                returning id
              `,
              [
                item.targetProjectId,
                targetId,
                candidateResult.rows.map((row) => row.id),
                ledger.taskId,
                item.evidence,
              ],
            )
          : { rows: [] };
        await client.query("commit");
        result.write = {
          intakeRowsUpdated: intakeUpdate.rows.map((row) => Number(row.id)),
          attachmentsUpdated: attachmentUpdate.rows.map((row) => Number(row.id)),
          documentsUpdated: documentUpdate.rows.map((row) => row.id),
          chunksUpdated: chunkUpdate.rows.length,
          candidatesResetForReview: candidateUpdate.rows.map((row) => row.id),
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    output.repairs.push(result);
  }

  output.ok = true;
  output.summary = {
    repairIdentities: output.repairs.length,
    exclusionIdentities: output.exclusions.length,
    wrongIntakeRows: output.repairs.reduce((sum, item) => sum + item.wrongIntakeIds.length, 0),
    relatedDocuments: output.repairs.reduce((sum, item) => sum + item.documentIds.length, 0),
    downstreamCandidates: output.repairs.reduce(
      (sum, item) => sum + item.downstreamCandidates.length,
      0,
    ),
    intakeRowsUpdated: output.repairs.reduce(
      (sum, item) => sum + (item.write?.intakeRowsUpdated.length ?? 0),
      0,
    ),
    attachmentsUpdated: output.repairs.reduce(
      (sum, item) => sum + (item.write?.attachmentsUpdated.length ?? 0),
      0,
    ),
    documentsUpdated: output.repairs.reduce(
      (sum, item) => sum + (item.write?.documentsUpdated.length ?? 0),
      0,
    ),
    chunksUpdated: output.repairs.reduce(
      (sum, item) => sum + (item.write?.chunksUpdated ?? 0),
      0,
    ),
    candidatesResetForReview: output.repairs.reduce(
      (sum, item) => sum + (item.write?.candidatesResetForReview.length ?? 0),
      0,
    ),
    contaminatedCardsDeleted: output.repairs.reduce(
      (sum, item) => sum + (item.cardsDeleted?.length ?? 0),
      0,
    ),
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  await client.end();
  await appClient.end();
}
