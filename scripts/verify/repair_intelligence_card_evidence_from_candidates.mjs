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
const dryRun = process.argv.includes("--dry-run");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function connectionString(name) {
  const url = new URL(requireEnv(name));
  url.searchParams.delete("sslmode");
  return url.toString();
}

const mainPool = new pg.Pool({
  connectionString: connectionString("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const ragPool = new pg.Pool({
  connectionString: connectionString("RAG_DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function candidateIds(card) {
  const metadata = asObject(card.metadata);
  const ids = metadata.source_signal_candidate_ids;
  if (Array.isArray(ids)) return ids.filter((id) => typeof id === "string" && id.length > 0);
  const id = metadata.last_source_signal_candidate_id;
  return typeof id === "string" && id.length > 0 ? [id] : [];
}

function textIncludesTarget(card, target) {
  const haystack = `${card.title ?? ""}\n${card.summary ?? ""}`.toLowerCase();
  const name = String(target.name ?? "").toLowerCase();
  const slugWords = String(target.slug ?? "").replace(/-/g, " ").toLowerCase();
  return (name && haystack.includes(name)) || (slugWords && haystack.includes(slugWords));
}

function normalizeProjectId(value) {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function rejectCard(main, card, reason) {
  const metadata = {
    ...asObject(card.metadata),
    evidence_repair: {
      status: "rejected_duplicate_or_misattributed",
      reason,
      repaired_at: new Date().toISOString(),
    },
  };

  if (dryRun) return;

  await main.query(
    `update public.insight_cards
     set attribution_status = 'rejected',
         current_status = case when current_status = 'open' then 'stale' else current_status end,
         metadata = $2::jsonb,
         updated_at = now()
     where id = $1`,
    [card.id, JSON.stringify(metadata)],
  );
  await main.query(
    `delete from public.intelligence_packet_cards
     where insight_card_id = $1`,
    [card.id],
  );
}

async function copyEvidenceFromCanonical(main, card, canonicalCardId, reason) {
  if (dryRun) return;

  await main.query(
    `insert into public.insight_card_evidence (
       insight_card_id,
       source_document_id,
       source_chunk_id,
       source_type,
       source_title,
       source_occurred_at,
       source_message_id,
       participants,
       excerpt,
       summary,
       relevance_reason,
       evidence_role,
       confidence
     )
     select
       $1,
       source_document_id,
       source_chunk_id,
       source_type,
       source_title,
       source_occurred_at,
       source_message_id,
       participants,
       excerpt,
       summary,
       $3,
       evidence_role,
       confidence
     from public.insight_card_evidence
     where insight_card_id = $2
       and not exists (
         select 1
         from public.insight_card_evidence existing
         where existing.insight_card_id = $1
           and existing.source_document_id = public.insight_card_evidence.source_document_id
       )`,
    [card.id, canonicalCardId, reason],
  );
}

async function main() {
  const main = await mainPool.connect();
  const rag = await ragPool.connect();
  const result = {
    target: targetSlug,
    dryRun,
    repairedEvidence: 0,
    rejectedCards: 0,
    inspectedCards: 0,
    actions: [],
  };

  try {
    const targetRow = await main.query(
      `select id, slug, name, project_id
       from public.intelligence_targets
       where slug = $1`,
      [targetSlug],
    );
    const target = targetRow.rows[0];
    if (!target) throw new Error(`Missing intelligence target ${targetSlug}`);

    const missingEvidence = await main.query(
      `select c.*
       from public.insight_cards c
       left join public.insight_card_evidence e on e.insight_card_id = c.id
       where c.primary_target_id = $1
         and coalesce(c.attribution_status, '') <> 'rejected'
       group by c.id
       having count(e.id) = 0
       order by c.updated_at desc`,
      [target.id],
    );

    for (const card of missingEvidence.rows) {
      result.inspectedCards += 1;
      const ids = candidateIds(card);
      let rejected = false;

      if (ids.length > 0) {
        const candidates = await rag.query(
          `select id, source_document_id, source_chunk_id, target_id, project_id,
                  promoted_insight_card_id, confidence, source_occurred_at
           from public.source_signal_candidates
           where id = any($1::uuid[])`,
          [ids],
        );

        for (const candidate of candidates.rows) {
          const canonicalId = candidate.promoted_insight_card_id;
          if (canonicalId && canonicalId !== card.id) {
            const canonicalEvidence = await main.query(
              `select count(*)::int as count
               from public.insight_card_evidence
               where insight_card_id = $1`,
              [canonicalId],
            );
            if ((canonicalEvidence.rows[0]?.count ?? 0) > 0) {
              await rejectCard(
                main,
                card,
                `Duplicate of canonical evidence-backed card ${canonicalId}`,
              );
              result.rejectedCards += 1;
              result.actions.push({
                cardId: card.id,
                title: card.title,
                action: "rejected_duplicate",
                canonicalCardId: canonicalId,
              });
              rejected = true;
              break;
            }
          }

          const candidateProjectId = normalizeProjectId(candidate.project_id);
          if (
            candidateProjectId !== null &&
            normalizeProjectId(target.project_id) !== null &&
            candidateProjectId !== normalizeProjectId(target.project_id)
          ) {
            await rejectCard(
              main,
              card,
              `Candidate belongs to project ${candidateProjectId}, not target project ${target.project_id}`,
            );
            result.rejectedCards += 1;
            result.actions.push({
              cardId: card.id,
              title: card.title,
              action: "rejected_project_mismatch",
              candidateProjectId,
            });
            rejected = true;
            break;
          }

          if (canonicalId && canonicalId === card.id) {
            continue;
          }
        }
      }

      if (rejected) continue;

      if (!textIncludesTarget(card, target)) {
        await rejectCard(
          main,
          card,
          "No surviving source candidate and card text does not name the target",
        );
        result.rejectedCards += 1;
        result.actions.push({
          cardId: card.id,
          title: card.title,
          action: "rejected_missing_candidate_not_target_named",
        });
        continue;
      }

      if (ids.length > 0) {
        const candidates = await rag.query(
          `select promoted_insight_card_id
           from public.source_signal_candidates
           where id = any($1::uuid[])
             and promoted_insight_card_id is not null
           limit 1`,
          [ids],
        );
        const canonicalId = candidates.rows[0]?.promoted_insight_card_id;
        if (canonicalId && canonicalId !== card.id) {
          await copyEvidenceFromCanonical(
            main,
            card,
            canonicalId,
            `Copied from canonical evidence-backed card ${canonicalId}`,
          );
          result.repairedEvidence += 1;
          result.actions.push({
            cardId: card.id,
            title: card.title,
            action: "copied_canonical_evidence",
            canonicalCardId: canonicalId,
          });
        } else {
          result.actions.push({
            cardId: card.id,
            title: card.title,
            action: "unresolved",
            reason: "No canonical evidence-backed card found",
          });
        }
      }
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    main.release();
    rag.release();
    await mainPool.end();
    await ragPool.end();
  }
}

main().catch(async (error) => {
  console.error(error);
  await mainPool.end().catch(() => {});
  await ragPool.end().catch(() => {});
  process.exit(1);
});
