#!/usr/bin/env node

/**
 * Teams ingestion contract.
 *
 * Teams DMs are too short and contextual to index as isolated one-message RAG
 * documents. This keeps new DM ingestion aggregated into conversation/day
 * documents that can be re-embedded as the conversation grows.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const teamsPath = path.join(
  root,
  "backend/src/services/integrations/microsoft_graph/teams.py"
);
const source = fs.readFileSync(teamsPath, "utf8");

const failures = [];

function requireContains(needle, message) {
  if (!source.includes(needle)) {
    failures.push(message);
  }
}

requireContains("_conversation_doc_id", "Teams DM ingestion must use stable conversation/day document IDs.");
requireContains("teams_dm_conversation", "Teams DM ingestion must store conversation documents, not isolated DM documents.");
requireContains("message_marker", "Teams DM ingestion must dedupe individual messages inside a conversation document.");
requireContains("previous_content", "Teams DM ingestion must append new messages to existing conversation content.");
requireContains('"status": "raw_ingested"', "Updated Teams conversation documents must be re-queued for embedding.");
requireContains("MIN_CONVERSATION_CHARS = 200", "Teams DM ingestion must keep tiny daily conversations out of embedding.");
requireContains("skipped_low_content", "Teams DM ingestion must mark low-content conversations loudly.");
requireContains("_substantive_text_length", "Teams DM ingestion must measure useful text, not raw marker length.");
requireContains('f"teams/chats/{chat_id}/{date_key}.txt"', "Teams DM storage should be conversation/day scoped.");

if (failures.length > 0) {
  console.error("Teams conversation ingestion contract: FAIL");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("Teams conversation ingestion contract: PASS");
