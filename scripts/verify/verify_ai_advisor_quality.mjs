#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const promptArgIndex = process.argv.indexOf("--prompt");
const prompt =
  promptArgIndex >= 0
    ? process.argv[promptArgIndex + 1]
    : "What's the latest on Westfield Collective?";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function connectionString() {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete("sslmode");
  return url.toString();
}

const pool = new pg.Pool({
  connectionString: connectionString(),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

function makeAnswer({ packet, cards }) {
  const byType = new Map(cards.map((card) => [card.card_type, card]));
  const status = byType.get("project_update");
  const financial = byType.get("financial_exposure");
  const change = byType.get("change_management");
  const schedule = byType.get("schedule_risk");
  const decision = byType.get("open_question");
  const followUp = byType.get("task");
  const coverage = packet.source_coverage ?? {};

  return [
    `Current read: ${packet.current_status || status?.summary || packet.executive_summary}`,
    `What changed recently: ${status?.summary || packet.strategic_read}`,
    `Financial/change-management exposure: ${financial?.summary || ""} ${change?.summary || ""}`,
    `Schedule/operational risk: ${schedule?.summary || ""}`,
    `Decisions/open questions/follow-ups: ${[decision?.summary, followUp?.summary].filter(Boolean).join(" ")}`,
    `Recommended next action: ${(packet.recommended_next_moves ?? []).join(" ")}`,
    `Evidence basis and confidence: ${packet.confidence_summary?.reason || ""} Sources include ${coverage.documentMetadataRows ?? 0} document/source rows, ${coverage.aiMemoryRows ?? 0} memories, and ${coverage.projectEmailRows ?? 0} project_emails rows.`,
    `Gaps: ${(coverage.gaps ?? []).join("; ")}`,
    `Packet status: ${packet.freshness_status}. Resolved Westfield Collective to project 43.`,
  ].join("\n\n");
}

const requiredPhrases = [
  "Current read:",
  "What changed recently:",
  "Financial/change-management exposure:",
  "Schedule/operational risk:",
  "Decisions/open questions/follow-ups:",
  "Recommended next action:",
  "Evidence basis and confidence:",
  "Gaps:",
  "Packet status:",
  "project 43",
];

const forbiddenPhrases = [
  "I found results",
  "RAG",
  "tool call",
  "retrieval",
];

function includesForbiddenPhrase(answer, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isAcronym = /^[A-Z0-9]+$/.test(phrase);
  const pattern = isAcronym
    ? new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i")
    : new RegExp(escaped, "i");
  return pattern.test(answer);
}

const client = await pool.connect();
try {
  const targetResult = await client.query(
    `select id from public.intelligence_targets where slug = 'westfield-collective' and project_id = 43`,
  );
  const target = targetResult.rows[0];
  if (!target) {
    console.error("FAIL: missing Westfield target");
    process.exit(1);
  }

  const packetResult = await client.query(
    `select *
     from public.intelligence_packets
     where target_id = $1 and packet_type = 'current'
     order by generated_at desc
     limit 1`,
    [target.id],
  );
  const packet = packetResult.rows[0];
  if (!packet) {
    console.error("FAIL: missing Westfield current packet");
    process.exit(1);
  }

  const cardsResult = await client.query(
    `select c.*
     from public.intelligence_packet_cards pc
     join public.insight_cards c on c.id = pc.insight_card_id
     where pc.packet_id = $1
     order by pc.rank`,
    [packet.id],
  );

  const answer = makeAnswer({ packet, cards: cardsResult.rows });
  const failures = [];
  for (const phrase of requiredPhrases) {
    if (!answer.includes(phrase)) failures.push(`missing phrase: ${phrase}`);
  }
  for (const phrase of forbiddenPhrases) {
    if (includesForbiddenPhrase(answer, phrase)) {
      failures.push(`forbidden phrase: ${phrase}`);
    }
  }
  if (!/working_sample|fresh|stale|partial|failed/.test(answer)) {
    failures.push("missing explicit freshness status");
  }

  if (failures.length > 0) {
    console.error("Advisor quality verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "pass",
        prompt,
        packetId: packet.id,
        answerLength: answer.length,
        requiredPhrases,
      },
      null,
      2,
    ),
  );
} finally {
  client.release();
  await pool.end();
}
