#!/usr/bin/env node
/**
 * dedupe-meeting-extraction-cards.mjs
 *
 * Cleans up the insight-card duplication caused by the Fireflies hourly
 * re-extraction loop (see fix/fireflies-hourly-reextraction-loop). Before the
 * fix, `alleato-fireflies-sync` re-ran the full pipeline on every meeting still
 * in the "recent transcripts" window each hour; because the content hash was
 * computed over markdown that embeds per-fetch presigned audio/video URLs, the
 * skip guard missed and the LLM extractor minted a fresh batch of near-duplicate
 * cards (risks/decisions/opportunities) every hour.
 *
 * Cleanup rule (safe + reversible):
 *   - For each target meeting, take the cards that are EXCLUSIVE to that meeting
 *     (evidence points at exactly one source document) AND were auto-assigned
 *     (attribution_status='auto_assigned') AND are currently active
 *     (current_status='open') — i.e. loop artifacts, not human-curated cards.
 *   - Group them into extraction batches by created_at (a new batch starts when
 *     there's a >BATCH_GAP_MIN gap). Keep the MOST RECENT batch (the current
 *     extraction). Mark every card in older batches current_status='superseded'.
 *   - Cards shared across multiple source docs are never touched.
 *
 * Reversal: every changed card id + its prior status is written to a JSON file
 * so the operation can be undone.
 *
 * Usage:
 *   node scripts/ops/dedupe-meeting-extraction-cards.mjs <meetingId> [meetingId...]        # dry-run
 *   node scripts/ops/dedupe-meeting-extraction-cards.mjs --apply <meetingId> [meetingId...] # apply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { createClient } = require(
  path.join(REPO, "frontend/node_modules/@supabase/supabase-js"),
);
const BATCH_GAP_MIN = 10; // gap (minutes) that separates two extraction batches

function loadEnv() {
  const env = fs.readFileSync(path.join(REPO, ".env"), "utf8");
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };
  return get;
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const all = argv.includes("--all");
  const meetingIds = argv.filter((a) => !a.startsWith("--"));
  return { apply, all, meetingIds };
}

async function pageAll(query, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

/**
 * Full historical backfill. Bulk-reads all evidence + candidate cards once,
 * computes per-meeting extraction batches in memory, and supersedes every batch
 * except the latest — for cards that are exclusive to one meeting, auto-assigned,
 * and currently open. Never touches cards shared across source docs.
 */
