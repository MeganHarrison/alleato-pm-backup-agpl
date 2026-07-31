#!/usr/bin/env node

/**
 * Apply explicit project_attribution_rules to unassigned communication sources.
 *
 * This is deterministic and model-free. It only uses active rules from the app
 * DB and skips ambiguous equal-confidence matches.
 */

import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "./app-db-connection.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), override: false, quiet: true });

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  args.set(arg.slice(2), next && !next.startsWith("--") ? next : "true");
}

const dryRun = args.get("dry-run") === "true" || args.get("apply") !== "true";
const lookbackDays = numberArg("days", 14);
const limit = numberArg("limit", 5000);

function numberArg(name, fallback) {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`--${name} must be numeric.`);
    process.exit(1);
  }
  return value;
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsToken(text, pattern) {
  if (!pattern) return false;
  return new RegExp(`(^|[^0-9a-z])${escapeRegExp(pattern)}([^0-9a-z]|$)`, "i").test(text);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchRule(document, rule) {
  const title = normalize(document.title);
  const body = normalize(document.text_sample);
  const combined = `${title} ${body}`.trim();
  const pattern = normalize(rule.pattern_normalized || rule.pattern);
  if (!pattern) return false;

  if (rule.rule_type === "title_keyword") {
    return containsToken(title, pattern) || title.includes(pattern);
  }
  if (rule.rule_type === "keyword" || rule.rule_type === "phrase") {
    return containsToken(combined, pattern) || combined.includes(pattern);
  }
  return false;
}

function chooseAssignment(document, rules) {
  const matches = rules
    .filter((rule) => matchRule(document, rule))
    .sort((a, b) =>
      Number(b.confidence ?? 0) - Number(a.confidence ?? 0) ||
      Number(a.priority ?? 100) - Number(b.priority ?? 100) ||
      Number(a.project_id) - Number(b.project_id),
    );

  if (matches.length === 0) return null;
  const best = matches[0];
  const tiedProjectIds = new Set(
    matches
      .filter((match) => Number(match.confidence ?? 0) === Number(best.confidence ?? 0))
      .map((match) => Number(match.project_id)),
  );
  if (tiedProjectIds.size > 1) return null;
  return best;
}

const appDatabaseUrl = getAppDatabaseUrl();
const ragDatabaseUrl = getRagDatabaseUrl();

if (!appDatabaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.");
  process.exit(1);
}
if (!ragDatabaseUrl) {
  console.error("RAG_DATABASE_URL is required.");
  process.exit(1);
}

const appPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(appDatabaseUrl, { includeSslMode: false }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const ragPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(ragDatabaseUrl, {
    includeSslMode: false,
    rewriteSupabaseDirectHost: false,
  }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const appClient = await appPool.connect();
const ragClient = await ragPool.connect();

try {
  const rules = (await appClient.query(
    `
      select r.project_id, p.name as project_name, r.rule_type, r.pattern,
        r.pattern_normalized, r.confidence::float as confidence, r.priority::int as priority,
        r.source
      from public.project_attribution_rules r
      join public.projects p on p.id = r.project_id
      where r.status = 'active'
      order by r.confidence desc, r.priority asc, r.project_id asc
    `,
  )).rows;

  const documents = (await appClient.query(
    `
      select id, title, source, category, type, created_at
      from public.document_metadata
      where deleted_at is null
        and project_id is null
        and created_at >= now() - ($1::text || ' days')::interval
        and source in ('fireflies', 'microsoft_graph')
      order by created_at desc
      limit $2
    `,
    [lookbackDays, limit],
  )).rows;

  const documentIds = documents.map((row) => String(row.id));
  const chunkRows = documentIds.length
    ? (await ragClient.query(
        `
          select document_id,
            left(string_agg(left(coalesce(text, ''), 1000), E'\n' order by chunk_index), 4000) as text_sample
          from public.document_chunks
          where document_id = any($1::text[])
          group by document_id
        `,
        [documentIds],
      )).rows
    : [];
  const textByDocumentId = new Map(chunkRows.map((row) => [String(row.document_id), String(row.text_sample ?? "")]));

  const assignments = documents
    .map((document) => ({
      document: {
        ...document,
        text_sample: textByDocumentId.get(String(document.id)) ?? "",
      },
      rule: chooseAssignment(
        {
          ...document,
          text_sample: textByDocumentId.get(String(document.id)) ?? "",
        },
        rules,
      ),
    }))
    .filter((assignment) => assignment.rule);

  if (!dryRun && assignments.length > 0) {
    await appClient.query("begin");
    await ragClient.query("begin");
    try {
      for (const { document, rule } of assignments) {
        const projectId = Number(rule.project_id);
        const method = `attribution_rule:${rule.rule_type}:${rule.pattern_normalized}`;

        await appClient.query(
          `
            update public.document_metadata
            set project_id = $1
            where id = $2
              and project_id is null
          `,
          [projectId, document.id],
        );

        await appClient.query(
          `
            update public.tasks
            set project_id = $1,
              project_ids = case
                when project_ids is null then array[$1]::bigint[]
                when $1 = any(project_ids) then project_ids
                else array_append(project_ids, $1)
              end,
              updated_at = now()
            where metadata_id = $2
              and project_id is null
          `,
          [projectId, document.id],
        );

        await appClient.query(
          `
            update public.outlook_email_intake
            set project_id = $1,
              assignment_method = $2
            where document_metadata_id = $3
              and project_id is null
          `,
          [projectId, method, document.id],
        ).catch((error) => {
          if (error?.code !== "42703" && error?.code !== "42P01") throw error;
        });

        await appClient.query(
          `
            update public.project_emails
            set project_id = $1
            where id in (
              select project_email_id
              from public.outlook_email_intake
              where document_metadata_id = $2
                and project_email_id is not null
            )
              and project_id is null
          `,
          [projectId, document.id],
        ).catch((error) => {
          if (error?.code !== "42703" && error?.code !== "42P01") throw error;
        });

        await ragClient.query(
          `
            update public.document_chunks
            set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb,
              updated_at = now()
            where document_id = $2
          `,
          [
            JSON.stringify({
              project_id: projectId,
              project_name: rule.project_name,
              project_attribution_method: method,
              project_attribution_source: "project_attribution_rules",
            }),
            document.id,
          ],
        );

        await ragClient.query(
          `
            update public.source_processing_jobs
            set project_id = $1,
              status = case when status = 'project_assignment_review' then 'project_assigned' else status end,
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
            where source_document_id = $3
              and project_id is null
          `,
          [
            projectId,
            JSON.stringify({
              project_applicability: "single_project",
              project_required: true,
              project_applicability_reason: "matched_project_attribution_rule",
              project_attribution_method: method,
            }),
            document.id,
          ],
        );
      }
      await appClient.query("commit");
      await ragClient.query("commit");
    } catch (error) {
      await appClient.query("rollback");
      await ragClient.query("rollback");
      throw error;
    }
  }

  const byProject = assignments.reduce((groups, { rule }) => {
    const key = `${rule.project_id}:${rule.project_name}`;
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {});

  console.log(JSON.stringify({
    status: "pass",
    dryRun,
    lookbackDays,
    limit,
    rulesLoaded: rules.length,
    documentsScanned: documents.length,
    assignments: assignments.length,
    byProject,
    samples: assignments.slice(0, 20).map(({ document, rule }) => ({
      id: document.id,
      title: document.title,
      project_id: rule.project_id,
      project_name: rule.project_name,
      rule_type: rule.rule_type,
      pattern: rule.pattern,
      confidence: rule.confidence,
    })),
  }, null, 2));
} finally {
  appClient.release();
  ragClient.release();
  await appPool.end();
  await ragPool.end();
}
