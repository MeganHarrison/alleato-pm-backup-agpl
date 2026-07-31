#!/usr/bin/env node

/**
 * Microsoft Graph embedding contract.
 *
 * Teams and email syncs feed the AI assistant through document_metadata and
 * document_chunks. This guardrail prevents the Graph path from silently
 * degrading to direct OpenAI only or writing unembedded chunks after provider
 * failure.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const embedPath = path.join(
  root,
  "backend/src/services/integrations/microsoft_graph/embed.py"
);
const source = fs.readFileSync(embedPath, "utf8");
const aiTransportPath = path.join(root, "backend/src/services/ai_transport.py");
const aiTransport = fs.readFileSync(aiTransportPath, "utf8");
const migrationPath = path.join(
  root,
  "supabase/migrations/20260429162000_graph_rag_source_type_cleanup_guardrails.sql",
);
const migration = fs.existsSync(migrationPath)
  ? fs.readFileSync(migrationPath, "utf8")
  : "";

const failures = [];

function requireContains(needle, message) {
  if (!source.includes(needle)) {
    failures.push(message);
  }
}

function requireTransportContains(needle, message) {
  if (!aiTransport.includes(needle)) {
    failures.push(message);
  }
}

function requireNotContains(needle, message) {
  if (source.includes(needle)) {
    failures.push(message);
  }
}

requireContains("get_openai_client", "Graph embeddings must route provider selection through shared ai_transport.");
requireTransportContains("AI_GATEWAY_API_KEY", "Graph embeddings must support AI_GATEWAY_API_KEY through shared ai_transport.");
requireTransportContains("https://ai-gateway.vercel.sh/v1", "Graph embeddings must use the Vercel AI Gateway base URL through shared ai_transport.");
requireTransportContains("OPENAI_API_KEY", "Graph embeddings should retain direct OpenAI fallback through shared ai_transport.");
requireTransportContains("AI_PROVIDER_PATH", "Graph embeddings must keep an explicit provider-path override for operations.");
requireTransportContains("AI_GATEWAY_REQUIRED", "Graph embeddings must support fail-closed gateway enforcement.");
requireTransportContains("retry_ai_call", "Graph embeddings must use shared retry/failure behavior.");
requireContains("len(e) != EMBEDDING_DIMENSIONS", "Graph embeddings must validate vector dimensions before writes.");
requireContains('"source_type": source_type', "Graph chunks must write source_type so Teams/email retrieval can filter correctly.");
requireContains('category == "teams_message"', "Graph chunks must classify Teams chunks as teams_message.");
requireContains('"teams_dm"', "Graph chunks must split Teams DMs from channel messages.");
requireContains('"teams_channel"', "Graph chunks must split Teams channel messages from DMs.");
requireContains('category == "email"', "Graph chunks must classify email chunks as email.");
requireContains('"onedrive_document"', "Graph chunks must preserve the existing OneDrive source_type name.");
requireContains("MIN_EMBEDDABLE_CHARS_BY_TYPE", "Graph embedding must keep low-content comms out of the vector index.");
requireContains("skipped_low_content", "Graph embedding must mark low-content skips loudly.");
requireContains('["embedded", "complete"]', "Graph embedding must repair falsely completed Graph rows that have no chunks.");
requireContains("_has_embedded_graph_chunks", "Graph embedding must detect completed Graph rows that are still missing embedded chunks.");
requireContains('.not_.is_("embedding", "null")', "Graph embedding repair must detect null-embedding chunks, not only missing chunk rows.");
requireContains("completed_without_embeddings", "Graph embedding repair must query completed rows missing embedded chunks directly when DB access is available.");
requireContains("SQL candidate query failed; falling back to Supabase scan", "Graph embedding must fall back when direct Postgres candidate selection fails.");
requireContains("'raw_ingested', 'segmented', 'compiled', 'error'", "Graph embedding must retry content-bearing Graph error rows.");
requireContains("interval '365 days'", "Graph embedding must not repair source records older than one year.");
requireContains("source_at desc", "Graph embedding must prioritize newest source records first.");
requireContains("repair_scan_limit", "Graph embedding repair must scan past the first page of already-good completed rows.");
requireContains('order("created_at", desc=True)', "Graph embedding fallback must prioritize newest Graph source rows first.");
requireNotContains("return [[] for _ in texts]", "Graph embeddings must not return empty vectors after provider failure.");

if (!migration.includes("repair_graph_document_chunk_source_types_batch")) {
  failures.push("Graph source-type drift must have a batchable repair function.");
}
if (!migration.includes("graph_document_chunk_source_type")) {
  failures.push("Graph source-type normalization must be centralized in SQL.");
}
if (!migration.includes("skip locked")) {
  failures.push("Graph source-type repair must use skip locked for hot-table safety.");
}

if (failures.length > 0) {
  console.error("Graph embedding contract: FAIL");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("Graph embedding contract: PASS");
