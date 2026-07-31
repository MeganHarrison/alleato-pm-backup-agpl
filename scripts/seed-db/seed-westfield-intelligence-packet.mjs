#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const { Pool } = pg;
const dryRun = process.argv.includes("--dry-run");
const compilerVersion = "manual-westfield-v1-2026-04-30";
const targetSlug = "westfield-collective";
const projectId = 43;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: (() => {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete("sslmode");
    return url.toString();
  })(),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const cards = [
  {
    key: "project-status",
    title: "Current project read",
    card_type: "project_update",
    section: "current_read",
    rank: 10,
    summary:
      "Westfield Collective has active late-stage communication around LOI/warranty language, change-order signatures, remaining work, and payment follow-up.",
    why_it_matters:
      "The latest sources show the project needs tight commercial and closeout coordination rather than another broad discovery pass.",
    confidence: "medium",
    next_action:
      "Treat the current packet as the baseline, then check post-April-22 communications before making a client-facing claim.",
    evidenceKey: "loiTeams",
    evidenceRole: "recent_signal",
    relevanceReason:
      "Recent Teams messages discuss governing-law/warranty wording for Westfield Collective.",
  },
  {
    key: "financial-exposure",
    title: "Financial exposure and payment pressure",
    card_type: "financial_exposure",
    section: "financial_exposure",
    rank: 20,
    summary:
      "The packet flags pending cost exposure and payment pressure: past-due invoice communication is present, and older plumbing/change-order scope still needs formal cost confirmation.",
    why_it_matters:
      "Financial questions should be answered from structured project/financial tools first, then communication evidence should be used as an early-warning layer.",
    confidence: "medium",
    next_action:
      "Pull current budget, commitments, change orders, and direct costs before quoting final exposure dollars.",
    evidenceKey: "pastDueInvoices",
    evidenceRole: "financial_signal",
    relevanceReason:
      "April 2026 email thread is explicitly about Westfield Collective past-due invoices.",
  },
  {
    key: "change-management",
    title: "Change-management risk",
    card_type: "change_management",
    section: "change_management",
    rank: 30,
    summary:
      "Change-management risk centers on plumbing scope, floor-sink changes, mop-sink/Pepsi-line additions, and unsigned change-order documentation.",
    why_it_matters:
      "The project has enough source evidence to know the issue exists, but the assistant should not infer final approved values without structured change-order records.",
    confidence: "medium",
    next_action:
      "Match the plumbing/change-order discussion against approved PCO/CO records and signed change-order attachments.",
    evidenceKey: "changeOrderDiscussion",
    evidenceRole: "change_signal",
    relevanceReason:
      "Project source describes plumbing change orders, floor sinks, mop sink, and payment/documentation follow-up.",
  },
  {
    key: "schedule-operational-risk",
    title: "Schedule and operational risk",
    card_type: "schedule_risk",
    section: "schedule_operational_risk",
    rank: 40,
    summary:
      "Operational risk is tied to closeout readiness: remaining items, patio/grade decisions, health-inspection plumbing fixes, and vendor coordination have appeared in recent project communications.",
    why_it_matters:
      "These are likely schedule blockers if ownership and completion evidence are not confirmed before inspection or turnover checkpoints.",
    confidence: "medium",
    next_action:
      "Verify open RFIs/submittals/schedule tasks and the latest remaining-items email thread before saying the risk is resolved.",
    evidenceKey: "remainingItems",
    evidenceRole: "operational_signal",
    relevanceReason:
      "Recent email thread is explicitly about Westfield Collective remaining items.",
  },
  {
    key: "decision-open-question",
    title: "Decision and open question",
    card_type: "open_question",
    section: "decisions_open_questions",
    rank: 50,
    summary:
      "Open decisions include whether warranty/governing-law language is acceptable and whether change-order signatures/documentation are complete.",
    why_it_matters:
      "These issues can slow closeout, payment, or contractual acceptance even when field work is moving.",
    confidence: "medium",
    next_action:
      "Confirm the warranty wording response, change-order signature status, and who owns the next outbound follow-up.",
    evidenceKey: "loiEmail",
    evidenceRole: "decision_signal",
    relevanceReason:
      "Recent LOI email and Teams messages show legal/commercial wording still being actively discussed.",
  },
  {
    key: "missed-follow-up",
    title: "Likely missed follow-up",
    card_type: "task",
    section: "follow_ups",
    rank: 60,
    summary:
      "Likely missed follow-ups are the LeMaster/warranty wording response, past-due invoice resolution, change-order signatures, and confirming remaining work ownership.",
    why_it_matters:
      "The value of the packet is surfacing follow-ups that can fall between Teams, email, and project records.",
    confidence: "low",
    next_action:
      "Create or verify explicit owner/date tasks for each follow-up before treating this as resolved.",
    evidenceKey: "changeOrderSignature",
    evidenceRole: "follow_up_signal",
    relevanceReason:
      "Change-order signature email provides a concrete follow-up thread, but task completion has not been verified.",
  },
];

