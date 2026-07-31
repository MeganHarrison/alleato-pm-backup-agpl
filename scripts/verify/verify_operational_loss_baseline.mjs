#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import pg from "pg";
import { buildAppDatabaseConnectionString, getRagDatabaseUrl } from "./app-db-connection.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), quiet: true });

const schemaPath = path.resolve("docs/ai-plan/operational-loss/episode-contract.schema.json");
const ledgerPath = path.resolve("docs/ai-plan/operational-loss/calibration-ledger.json");
const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8"));
const exclusions = JSON.parse(await fs.readFile(path.resolve(ledger.exclusionLedger), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const contractOk = validate(ledger);

const excludedIntakeIds = new Set(
  exclusions.dispositions.filter((item) => item.disposition === "exclude").flatMap((item) => item.expectedIntakeIds ?? []),
);
const ids = [...new Set(ledger.episodes.flatMap((episode) => episode.evidence.map((item) => item.documentId)))];
const rawUrl = getRagDatabaseUrl();
if (!rawUrl) throw new Error("RAG_DATABASE_URL is required");
const client = new pg.Client({ connectionString: await buildAppDatabaseConnectionString(rawUrl, { includeSslMode: false }), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const result = await client.query(
    `select d.id, d.project_id, d.title, d.type, d.category, d.source, d.source_system,
            d.content, d.created_at, oi.id as intake_id, oi.received_at
       from public.rag_document_metadata d
       left join public.outlook_email_intake oi on oi.document_metadata_id = d.id and oi.deleted_at is null
      where d.id = any($1::text[])`,
    [ids],
  );
  const byId = new Map(result.rows.map((row) => [row.id, row]));
  const failures = [];
  if (!contractOk) failures.push({ contract: validate.errors });
  const episodeIds = new Set();
  for (const episode of ledger.episodes) {
    if (episodeIds.has(episode.id)) failures.push({ episode: episode.id, error: "duplicate_episode_id" });
    episodeIds.add(episode.id);
    if (episode.kind === "failure" && episode.evidence.every((item) => item.grade === "D")) {
      failures.push({ episode: episode.id, error: "failure_ranked_only_from_grade_d" });
    }
    for (const evidence of episode.evidence) {
      const row = byId.get(evidence.documentId);
      if (!row) {
        failures.push({ episode: episode.id, documentId: evidence.documentId, error: "source_missing" });
        continue;
      }
      if ((row.project_id === null ? null : Number(row.project_id)) !== evidence.expectedProjectId) {
        failures.push({ episode: episode.id, documentId: evidence.documentId, error: "project_mismatch", expected: evidence.expectedProjectId, actual: row.project_id });
      }
      if (row.intake_id && excludedIntakeIds.has(Number(row.intake_id))) {
        failures.push({ episode: episode.id, documentId: evidence.documentId, error: "documented_exclusion_used" });
      }
      const meta = typeof row.content === "string" ? row.content.match(/^\*\*Date:\*\*\s*([^\n]+)/m)?.[1]?.trim() : null;
      const sourceAt = row.received_at ?? (meta && Number.isFinite(Date.parse(meta)) ? meta : row.created_at);
      if (new Date(sourceAt).toISOString().slice(0, 10) !== evidence.occurredOn) {
        failures.push({ episode: episode.id, documentId: evidence.documentId, error: "date_mismatch", expected: evidence.occurredOn, actual: new Date(sourceAt).toISOString().slice(0, 10) });
      }
    }
  }
  if (!ledger.episodes.some((episode) => episode.kind === "healthy_counterexample")) failures.push({ error: "healthy_counterexample_required" });
  const output = {
    ok: failures.length === 0,
    contractOk,
    episodes: ledger.episodes.length,
    failureEpisodes: ledger.episodes.filter((episode) => episode.kind === "failure").length,
    healthyCounterexamples: ledger.episodes.filter((episode) => episode.kind === "healthy_counterexample").length,
    evidenceSources: ids.length,
    exclusionsChecked: excludedIntakeIds.size,
    failures,
  };
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exitCode = 1;
} finally {
  await client.end();
}
