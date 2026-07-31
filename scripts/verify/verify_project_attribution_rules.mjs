#!/usr/bin/env node

/**
 * Project Attribution Rule Health Check.
 *
 * This is the canary for project assignment drift in Outlook/project
 * communications. It exits non-zero when:
 * - unsafe Projects-table auto rules are active against body content
 * - subject/title rules disagree with stored Outlook assignments
 * - one subject has equally confident matches to multiple projects
 * - linked Outlook/project_email/document_metadata rows disagree
 *
 * Run: npm run verify:project-attribution
 */

import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error("[FATAL] DATABASE_URL or SUPABASE_DB_URL is required.");
  process.exit(1);
}

const windowDays = Number(process.env.PROJECT_ATTRIBUTION_AUDIT_DAYS ?? 90);
const exampleLimit = Number(process.env.PROJECT_ATTRIBUTION_AUDIT_EXAMPLE_LIMIT ?? 10);
const sql = postgres(databaseUrl, { max: 1, ssl: "require" });

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function printRows(label, rows) {
  if (rows.length === 0) return;
  console.error(label);
  for (const row of rows) {
    console.error(`- ${JSON.stringify(row)}`);
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectMatchesRule(subject, rule) {
  const normalizedSubject = ` ${normalizeText(subject)} `;
  const pattern = ` ${normalizeText(rule.pattern_normalized || rule.pattern)} `;
  return pattern.trim().length > 0 && normalizedSubject.includes(pattern);
}

try {
  await sql`set statement_timeout = '45s'`;

  const [ruleStats] = await sql`
    select
      count(*) filter (where status = 'active')::int as active_rules,
      count(*) filter (
        where status = 'active'
          and source = 'projects_table_auto_seed'
          and rule_type in ('keyword', 'phrase')
      )::int as active_unsafe_auto_rules,
      count(*) filter (
        where status = 'active'
          and source = 'projects_table_subject_seed'
          and rule_type = 'title_keyword'
      )::int as active_subject_seed_rules
    from public.project_attribution_rules
  `;

  if (ruleStats.active_rules === 0) {
    fail("No active project_attribution_rules exist. Project assignment will fall back to weaker signals.");
  }

  if (ruleStats.active_unsafe_auto_rules > 0) {
    fail(
      `${ruleStats.active_unsafe_auto_rules} unsafe Projects-table auto rules are active as keyword/phrase body-match rules.`,
    );
  }

  if (ruleStats.active_subject_seed_rules === 0) {
    fail("No active Projects-table subject/title seed rules exist.");
  }

  const broadPatterns = await sql`
    select project_id, rule_type, pattern, source
    from public.project_attribution_rules
    where status = 'active'
      and source like 'projects_table%'
      and pattern_normalized in (
        'event',
        'port',
        'power',
        'space',
        'indianapolis',
        'miami',
        'city',
        'lake',
        'salt',
        'finance',
        'marketing',
        'foods',
        'rise'
      )
    order by pattern_normalized, project_id
  `;

  if (broadPatterns.length > 0) {
    fail(`${broadPatterns.length} broad/generic Projects-table terms are active.`);
    printRows("Broad active rule examples:", broadPatterns.slice(0, exampleLimit));
  }

  const titleRules = await sql`
    select
      r.project_id,
      p.name as project_name,
      r.pattern,
      r.pattern_normalized,
      r.confidence::float as confidence,
      r.priority::int as priority
    from public.project_attribution_rules r
    left join public.projects p on p.id = r.project_id
    where r.status = 'active'
      and r.rule_type = 'title_keyword'
    order by r.confidence desc, r.priority asc, r.project_id asc
  `;

  const recentEmails = await sql`
    select
      e.id,
      e.subject,
      e.project_id as current_project_id,
      p.name as current_project
    from public.outlook_email_intake e
    left join public.projects p on p.id = e.project_id
    where e.deleted_at is null
      and e.received_at >= now() - (${windowDays}::text || ' days')::interval
      and nullif(trim(coalesce(e.subject, '')), '') is not null
    order by e.id desc
  `;

  const subjectMismatches = [];
  const ambiguousSubjects = [];

  for (const email of recentEmails) {
    const matches = titleRules
      .filter((rule) => subjectMatchesRule(email.subject, rule))
      .sort((a, b) => b.confidence - a.confidence || a.priority - b.priority || a.project_id - b.project_id);

    if (matches.length === 0) continue;

    const best = matches[0];
    const tiedBestProjectIds = new Set(
      matches
        .filter((match) => match.confidence === best.confidence)
        .map((match) => match.project_id),
    );

    if (tiedBestProjectIds.size > 1) {
      ambiguousSubjects.push({
        id: email.id,
        subject: String(email.subject ?? "(no subject)").slice(0, 140),
        confidence: best.confidence,
        project_ids: [...tiedBestProjectIds].sort((a, b) => a - b),
        patterns: matches
          .filter((match) => match.confidence === best.confidence)
          .map((match) => match.pattern)
          .sort(),
      });
      continue;
    }

    if (email.current_project_id !== best.project_id) {
      subjectMismatches.push({
        id: email.id,
        subject: String(email.subject ?? "(no subject)").slice(0, 140),
        current_project_id: email.current_project_id,
        current_project: email.current_project,
        rule_project_id: best.project_id,
        rule_project: best.project_name,
        pattern: best.pattern,
      });
    }
  }

  if (subjectMismatches.length > 0) {
    fail(
      `Subject/title attribution rules disagree with stored Outlook project_id for at least ${subjectMismatches.length} recent rows.`,
    );
    printRows("Subject mismatch examples:", subjectMismatches.slice(0, exampleLimit));
  }

  if (ambiguousSubjects.length > 0) {
    fail(`${ambiguousSubjects.length} recent subjects have equally confident matches to multiple projects.`);
    printRows("Ambiguous subject examples:", ambiguousSubjects.slice(0, exampleLimit));
  }

  const crossSurfaceDrift = await sql`
    select
      e.id,
      left(coalesce(e.subject, '(no subject)'), 140) as subject,
      e.project_id as intake_project_id,
      pe.project_id as project_email_project_id,
      dm.project_id as document_metadata_project_id
    from public.outlook_email_intake e
    left join public.project_emails pe on pe.id = e.project_email_id
    left join public.document_metadata dm on dm.id = e.document_metadata_id
    where e.deleted_at is null
      and e.received_at >= now() - (${windowDays}::text || ' days')::interval
      and (
        (pe.id is not null and pe.project_id is distinct from e.project_id)
        or (dm.id is not null and dm.project_id is distinct from e.project_id)
      )
    order by e.id desc
    limit ${exampleLimit + 1}
  `;

  if (crossSurfaceDrift.length > 0) {
    fail(`${crossSurfaceDrift.length} recent Outlook rows disagree across linked project surfaces.`);
    printRows("Cross-surface drift examples:", crossSurfaceDrift.slice(0, exampleLimit));
  }

  const [backfillStats] = await sql`
    select
      count(*) filter (
        where assignment_method = 'attribution_rule:title_keyword_backfill'
      )::int as subject_backfilled_rows,
      count(*) filter (
        where assignment_method like 'attribution_rule:%'
      )::int as attribution_rule_rows
    from public.outlook_email_intake
    where deleted_at is null
      and received_at >= now() - (${windowDays}::text || ' days')::interval
  `;

  console.log("Project attribution rule health:");
  console.log(`- audit window: ${windowDays} days`);
  console.log(`- active rules: ${ruleStats.active_rules}`);
  console.log(`- active Projects-table subject rules: ${ruleStats.active_subject_seed_rules}`);
  console.log(`- subject-rule backfilled Outlook rows: ${backfillStats.subject_backfilled_rows}`);
  console.log(`- attribution-rule Outlook rows: ${backfillStats.attribution_rule_rows}`);

  if (warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error("Project attribution rule health check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Project attribution rule health check passed.");
} catch (error) {
  console.error("[FATAL] Project attribution rule health check crashed.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
