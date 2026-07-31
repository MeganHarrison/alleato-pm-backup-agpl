#!/usr/bin/env node

/**
 * Assign generated tasks to projects when task text contains deterministic
 * project evidence. This is intentionally separate from source assignment:
 * one meeting/email thread can mention multiple projects, while each task
 * should land on the specific project it names.
 */

import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
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
const sourceSystemFilter = textArg("source-system", "");
const syncExistingProjectIds = args.get("sync-existing-project-ids") === "true";

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

function textArg(name, fallback) {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  return String(raw).trim();
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function containsToken(text, pattern) {
  if (!pattern) return false;
  return new RegExp(`(^|[^0-9a-z])${escapeRegExp(pattern)}([^0-9a-z]|$)`, "i").test(text);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function projectTerms(project) {
  const terms = [];
  const name = normalize(project.name);
  const number = normalize(project.project_number);
  if (number) terms.push({ term: number, weight: 40, type: "project_number" });
  if (name) terms.push({ term: name, weight: 35, type: "project_name" });

  for (const alias of project.aliases ?? []) {
    const term = normalize(alias);
    if (term.length >= 3) terms.push({ term, weight: 32, type: "alias" });
  }

  const goodwillMatch = name.match(/^goodwill\s+(.+)$/);
  if (goodwillMatch && goodwillMatch[1]?.length >= 5) {
    terms.push({ term: goodwillMatch[1], weight: 24, type: "goodwill_short_name" });
  }

  return terms;
}

function scoreTask(task, project, attributionRules) {
  const title = normalize(task.title);
  const description = normalize(task.description);
  const text = `${title} ${description}`.trim();
  const compactText = compact(text);
  const evidence = [];
  let score = 0;

  for (const rule of attributionRules.filter((item) => Number(item.project_id) === Number(project.id))) {
    const pattern = normalize(rule.pattern_normalized || rule.pattern);
    if (!pattern) continue;
    const matched = rule.rule_type === "title_keyword"
      ? containsToken(title, pattern) || title.includes(pattern)
      : containsToken(text, pattern) || text.includes(pattern);
    if (matched) {
      score += Math.round(Number(rule.confidence ?? 0.9) * 50);
      evidence.push(`rule:${rule.pattern}`);
    }
  }

  for (const item of projectTerms(project)) {
    if (item.type === "project_number") {
      if (containsToken(text, item.term) || compact(item.term).length >= 4 && compactText.includes(compact(item.term))) {
        score += item.weight;
        evidence.push(item.term);
      }
      continue;
    }
    if (item.term.length >= 5 && (containsToken(text, item.term) || text.includes(item.term))) {
      score += item.weight;
      evidence.push(item.term);
    }
  }

  return { score, evidence: [...new Set(evidence)] };
}

function chooseAssignment(task, projects, attributionRules) {
  const scored = projects
    .map((project) => ({ project, ...scoreTask(task, project, attributionRules) }))
    .filter((item) => item.score >= 24)
    .sort((a, b) => b.score - a.score || Number(a.project.id) - Number(b.project.id));

  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score < scored[1].score + 8) return null;
  return scored[0];
}

const appDatabaseUrl = getAppDatabaseUrl();
if (!appDatabaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.");
  process.exit(1);
}

const appPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(appDatabaseUrl, { includeSslMode: false }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const client = await appPool.connect();

try {
  const projects = (await client.query(
    `
      select id, name, project_number, aliases
      from public.projects
      where archived = false
    `,
  )).rows;

  const attributionRules = (await client.query(
    `
      select project_id, rule_type, pattern, pattern_normalized, confidence, priority
      from public.project_attribution_rules
      where status = 'active'
    `,
  )).rows;

  const tasks = (await client.query(
    `
      select id, title, description, source_system, metadata_id, created_at
      from public.tasks
      where project_id is null
        and ($3::text = '' or source_system = $3::text)
        and created_at >= now() - ($1::text || ' days')::interval
      order by created_at desc
      limit $2
    `,
    [lookbackDays, limit, sourceSystemFilter],
  )).rows;

  const assignments = tasks
    .map((task) => ({ task, assignment: chooseAssignment(task, projects, attributionRules) }))
    .filter((item) => item.assignment);

  const existingProjectIdMismatches = syncExistingProjectIds
    ? (await client.query(
        `
          select id, title, source_system, metadata_id, created_at, project_id, coalesce(project_ids, '{}'::bigint[]) as project_ids
          from public.tasks
          where project_id is not null
            and ($3::text = '' or source_system = $3::text)
            and created_at >= now() - ($1::text || ' days')::interval
            and (
              project_ids is null
              or not (project_id = any(project_ids))
            )
          order by created_at desc
          limit $2
        `,
        [lookbackDays, limit, sourceSystemFilter],
      )).rows
    : [];

  if (!dryRun && (assignments.length > 0 || existingProjectIdMismatches.length > 0)) {
    await client.query("begin");
    try {
      for (const { task, assignment } of assignments) {
        await client.query(
          `
            update public.tasks
            set project_id = $1,
              project_ids = case
                when project_ids is null then array[$1]::bigint[]
                when $1 = any(project_ids) then project_ids
                else array_append(project_ids, $1)
              end,
              updated_at = now()
            where id = $2
              and project_id is null
          `,
          [assignment.project.id, task.id],
        );
      }
      if (existingProjectIdMismatches.length > 0) {
        await client.query(
          `
            update public.tasks t
            set project_ids = case
                when t.project_ids is null then array[v.project_id]::bigint[]
                when v.project_id = any(t.project_ids) then t.project_ids
                else array_append(t.project_ids, v.project_id)
              end,
              updated_at = now()
            from (
              select *
              from jsonb_to_recordset($1::jsonb) as x(task_id uuid, project_id bigint)
            ) v
            where t.id = v.task_id
          `,
          [JSON.stringify(existingProjectIdMismatches.map((row) => ({
            task_id: String(row.id),
            project_id: Number(row.project_id),
          })))],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  const byProject = assignments.reduce((groups, { assignment }) => {
    const key = `${assignment.project.id}:${assignment.project.name}`;
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {});

  console.log(JSON.stringify({
    status: "pass",
    dryRun,
    lookbackDays,
    limit,
    sourceSystemFilter: sourceSystemFilter || null,
    syncExistingProjectIds,
    projectsLoaded: projects.length,
    rulesLoaded: attributionRules.length,
    tasksScanned: tasks.length,
    assignments: assignments.length,
    existingProjectIdMismatches: existingProjectIdMismatches.length,
    existingProjectIdMismatchesUpdated: dryRun ? 0 : existingProjectIdMismatches.length,
    byProject,
    samples: assignments.slice(0, 30).map(({ task, assignment }) => ({
      id: task.id,
      title: task.title,
      project_id: assignment.project.id,
      project_name: assignment.project.name,
      score: assignment.score,
      evidence: assignment.evidence,
    })),
    existingProjectIdMismatchSamples: existingProjectIdMismatches.slice(0, 30).map((task) => ({
      id: task.id,
      title: task.title,
      source_system: task.source_system,
      metadata_id: task.metadata_id,
      project_id: task.project_id,
      previous_project_ids: task.project_ids,
    })),
  }, null, 2));
} finally {
  client.release();
  await appPool.end();
}