const evidenceSelectors = {
  loiTeams: {
    sql: `
      select id, title, category, source, source_system, date, captured_at,
             coalesce(summary, content, raw_text, '') as source_text,
             participants_array
      from public.document_metadata
      where project_id = $1
        and category = 'teams_message'
        and coalesce(content, raw_text, summary, '') ilike '%Indiana law%'
      order by coalesce(date, captured_at, created_at) desc nulls last
      limit 1
    `,
  },
  loiEmail: {
    sql: `
      select id, title, category, source, source_system, date, captured_at,
             coalesce(summary, content, raw_text, '') as source_text,
             participants_array
      from public.document_metadata
      where project_id = $1
        and title ilike '%Westfield LOI%'
      order by coalesce(date, captured_at, created_at) desc nulls last
      limit 1
    `,
  },
  pastDueInvoices: {
    sql: `
      select id, title, category, source, source_system, date, captured_at,
             coalesce(summary, content, raw_text, '') as source_text,
             participants_array
      from public.document_metadata
      where project_id = $1
        and title ilike '%Past Due Invoices%'
      order by coalesce(date, captured_at, created_at) desc nulls last
      limit 1
    `,
  },
  changeOrderDiscussion: {
    sql: `
      select id, title, category, source, source_system, date, captured_at,
             coalesce(summary, content, raw_text, '') as source_text,
             participants_array
      from public.document_metadata
      where project_id = $1
        and (
          title ilike '%Change Order Discussion%'
          or coalesce(summary, content, raw_text, '') ilike '%floor sink%'
        )
      order by coalesce(date, captured_at, created_at) desc nulls last
      limit 1
    `,
  },
  remainingItems: {
    sql: `
      select id, title, category, source, source_system, date, captured_at,
             coalesce(summary, content, raw_text, '') as source_text,
             participants_array
      from public.document_metadata
      where project_id = $1
        and title ilike '%Remaining Items%'
      order by coalesce(date, captured_at, created_at) desc nulls last
      limit 1
    `,
  },
  changeOrderSignature: {
    sql: `
      select id, title, category, source, source_system, date, captured_at,
             coalesce(summary, content, raw_text, '') as source_text,
             participants_array
      from public.document_metadata
      where project_id = $1
        and title ilike '%Change Order Signatures%'
      order by coalesce(date, captured_at, created_at) desc nulls last
      limit 1
    `,
  },
};

