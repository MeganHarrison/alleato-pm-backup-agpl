import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
} from "../../scripts/verify/app-db-connection.mjs";
import { nextMovesFromBriefV3 } from "./brief-v3.mjs";
import { groupSourcesByLane } from "./executive-synthesis.mjs";

export async function buildPacketDatabaseConfig(rawUrl, {
  buildConnectionString = buildAppDatabaseConnectionString,
} = {}) {
  return {
    connectionString: await buildConnectionString(rawUrl, { includeSslMode: false }),
    ssl: { rejectUnauthorized: false },
    max: 1,
  };
}

async function withPg(rawUrl, callback) {
  const pool = new pg.Pool(await buildPacketDatabaseConfig(rawUrl));
  try {
    return await callback(pool);
  } finally {
    await pool.end();
  }
}

export function buildSourceCoverage({ sources, businessDate, windowBounds, corpusReceipt, sourceReadReceipt }) {
  return {
    businessDate,
    window: windowBounds,
    corpus: corpusReceipt,
    fullContentRead: sourceReadReceipt,
    sourceCounts: Object.fromEntries(Object.entries(groupSourcesByLane(sources)).map(([key, value]) => [key, value.length])),
    sourceIds: sources.map((source) => source.id),
  };
}

export function buildPacketJson({
  sources,
  structured,
  briefMarkdown,
  dashboardMarkdown,
  laneNotes,
  projectRecords,
  corpusReceipt,
  sourceReadReceipt,
  businessDate,
  packetType,
}) {
  return {
    kind: "daily_deep_read",
    businessDate,
    generatedAt: new Date().toISOString(),
    runContract: {
      version: 1,
      status: "staged",
      requestedPacketType: packetType,
      corpus: corpusReceipt,
      fullContentRead: sourceReadReceipt,
      requiredConsumers: ["source_signal_candidates", "project_current_state", "tasks", "project_progress_reports"],
    },
    brief: structured,
    briefMarkdown,
    dashboardMarkdown,
    laneNotes,
    sourceSet: {
      sources: sources.map((source) => ({
        id: source.id,
        alias: source.alias,
        sourceRecordId: source.sourceRecordId ?? null,
        appDocumentId: source.appDocumentId ?? null,
        title: source.title,
        lane: source.lane,
        projectId: source.projectId,
        projectName: source.projectName ?? null,
        attributionLabel: source.attributionLabel ?? source.projectName ?? null,
        attributionStatus: source.attributionStatus ?? "not_evaluated",
        mentionedProjectLabels: source.mentionedProjectLabels ?? [],
        attributionEvidence: source.attributionEvidence ?? [],
        sourceAt: source.sourceAt,
        url: source.url,
      })),
    },
    projectRecords,
  };
}

export async function persistIntelligencePacket(client, input) {
  const {
    sources,
    structured,
    briefMarkdown,
    dashboardMarkdown,
    laneNotes,
    projectRecords = [],
    corpusReceipt,
    sourceReadReceipt,
    businessDate,
    windowBounds,
    packetType,
    compilerVersion,
  } = input;
  await client.query("begin");
  try {
    const targetResult = await client.query(
      `
        insert into public.intelligence_targets (target_type, name, slug, description, status, priority, metadata, last_signal_at)
        values (
          'company_process',
          'Project Intelligence',
          'daily-executive-brief',
          'Canonical daily Project Intelligence run built from complete transcripts, emails, Teams messages, and documents.',
          'active',
          'high',
          $1::jsonb,
          $2::timestamptz
        )
        on conflict (slug) do update
          set name = excluded.name,
              description = excluded.description,
              status = 'active',
              priority = 'high',
              metadata = public.intelligence_targets.metadata || excluded.metadata,
              last_signal_at = excluded.last_signal_at,
              updated_at = now()
        returning id
      `,
      [JSON.stringify({ created_by: compilerVersion, source_of_truth: "complete_daily_source_corpus" }), windowBounds.endIso],
    );
    const targetId = targetResult.rows[0].id;
    const sourceCoverage = buildSourceCoverage({ sources, businessDate, windowBounds, corpusReceipt, sourceReadReceipt });
    const packetJson = buildPacketJson({
      sources, structured, briefMarkdown, dashboardMarkdown, laneNotes, projectRecords,
      corpusReceipt, sourceReadReceipt, businessDate, packetType,
    });
    const packetResult = await client.query(
      `
        insert into public.intelligence_packets (
          target_id, packet_type, packet_version, generated_at, covered_start_at, covered_end_at,
          freshness_status, executive_summary, current_status, strategic_read, why_it_matters,
          recommended_next_moves, confidence_summary, source_coverage, review_queue_count,
          stale_item_count, packet_json, compiler_version
        )
        values (
          $1::uuid, 'snapshot', 'v1', now(), $2::timestamptz, $3::timestamptz,
          'working_sample', $4::text, $5::text, $6::text, $7::text,
          $8::text[], $9::jsonb, $10::jsonb, 0, 0, $11::jsonb, $12::text
        )
        returning id, generated_at
      `,
      [
        targetId,
        windowBounds.startIso,
        windowBounds.endIso,
        briefMarkdown.slice(0, 4000),
        `Project Intelligence for ${businessDate}`,
        briefMarkdown,
        "Authoritative packet built from the complete governed daily source corpus.",
        nextMovesFromBriefV3(structured),
        JSON.stringify({ confidence: "medium", basis: "Complete governed source corpus with reconciled full-content read receipts." }),
        JSON.stringify(sourceCoverage),
        JSON.stringify(packetJson),
        compilerVersion,
      ],
    );
    await client.query("commit");
    return { targetId, packetId: packetResult.rows[0].id, generatedAt: packetResult.rows[0].generated_at };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function writeIntelligencePacket(input, {
  databaseUrl = getAppDatabaseUrl(),
  withDatabase = withPg,
} = {}) {
  return withDatabase(databaseUrl, (client) => persistIntelligencePacket(client, input));
}
