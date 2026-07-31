#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const targetArgIndex = process.argv.indexOf("--target");
const targetSlug =
  targetArgIndex >= 0 ? process.argv[targetArgIndex + 1] : "westfield-collective";

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

function fail(message, details) {
  console.error(`FAIL: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
}

const client = await pool.connect();
try {
  const targetResult = await client.query(
    `select id, slug, target_type, project_id, name
     from public.intelligence_targets
     where slug = $1`,
    [targetSlug],
  );
  const target = targetResult.rows[0];
  if (!target) {
    fail(`Missing intelligence target ${targetSlug}`);
  } else if (targetSlug === "westfield-collective") {
    if (target.target_type !== "client_project") {
      fail("Westfield target is not client_project", target);
    }
    if (target.project_id !== 43) {
      fail("Westfield target did not resolve to projects.id = 43", target);
    }
  }

  if (!target) {
    await pool.end();
    process.exit();
  }

  const packets = await client.query(
    `select id, packet_type, freshness_status, source_coverage, confidence_summary
     from public.intelligence_packets
     where target_id = $1
     order by packet_type`,
    [target.id],
  );
  const currentPacket = packets.rows.find((packet) => packet.packet_type === "current");
  const goldPacket = packets.rows.find((packet) => packet.packet_type === "manual_gold_standard");
  if (!currentPacket) fail("Missing current packet");
  if (!goldPacket) fail("Missing manual_gold_standard packet");
  if (currentPacket && !["fresh", "stale", "partial", "working_sample", "failed"].includes(currentPacket.freshness_status)) {
    fail("Current packet freshness_status is invalid", currentPacket);
  }

  const cards = await client.query(
    `select c.id, c.card_type, c.title, c.confidence, c.source_count, count(e.id)::int as evidence_count
     from public.insight_cards c
     left join public.insight_card_evidence e on e.insight_card_id = c.id
     where c.primary_target_id = $1
       and coalesce(c.attribution_status, '') <> 'rejected'
       and c.current_status in ('open', 'watching', 'stale', 'needs_review')
     group by c.id, c.card_type, c.title, c.confidence, c.source_count
     order by c.card_type`,
    [target.id],
  );

  const requiredCardTypes = new Set([
    "project_update",
    "financial_exposure",
    "change_management",
    "schedule_risk",
    "open_question",
    "task",
  ]);
  const presentCardTypes = new Set(cards.rows.map((card) => card.card_type));
  for (const type of requiredCardTypes) {
    if (!presentCardTypes.has(type)) {
      fail(`Missing required insight card type: ${type}`);
    }
  }
  for (const card of cards.rows) {
    if (card.evidence_count < 1) {
      fail(`Card has no linked evidence: ${card.title}`, card);
    }
  }

  const packetCards = await client.query(
    `select count(*)::int as count
     from public.intelligence_packet_cards pc
     join public.intelligence_packets p on p.id = pc.packet_id
     where p.target_id = $1 and p.packet_type = 'current'`,
    [target.id],
  );
  if ((packetCards.rows[0]?.count ?? 0) < requiredCardTypes.size) {
    fail("Current packet does not include every required card", packetCards.rows[0]);
  }

  const reviews = await client.query(
    `select count(*)::int as count
     from public.intelligence_reviews
     where status = 'open'`,
  );
  if ((reviews.rows[0]?.count ?? 0) < 1) {
    fail("Expected open review rows for source gaps/uncertain attribution");
  }

  const coverage = currentPacket?.source_coverage ?? {};
  if (targetSlug === "westfield-collective") {
    const categoryCoverage = Array.isArray(coverage.categoryCoverage)
      ? coverage.categoryCoverage
      : [];
    const totalAvailableSources = categoryCoverage.reduce(
      (total, row) => total + Number(row?.availableCount ?? row?.sourceCount ?? 0),
      0,
    );
    const emailCoverage = categoryCoverage.find((row) => row?.category === "email");
    const documentCoverage = categoryCoverage.find((row) => row?.category === "document");

    if (
      !(coverage.documentMetadataRows >= 1) &&
      !(coverage.operatingSummarySourceCount >= 1) &&
      !(totalAvailableSources >= 1)
    ) {
      fail("Westfield packet source coverage does not include source rows", coverage);
    }
    if (!emailCoverage || Number(emailCoverage.availableCount ?? 0) < 1) {
      fail("Westfield packet source coverage does not include available email evidence", coverage);
    }
    if (!documentCoverage) {
      fail("Westfield packet source coverage does not report document coverage", coverage);
    }
    const missingCategories = Array.isArray(coverage.documentIntelligence?.missingCategories)
      ? coverage.documentIntelligence.missingCategories
      : [];
    const documentsNamedAsGap = missingCategories.some(
      (row) => row?.category === "document",
    );
    if (
      documentCoverage &&
      Number(documentCoverage.availableCount ?? 0) < 1 &&
      !documentsNamedAsGap
    ) {
      fail(
        "Westfield packet source coverage must name documents as a gap when no document evidence is available",
        coverage,
      );
    }
    if (!Array.isArray(coverage.gaps) || coverage.gaps.length < 1) {
      fail("Westfield packet source coverage must name gaps", coverage);
    }
  }

  if (process.exitCode) {
    process.exit();
  }

  console.log(
    JSON.stringify(
      {
        status: "pass",
        target: {
          slug: target.slug,
          projectId: target.project_id,
          type: target.target_type,
        },
        packetTypes: packets.rows.map((packet) => packet.packet_type),
        cardTypes: [...presentCardTypes],
        currentPacketCards: packetCards.rows[0]?.count ?? 0,
        openReviews: reviews.rows[0]?.count ?? 0,
      },
      null,
      2,
    ),
  );
} finally {
  client.release();
  await pool.end();
}