function excerpt(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

async function one(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function main() {
  let client;
  try {
    client = await pool.connect();
    await client.query("begin");

    const project = await one(
      client,
      `select id, name, project_number, client
       from public.projects
       where id = $1 and lower(coalesce(name, '')) = 'westfield collective'`,
      [projectId],
    );
    if (!project) {
      throw new Error("Westfield Collective did not resolve to projects.id = 43.");
    }

    const coverage = await one(
      client,
      `select
          (select count(*)::int from public.document_metadata where project_id = $1) as document_metadata_rows,
          (select count(*)::int from public.ai_memories where project_id = $1) as ai_memory_rows,
          (select count(*)::int from public.project_emails where project_id = $1) as project_email_rows,
          (select max(coalesce(date, captured_at, created_at)) from public.document_metadata where project_id = $1) as latest_source_at`,
      [projectId],
    );

    const target = await one(
      client,
      `insert into public.intelligence_targets
        (target_type, name, slug, description, status, priority, project_id, metadata, last_signal_at)
       values
        ('client_project', 'Westfield Collective', $1,
         'Primary V1 packet-first client project intelligence proof target.',
         'active', 'high', $2, $3::jsonb, $4)
       on conflict (slug) do update set
         target_type = excluded.target_type,
         name = excluded.name,
         description = excluded.description,
         status = excluded.status,
         priority = excluded.priority,
         project_id = excluded.project_id,
         metadata = excluded.metadata,
         last_signal_at = excluded.last_signal_at
       returning id`,
      [
        targetSlug,
        projectId,
        JSON.stringify({
          projectNumber: project.project_number,
          client: project.client,
          seedSource: "manual_gold_standard",
          sourceCoverageNote:
            "document_metadata and ai_memories have substantial project coverage; project_emails has zero project-scoped rows.",
        }),
        coverage.latest_source_at,
      ],
    );

    const targetId = target.id;

    const existingCards = await client.query(
      `select id from public.insight_cards where primary_target_id = $1`,
      [targetId],
    );
    const cardIds = existingCards.rows.map((row) => row.id);
    if (cardIds.length > 0) {
      await client.query(
        `delete from public.intelligence_reviews where insight_card_id = any($1::uuid[])`,
        [cardIds],
      );
      await client.query(
        `delete from public.insight_cards where id = any($1::uuid[])`,
        [cardIds],
      );
    }
    await client.query(`delete from public.intelligence_packets where target_id = $1`, [targetId]);

    const evidenceRows = {};
    for (const [key, selector] of Object.entries(evidenceSelectors)) {
      evidenceRows[key] = await one(client, selector.sql, [projectId]);
    }

    const insertedCards = [];
    for (const card of cards) {
      const evidence = evidenceRows[card.evidenceKey];
      const inserted = await one(
        client,
        `insert into public.insight_cards
          (primary_target_id, title, card_type, summary, why_it_matters, current_status,
           confidence, attribution_status, next_action, first_seen_at, last_seen_at,
           stale_after, source_count, compiler_version, metadata)
         values
          ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
         returning id`,
        [
          targetId,
          card.title,
          card.card_type,
          card.summary,
          card.why_it_matters,
          card.confidence,
          card.confidence === "low" ? "needs_review" : "approved",
          card.next_action,
          evidence?.date ?? evidence?.captured_at ?? coverage.latest_source_at,
          evidence?.date ?? evidence?.captured_at ?? coverage.latest_source_at,
          coverage.latest_source_at
            ? new Date(new Date(coverage.latest_source_at).getTime() + 14 * 24 * 60 * 60 * 1000)
                .toISOString()
            : null,
          evidence ? 1 : 0,
          compilerVersion,
          JSON.stringify({
            key: card.key,
            section: card.section,
            sourceCoverageStatus: evidence ? "linked" : "missing",
          }),
        ],
      );

      await client.query(
        `insert into public.insight_card_targets
          (insight_card_id, target_id, relationship, confidence, attribution_status,
           matched_terms, reason)
         values ($1, $2, 'primary', $3, $4, $5, $6)`,
        [
          inserted.id,
          targetId,
          card.confidence,
          card.confidence === "low" ? "needs_review" : "approved",
          ["Westfield Collective", "Westfield", "project 43"],
          "Seeded primary target link for Westfield packet V1.",
        ],
      );

      if (evidence) {
        await client.query(
          `insert into public.insight_card_evidence
            (insight_card_id, source_document_id, source_type, source_title,
             source_occurred_at, participants, excerpt, summary, relevance_reason,
             evidence_role, confidence)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            inserted.id,
            evidence.id,
            evidence.category || evidence.source_system || evidence.source || "document_metadata",
            evidence.title,
            evidence.date ?? evidence.captured_at,
            evidence.participants_array ?? [],
            excerpt(evidence.source_text),
            card.summary,
            card.relevanceReason,
            card.evidenceRole,
            card.confidence,
          ],
        );
      }

      insertedCards.push({ ...card, id: inserted.id });
    }

    const packetJson = {
      target: {
        id: targetId,
        slug: targetSlug,
        name: "Westfield Collective",
        projectId,
      },
      responseContract: [
        "Current read",
        "What changed recently",
        "Financial/change-management exposure",
        "Schedule/operational risk",
        "Decisions/open questions/follow-ups",
        "Recommended next action",
        "Evidence basis and confidence",
        "Gaps",
      ],
      cardKeys: insertedCards.map((card) => card.key),
    };

    const sourceCoverage = {
      freshnessStatus: "working_sample",
      documentMetadataRows: coverage.document_metadata_rows,
      aiMemoryRows: coverage.ai_memory_rows,
      projectEmailRows: coverage.project_email_rows,
      latestSourceAt: coverage.latest_source_at,
      linkedEvidenceCount: Object.values(evidenceRows).filter(Boolean).length,
      gaps: [
        "project_emails has zero project-scoped rows for project 43",
        "manual packet does not replace structured financial verification",
        "post-packet communications must be checked for stale answers",
      ],
    };

    const confidenceSummary = {
      overall: "medium",
      status: "medium",
      financialExposure: "medium",
      changeManagement: "medium",
      followUps: "low",
      reason:
        "The packet links to real project communications, but formal cost/status values still require structured tools.",
    };

    const packetFields = [
      targetId,
      compilerVersion,
      coverage.latest_source_at,
      "working_sample",
      "Westfield Collective has enough current communication coverage to answer as a project advisor, but V1 must label the packet as a working sample and verify formal cost/status values with structured tools.",
      "Active closeout/commercial coordination with LOI/warranty language, past-due invoice follow-up, change-order signatures, and remaining work signals.",
      "The project risk is not lack of data; it is cross-source follow-through across email, Teams, change orders, and structured financial records.",
      "This packet gives the assistant a stable baseline before raw RAG, preventing a vague source dump while still naming source gaps.",
      [
        "Verify latest post-April-22 communications before making client-facing claims.",
        "Check structured budget, commitments, direct costs, and change orders before quoting exposure dollars.",
        "Assign owners/dates for warranty language, change-order signatures, past-due invoices, and remaining items.",
      ],
      JSON.stringify(confidenceSummary),
      JSON.stringify(sourceCoverage),
      3,
      0,
      JSON.stringify(packetJson),
      compilerVersion,
    ];

    const currentPacket = await one(
      client,
      `insert into public.intelligence_packets
        (target_id, packet_type, packet_version, covered_end_at, freshness_status,
         executive_summary, current_status, strategic_read, why_it_matters,
         recommended_next_moves, confidence_summary, source_coverage,
         review_queue_count, stale_item_count, packet_json, compiler_version)
       values
        ($1, 'current', $2, $3, $4, $5, $6, $7, $8, $9::text[],
         $10::jsonb, $11::jsonb, $12, $13, $14::jsonb, $15)
       returning id`,
      packetFields,
    );

    const goldPacket = await one(
      client,
      `insert into public.intelligence_packets
        (target_id, packet_type, packet_version, covered_end_at, freshness_status,
         executive_summary, current_status, strategic_read, why_it_matters,
         recommended_next_moves, confidence_summary, source_coverage,
         review_queue_count, stale_item_count, packet_json, compiler_version)
       values
        ($1, 'manual_gold_standard', $2, $3, $4, $5, $6, $7, $8, $9::text[],
         $10::jsonb, $11::jsonb, $12, $13, $14::jsonb, $15)
       returning id`,
      packetFields,
    );

    for (const packetId of [currentPacket.id, goldPacket.id]) {
      for (const card of insertedCards) {
        await client.query(
          `insert into public.intelligence_packet_cards
            (packet_id, insight_card_id, section, rank, included_reason)
           values ($1, $2, $3, $4, $5)`,
          [
            packetId,
            card.id,
            card.section,
            card.rank,
            "Included in the Westfield V1 advisor response contract.",
          ],
        );
      }
    }

    const reviews = [
      {
        review_type: "source_gap",
        review_reason:
          "project_emails has zero project-scoped rows for Westfield; email evidence currently comes through document_metadata.",
        proposed_value: { projectEmailRows: coverage.project_email_rows },
      },
      {
        review_type: "financial_verification",
        review_reason:
          "Financial exposure card must be verified against structured budget, commitments, change orders, direct costs, and Acumatica data before numeric claims.",
        proposed_value: { requiredTools: ["budget", "commitments", "change_orders", "direct_costs", "acumatica"] },
      },
      {
        review_type: "attribution_review",
        review_reason:
          "Missed follow-up card is low confidence until task ownership and completion are verified.",
        proposed_value: { cardKey: "missed-follow-up" },
      },
    ];

    for (const review of reviews) {
      await client.query(
        `insert into public.intelligence_reviews
          (review_type, status, review_reason, proposed_value)
         values ($1, 'open', $2, $3::jsonb)`,
        [review.review_type, review.review_reason, JSON.stringify(review.proposed_value)],
      );
    }

    for (const secondary of [
      {
        name: "JobPlanner Replacement",
        slug: "jobplanner-replacement",
        description: "Secondary internal initiative target for attribution compatibility.",
      },
      {
        name: "AI Implementation",
        slug: "ai-implementation",
        description: "Secondary internal initiative target for Alleato AI implementation planning.",
      },
      {
        name: "JobPlanner",
        slug: "jobplanner",
        description: "Secondary internal initiative target for legacy JobPlanner references.",
      },
    ]) {
      await client.query(
        `insert into public.intelligence_targets
          (target_type, name, slug, description, status, priority, project_id, metadata)
         values ('internal_initiative', $1, $2, $3, 'active', 'medium', null, $4::jsonb)
         on conflict (slug) do update set
          name = excluded.name,
          description = excluded.description,
          status = excluded.status,
          priority = excluded.priority,
          metadata = excluded.metadata`,
        [
          secondary.name,
          secondary.slug,
          secondary.description,
          JSON.stringify({ seededFor: "secondary_compatibility", compilerVersion }),
        ],
      );
    }

    if (dryRun) {
      await client.query("rollback");
    } else {
      await client.query("commit");
    }

    console.log(
      JSON.stringify(
        {
          status: dryRun ? "dry_run_rolled_back" : "seeded",
          targetSlug,
          projectId,
          targetId,
          currentPacketId: currentPacket.id,
          manualGoldStandardPacketId: goldPacket.id,
          cardCount: insertedCards.length,
          linkedEvidenceCount: Object.values(evidenceRows).filter(Boolean).length,
          reviewCount: reviews.length,
          sourceCoverage,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original error.
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

await main();