async function runAll(pm, apply) {
  console.log("Loading meeting document ids…");
  const meetings = await pageAll(() =>
    pm.from("document_metadata").select("id").eq("type", "meeting").is("deleted_at", null),
  );
  const meetingIdSet = new Set(meetings.map((m) => m.id));
  console.log(`  meetings: ${meetingIdSet.size}`);

  console.log("Loading all insight_card_evidence…");
  const evidence = await pageAll(() =>
    pm.from("insight_card_evidence").select("insight_card_id,source_document_id"),
  );
  // card -> set(source docs), and meeting -> set(cards)
  const cardDocs = new Map();
  const meetingCards = new Map();
  for (const e of evidence) {
    if (!e.insight_card_id) continue;
    const docs = cardDocs.get(e.insight_card_id) || new Set();
    if (e.source_document_id) docs.add(e.source_document_id);
    cardDocs.set(e.insight_card_id, docs);
    if (meetingIdSet.has(e.source_document_id)) {
      const set = meetingCards.get(e.source_document_id) || new Set();
      set.add(e.insight_card_id);
      meetingCards.set(e.source_document_id, set);
    }
  }
  console.log(`  evidence rows: ${evidence.length}; meetings with cards: ${meetingCards.size}`);

  console.log("Loading candidate insight_cards (auto_assigned, open)…");
  const cards = await pageAll(() =>
    pm
      .from("insight_cards")
      .select("id,created_at")
      .eq("attribution_status", "auto_assigned")
      .eq("current_status", "open"),
  );
  const cardCreatedAt = new Map(cards.map((c) => [c.id, c.created_at]));
  console.log(`  candidate cards: ${cards.length}`);

  const losers = [];
  let affectedMeetings = 0;
  for (const [, cardIds] of meetingCards) {
    // eligible = exclusive + candidate
    const eligible = [];
    for (const cid of cardIds) {
      if (!cardCreatedAt.has(cid)) continue; // not auto_assigned/open
      if ((cardDocs.get(cid)?.size || 0) > 1) continue; // shared
      eligible.push({ id: cid, created_at: cardCreatedAt.get(cid) });
    }
    if (eligible.length < 2) continue;
    const batches = splitBatches(eligible);
    if (batches.length < 2) continue;
    affectedMeetings += 1;
    for (const c of batches.slice(0, -1).flat()) losers.push(c.id);
  }

  console.log(
    `\n${apply ? "APPLIED" : "DRY-RUN"} — ${affectedMeetings} meetings with >1 extraction batch; ${apply ? "superseding" : "would supersede"} ${losers.length} duplicate cards.`,
  );

  if (apply && losers.length) {
    for (let i = 0; i < losers.length; i += 200) {
      const chunk = losers.slice(i, i + 200);
      const { error } = await pm
        .from("insight_cards")
        .update({ current_status: "superseded" })
        .in("id", chunk);
      if (error) throw new Error(`update failed: ${error.message}`);
      if (i % 2000 === 0) console.log(`  …${i + chunk.length}/${losers.length}`);
    }
    const out = path.join(REPO, "verify-output", "dedupe-cards-reversal-ALL.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(losers, null, 2));
    console.log(`  ✓ superseded ${losers.length}. Reversal manifest: ${out}`);
  }
}

async function cardsForMeeting(pm, meetingId) {
  const ev = await pm
    .from("insight_card_evidence")
    .select("insight_card_id")
    .eq("source_document_id", meetingId);
  if (ev.error) throw new Error(`evidence load failed: ${ev.error.message}`);
  const ids = [...new Set((ev.data || []).map((r) => r.insight_card_id).filter(Boolean))];
  if (!ids.length) return [];

  const { data: cards, error } = await pm
    .from("insight_cards")
    .select("id,title,card_type,current_status,attribution_status,created_at")
    .in("id", ids);
  if (error) throw new Error(`cards load failed: ${error.message}`);

  // Keep only loop-artifact candidates that are exclusive to this meeting.
  const eligible = [];
  for (const c of cards || []) {
    if (c.attribution_status !== "auto_assigned") continue;
    if (c.current_status !== "open") continue;
    const links = await pm
      .from("insight_card_evidence")
      .select("source_document_id")
      .eq("insight_card_id", c.id);
    const docs = new Set((links.data || []).map((r) => r.source_document_id));
    if (docs.size > 1) continue; // shared — never touch
    eligible.push(c);
  }
  return eligible;
}

function splitBatches(cards) {
  const sorted = cards
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const batches = [];
  let current = [];
  let prev = null;
  for (const c of sorted) {
    const t = Date.parse(c.created_at);
    if (prev !== null && t - prev > BATCH_GAP_MIN * 60_000) {
      batches.push(current);
      current = [];
    }
    current.push(c);
    prev = t;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function main() {
  const { apply, all, meetingIds } = parseArgs(process.argv.slice(2));
  if (!all && !meetingIds.length) {
    console.error("Provide at least one meeting document id, or --all.");
    process.exit(1);
  }
  const get = loadEnv();
  const pm = createClient(
    get("SUPABASE_URL") || get("NEXT_PUBLIC_SUPABASE_URL"),
    get("SUPABASE_SERVICE_ROLE_KEY") || get("SUPABASE_SERVICE_KEY"),
    { auth: { persistSession: false } },
  );

  if (all) {
    await runAll(pm, apply);
    return;
  }

  const reversal = [];
  let totalKept = 0;
  let totalSuperseded = 0;

  for (const meetingId of meetingIds) {
    const eligible = await cardsForMeeting(pm, meetingId);
    if (!eligible.length) {
      console.log(`\n${meetingId}: no eligible loop-artifact cards.`);
      continue;
    }
    const batches = splitBatches(eligible);
    const keep = batches[batches.length - 1] || [];
    const losers = batches.slice(0, -1).flat();
    totalKept += keep.length;
    totalSuperseded += losers.length;

    console.log(
      `\n${meetingId}: ${eligible.length} eligible cards in ${batches.length} extraction batch(es).`,
    );
    console.log(
      `  batch sizes (oldest→newest): ${batches.map((b) => b.length).join(", ")}`,
    );
    console.log(`  KEEP latest batch: ${keep.length} cards`);
    console.log(`  SUPERSEDE older batches: ${losers.length} cards`);

    for (const c of losers) reversal.push({ id: c.id, prior_status: c.current_status });

    if (apply && losers.length) {
      const ids = losers.map((c) => c.id);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await pm
          .from("insight_cards")
          .update({ current_status: "superseded" })
          .in("id", chunk);
        if (error) throw new Error(`update failed: ${error.message}`);
      }
      console.log(`  ✓ marked ${losers.length} cards superseded`);
    }
  }

  console.log(
    `\n${apply ? "APPLIED" : "DRY-RUN"} — kept ${totalKept}, ${apply ? "superseded" : "would supersede"} ${totalSuperseded}.`,
  );

  if (apply && reversal.length) {
    const out = path.join(REPO, "verify-output", `dedupe-cards-reversal-${meetingIds.length}mtgs.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(reversal, null, 2));
    console.log(`Reversal manifest: ${out}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
