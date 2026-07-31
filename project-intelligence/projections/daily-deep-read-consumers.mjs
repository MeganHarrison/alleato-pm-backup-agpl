#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "../../scripts/verify/app-db-connection.mjs";
import { RAG_DATABASE_CONNECTION_OPTIONS } from "../ingestion/rag-database-connection.mjs";
import { runProjectionFanout } from "./projection-fanout.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), quiet: true });

const COMPILER_VERSION = "daily_deep_read_consumers_v1";
const DAILY_TARGET_SLUG = "daily-executive-brief";
// Sentinel owner shared with the weekly cron (PROGRESS_REPORT_CRON_USER_ID in
// frontend/src/lib/progress-reports/server.ts). Reports owned by this id are
// system-generated drafts safe to refresh; a real user id means a human edited
// it and we must never overwrite.
const PROGRESS_REPORT_CRON_USER_ID = "00000000-0000-0000-0000-000000000001";
const args = parseArgs(process.argv.slice(2));
const packetIdArg = typeof args.packetId === "string" ? args.packetId : null;
const shouldWrite = !args["no-write"] && !args["dry-run"];
// Run only the progress-report step (skip candidates/tasks/current-state). Used
// to (re)build reports on demand without re-running the whole consumer.
const progressReportsOnly = Boolean(args["progress-reports-only"]);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith("--") ? next : true;
    if (parsed[key] === next) index += 1;
  }
  return parsed;
}

async function withPg(rawUrl, options, callback) {
  const pool = new pg.Pool({
    connectionString: await buildAppDatabaseConnectionString(rawUrl, options),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query("set statement_timeout = '45000ms'");
    return await callback(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function withAppTransaction(existingClient, callback) {
  if (existingClient) return callback(existingClient);
  return withPg(getAppDatabaseUrl(), { includeSslMode: false }, async (client) => {
    await client.query("begin");
    try {
      const result = await callback(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function loadDailyDeepReadPacket() {
  return withPg(getAppDatabaseUrl(), { includeSslMode: false }, async (client) => {
    const params = [];
    const packetFilter = packetIdArg ? "and p.id = $1::uuid" : "and p.packet_type = 'current'";
    if (packetIdArg) params.push(packetIdArg);
    const { rows } = await client.query(
      `
        select
          p.id,
          p.target_id,
          p.generated_at,
          p.covered_start_at,
          p.covered_end_at,
          p.source_coverage,
          p.packet_json,
          t.slug
        from public.intelligence_packets p
        join public.intelligence_targets t on t.id = p.target_id
        where t.slug = '${DAILY_TARGET_SLUG}'
          ${packetFilter}
        order by p.generated_at desc
        limit 1
      `,
      params,
    );
    const packet = rows[0];
    if (!packet) {
      throw new Error(
        packetIdArg
          ? `Daily Deep Read packet not found: ${packetIdArg}`
          : "No current Daily Deep Read packet found.",
      );
    }
    if (packet.packet_json?.kind !== "daily_deep_read") {
      throw new Error(`Current packet ${packet.id} is not kind=daily_deep_read.`);
    }
    return packet;
  });
}

const ELLIPSIS_SPLIT = /…|\.{3,}/;

/**
 * Map each citation token the brief cited to its full, durable source id using
 * the packet's `sourceSet` manifest, so candidates store real ids (not the
 * short `S12` alias, which is only meaningful inside one packet, and not a
 * truncated Outlook prefix). Resolution mirrors the frontend resolver
 * (`buildSourceIndex`): exact alias/id match first, then a UNIQUE trailing/
 * interior-ellipsis prefix match for pre-alias packets. Alias-shaped tokens
 * that don't map are dropped (a bare `S12` is meaningless downstream); other
 * unresolved tokens are kept verbatim for provenance/back-compat.
 */
function canonicalizeSourceIds(tokens, sourceSet) {
  const sources = sourceSet?.sources || [];
  const byKey = new Map();
  const ids = [];
  for (const source of sources) {
    if (!source?.id) continue;
    if (!byKey.has(source.id)) {
      byKey.set(source.id, source.id);
      ids.push(source.id);
    }
    if (source.alias && !byKey.has(source.alias)) byKey.set(source.alias, source.id);
  }
  const out = [];
  const seen = new Set();
  const push = (id) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };
  for (const token of tokens) {
    const exact = byKey.get(token);
    if (exact) {
      push(exact);
      continue;
    }
    if (ELLIPSIS_SPLIT.test(token)) {
      const [prefix, suffix = ""] = token.split(ELLIPSIS_SPLIT).map((part) => part.trim());
      if (prefix.length >= 6) {
        const matches = ids.filter(
          (id) => id.startsWith(prefix) && (suffix === "" || id.endsWith(suffix)),
        );
        if (matches.length === 1) {
          push(matches[0]);
          continue;
        }
      }
    }
    if (/^S\d+$/.test(token)) continue; // unresolved alias — meaningless, drop it
    push(token); // pre-alias full id we couldn't disambiguate; keep for provenance
  }
  return out;
}

function stableKey(packetId, signalType, title) {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  const suffix = crypto.createHash("sha1").update(`${packetId}:${signalType}:${title}`).digest("hex").slice(0, 10);
  return `daily-deep-read:${packetId}:${signalType}:${normalized}:${suffix}`;
}

function duplicateCandidateKey(candidate) {
  return [
    candidate.project_id ?? "unassigned",
    candidate.title,
    candidate.summary,
    (candidate.extraction_json?.source_ids || []).join("|"),
  ]
    .join("\n")
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function signalTypePriority(signalType) {
  switch (signalType) {
    case "project_update":
      return 50;
    case "risk":
      return 40;
    case "decision":
      return 30;
    case "task":
      return 20;
    case "process_issue":
      return 10;
    default:
      return 0;
  }
}

function isBetterDuplicateCandidate(next, current) {
  if (!current) return true;
  if (next.confidence_score !== current.confidence_score) {
    return next.confidence_score > current.confidence_score;
  }
  return signalTypePriority(next.signal_type) > signalTypePriority(current.signal_type);
}

function dedupeCandidates(candidates) {
  const selected = new Map();
  const duplicateSections = new Map();
  for (const candidate of candidates) {
    const key = duplicateCandidateKey(candidate);
    if (!key) continue;
    const section = candidate.extraction_json?.section;
    if (section) {
      duplicateSections.set(key, [...(duplicateSections.get(key) || []), section]);
    }
    const current = selected.get(key);
    if (isBetterDuplicateCandidate(candidate, current)) {
      selected.set(key, candidate);
    }
  }
  return [...selected.entries()].map(([key, candidate]) => ({
    ...candidate,
    extraction_json: {
      ...candidate.extraction_json,
      duplicate_sections_collapsed: [...new Set(duplicateSections.get(key) || [])],
    },
  }));
}

function confidenceForSignal(signalType) {
  if (signalType === "decision") return { score: 0.86, label: "high" };
  if (signalType === "task") return { score: 0.74, label: "medium" };
  return { score: 0.8, label: "medium" };
}

function projectIdForSourceIds(sourceIds, sourceSet) {
  const byId = new Map((sourceSet?.sources || []).map((source) => [source.id, source.projectId]));
  const values = sourceIds.map((id) => byId.get(id)).filter((value) => Number.isInteger(value));
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}

function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeForMatch(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        ![
          "the",
          "and",
          "road",
          "phase",
          "project",
          "permit",
          "budget",
          "audit",
          "seed",
          "internal",
          "ops",
          "outreach",
          "sprinkler",
          "electrical",
        ].includes(token),
    );
}

async function loadProjectRows() {
  return withPg(getAppDatabaseUrl(), { includeSslMode: false }, async (client) => {
    const { rows } = await client.query(
      "select id, name, project_number, type from public.projects where name is not null order by id",
    );
    const projects = rows
      .filter((row) => {
        const name = String(row.name || "");
        return (
          !/^temporary project code/i.test(name) &&
          !/^budget audit seed/i.test(name)
        );
      })
      .map((row) => ({
      id: Number(row.id),
      name: row.name,
      projectNumber: row.project_number,
      normalizedName: normalizeForMatch(row.name),
      tokens: tokens(`${row.name} ${row.project_number || ""}`),
    }));
    const tokenFrequency = new Map();
    for (const project of projects) {
      for (const token of new Set(project.tokens)) {
        tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
      }
    }
    return projects.map((project) => ({
      ...project,
      distinctiveTokens: project.tokens.filter((token) => token.length >= 6 && tokenFrequency.get(token) === 1),
    }));
  });
}

// People directory for resolving action-item owners → assignee_person_id on the
// real tasks the deep read creates. Owner labels in the structured brief
// ("Parker Hollingsworth", "Brandon") are matched to people rows; an unmatched
// owner keeps its label as assignee_name with a null person id.
async function loadPeople() {
  return withPg(getAppDatabaseUrl(), { includeSslMode: false }, async (client) => {
    const { rows } = await client.query(
      "select id, first_name, last_name, email from public.people where status is distinct from 'inactive'",
    );
    return rows.map((row) => {
      const first = String(row.first_name || "").trim();
      const last = String(row.last_name || "").trim();
      return {
        id: row.id,
        email: row.email || null,
        fullName: `${first} ${last}`.trim(),
        normalizedFull: normalizeForMatch(`${first} ${last}`),
        normalizedFirst: normalizeForMatch(first),
      };
    });
  });
}

function resolvePersonByName(name, people) {
  const normalized = normalizeForMatch(String(name || ""));
  if (!normalized) return null;
  const full = people.find((person) => person.normalizedFull && person.normalizedFull === normalized);
  if (full) return full;
  const contained = people.find(
    (person) =>
      person.normalizedFull &&
      (normalized.includes(person.normalizedFull) || person.normalizedFull.includes(normalized)),
  );
  if (contained) return contained;
  const firstMatches = people.filter(
    (person) => person.normalizedFirst && person.normalizedFirst === normalized,
  );
  if (firstMatches.length === 1) return firstMatches[0];
  return null;
}

function projectIdForText(text, projectRows) {
  const normalized = normalizeForMatch(text);
  if (normalized.includes("superior beverage")) {
    const superior = projectRows.find((project) => project.normalizedName.includes("superior"));
    if (superior) return superior.id;
  }
  const explicitProject = normalized.match(/\bproject\s+(\d{2,6})\b/)?.[1];
  if (explicitProject) {
    const byId = projectRows.find((project) => String(project.id) === explicitProject);
    if (byId) return byId.id;
  }
  const exact = projectRows.find(
    (project) =>
      (project.normalizedName && normalized.includes(project.normalizedName)) ||
      (project.projectNumber && normalized.includes(normalizeForMatch(project.projectNumber))),
  );
  if (exact) return exact.id;

  const distinctiveMatches = projectRows
    .map((project) => ({
      id: project.id,
      score: project.distinctiveTokens.filter((token) => normalized.includes(token)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (distinctiveMatches.length === 1 || distinctiveMatches[0]?.score > distinctiveMatches[1]?.score) {
    return distinctiveMatches[0].id;
  }

  const scored = projectRows
    .map((project) => {
      const overlap = project.tokens.filter((token) => normalized.includes(token)).length;
      return {
        id: project.id,
        score: overlap,
      };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].id;
}

// Candidates come straight from the STRUCTURED v3 brief: owner decisions from
// `brief.callsToday`, tasks from each project's `actionItems`. No markdown/section
// parsing — the structure already carries owner, due date, and source aliases.
function candidatesFromPacket(packet, projectRows) {
  const brief = packet.packet_json?.brief;
  const sourceSet = packet.packet_json?.sourceSet || {};
  const businessDate = packet.packet_json?.businessDate || packet.covered_start_at?.toISOString?.()?.slice(0, 10);
  if (!brief || typeof brief !== "object") return [];
  const candidates = [];

  const push = ({ signalType, project, title, summary, sourceIdsRaw, origin, extraction = {} }) => {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return;
    const cleanSummary = String(summary || cleanTitle).trim();
    const sourceIds = canonicalizeSourceIds(sourceIdsRaw || [], sourceSet);
    const primarySourceId = sourceIds[0] || `daily_packet:${packet.id}`;
    const { score, label } = confidenceForSignal(signalType);
    const sourceProjectId = projectIdForSourceIds(sourceIds, sourceSet);
    const textProjectId = projectIdForText(`${project || ""}\n${cleanTitle}\n${cleanSummary}`, projectRows);
    candidates.push({
      source_document_id: primarySourceId,
      source_chunk_id: null,
      target_id: null,
      project_id: sourceProjectId || textProjectId,
      signal_type: signalType,
      title: cleanTitle,
      summary: cleanSummary,
      // No real "why" is extracted; the review workflow owns interpretation. Never
      // store placeholder prose — it gets woven into /daily-brief and /executive.
      why_it_matters: null,
      current_status: "open",
      confidence_score: score,
      confidence: label,
      status: "needs_review",
      suggested_owner_person_id: null,
      suggested_owner_label: extraction.owner ?? null,
      next_action: null,
      stale_after: null,
      source_occurred_at: packet.covered_end_at,
      excerpt: cleanSummary.slice(0, 2000),
      normalized_signal_key: stableKey(packet.id, signalType, cleanTitle),
      extraction_json: {
        daily_packet_id: packet.id,
        daily_packet_generated_at: packet.generated_at,
        business_date: businessDate,
        source_ids: sourceIds,
        origin,
        consumer_compiler_version: COMPILER_VERSION,
        candidate_policy: "review_gated_not_auto_promoted",
        source_policy: "Derived from daily_deep_read structured brief (v3); no direct chunk synthesis.",
        project_assignment_method: sourceProjectId
          ? "source_set_single_project"
          : textProjectId
            ? "project_name_or_number_match"
            : "unassigned_company_wide",
        ...extraction,
      },
      compiler_version: COMPILER_VERSION,
    });
  };

  // Owner decisions → decision candidates.
  for (const call of brief.callsToday || []) {
    if (!call?.project || !call?.question) continue;
    push({
      signalType: "decision",
      project: call.project,
      title: `${call.project}: ${call.question}`,
      summary: call.question,
      sourceIdsRaw: call.sourceIds,
      origin: "calls_today",
      extraction: { optional: Boolean(call.optional) },
    });
  }

  // Action items → task candidates (owner and due date carried through).
  for (const project of brief.projects || []) {
    for (const item of project.actionItems || []) {
      if (!item?.text) continue;
      const owner = item.ownerIsBrandon ? "Brandon" : item.owner || null;
      const due = item.due ? ` (due ${item.due})` : "";
      push({
        signalType: "task",
        project: project.name,
        title: `${project.name}: ${item.text}`,
        summary: `${item.text}${due}`,
        sourceIdsRaw: item.sourceIds,
        origin: "action_item",
        extraction: { owner, due: item.due ?? null, due_iso: item.dueIso ?? null, project: project.name },
      });
    }
  }

  return dedupeCandidates(candidates);
}

const OPERATIONAL_LOSS_CATEGORIES = new Set([
  "change_management", "financial_controls", "procurement", "reporting",
  "accountability", "scheduling", "owner_relations", "safety", "other",
]);
const OPERATIONAL_LOSS_PREVENTABILITY = new Set([
  "preventable", "partially_preventable", "cannot_determine",
]);

function operationalLossFindingsFromPacket(packet, projectRows) {
  const brief = packet.packet_json?.brief;
  const sourceSet = packet.packet_json?.sourceSet || {};
  const businessDate = packet.packet_json?.businessDate || packet.covered_start_at?.toISOString?.()?.slice(0, 10);
  if (!brief || !Array.isArray(brief.preventionFindings)) return { findings: [], unresolved: [] };
  const sourceById = new Map((sourceSet.sources || []).map((source) => [source.id, source]));
  const findings = [];
  const unresolved = [];
  for (const raw of brief.preventionFindings) {
    const issueKey = String(raw?.issueKey || "").trim();
    const sourceIds = canonicalizeSourceIds(raw?.sourceIds || [], sourceSet);
    const category = String(raw?.category || "");
    const preventability = String(raw?.preventability || "");
    if (!issueKey || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(issueKey) || !OPERATIONAL_LOSS_CATEGORIES.has(category) || !OPERATIONAL_LOSS_PREVENTABILITY.has(preventability) || !sourceIds.length) {
      unresolved.push({ issueKey: issueKey || null, title: raw?.title || null, reason: "invalid_or_unresolved_daily_brief_prevention_finding" });
      continue;
    }
    const sources = sourceIds.map((id) => sourceById.get(id)).filter(Boolean);
    const sourceProjectId = projectIdForSourceIds(sourceIds, sourceSet);
    const textProjectId = projectIdForText(`${raw?.title || ""}\n${raw?.observedCondition || ""}`, projectRows);
    findings.push({
      issueKey,
      title: String(raw.title || issueKey).trim(),
      category,
      severity: ["low", "medium", "high", "critical"].includes(raw.severity) ? raw.severity : "medium",
      observedCondition: String(raw.observedCondition || "").trim(),
      preventability,
      preventabilityBasis: String(raw.preventabilityBasis || "").trim(),
      missingControl: String(raw.missingControl || "").trim(),
      recommendedSystem: String(raw.recommendedSystem || "").trim(),
      accountableRole: raw.accountableRole ? String(raw.accountableRole).trim() : null,
      leadingIndicator: raw.leadingIndicator ? String(raw.leadingIndicator).trim() : null,
      confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "medium",
      sourceIds,
      sourceEvidence: sources.map((source) => ({
        id: source.id, alias: source.alias, lane: source.lane, title: source.title,
        projectId: source.projectId ?? null, url: source.url ?? null, sourceAt: source.sourceAt ?? null,
      })),
      projectId: sourceProjectId || textProjectId || null,
      businessDate,
    });
  }
  return { findings, unresolved };
}

function functionalOwnerForCategory(category) {
  if (["procurement", "scheduling", "accountability", "reporting"].includes(category)) return "operations";
  if (category === "financial_controls") return "finance";
  if (category === "change_management") return "project_management";
  if (category === "owner_relations") return "leadership";
  return "unassigned";
}

function businessImpactForCategory(category) {
  const byCategory = {
    procurement: ["schedule_risk", "rework"], scheduling: ["schedule_risk"],
    financial_controls: ["cash_flow_delay", "margin_leakage"], owner_relations: ["owner_confidence_risk"],
    safety: ["compliance_risk"], change_management: ["rework", "margin_leakage"],
    accountability: ["team_friction"], reporting: ["owner_confidence_risk"], other: ["other"],
  };
  return byCategory[category] || ["other"];
}

async function writeOperationalLossOccurrences(findings, packet) {
  return withPg(getAppDatabaseUrl(), { includeSslMode: false }, async (client) => {
    await client.query("begin");
    try {
      let inserted = 0;
      for (const finding of findings) {
        const issueResult = await client.query(
          `insert into public.recurring_issues (
             operational_loss_key, issue_title, issue_category, issue_summary,
             business_impact, severity, functional_owner, status,
             recommended_countermeasure, first_seen_date, last_seen_date
           ) values ($1,$2,$3,$4,$5::text[],$6,$7,'monitoring',$8,$9::date,$9::date)
           on conflict (operational_loss_key) where operational_loss_key is not null do update set
             issue_title = excluded.issue_title,
             issue_summary = excluded.issue_summary,
             issue_category = excluded.issue_category,
             business_impact = excluded.business_impact,
             severity = excluded.severity,
             functional_owner = excluded.functional_owner,
             recommended_countermeasure = excluded.recommended_countermeasure,
             last_seen_date = greatest(public.recurring_issues.last_seen_date, excluded.last_seen_date)
           returning id`,
          [finding.issueKey, finding.title, finding.category, finding.observedCondition,
            businessImpactForCategory(finding.category), finding.severity,
            functionalOwnerForCategory(finding.category), finding.recommendedSystem, finding.businessDate],
        );
        const issueId = issueResult.rows[0].id;
        await client.query(
          `insert into public.operational_loss_occurrences (
             recurring_issue_id, packet_id, business_date, finding_key, observed_condition,
             preventability, preventability_basis, missing_control, recommended_system,
             accountable_role, leading_indicator, source_aliases, source_evidence, confidence, review_status
           ) values ($1::uuid,$2::uuid,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[],$13::jsonb,$14,'needs_review')
           on conflict (packet_id, finding_key) do update set
             recurring_issue_id = excluded.recurring_issue_id, observed_condition = excluded.observed_condition,
             preventability = excluded.preventability, preventability_basis = excluded.preventability_basis,
             missing_control = excluded.missing_control, recommended_system = excluded.recommended_system,
             accountable_role = excluded.accountable_role, leading_indicator = excluded.leading_indicator,
             source_aliases = excluded.source_aliases, source_evidence = excluded.source_evidence,
             confidence = excluded.confidence, updated_at = now()`,
          [issueId, packet.id, finding.businessDate, finding.issueKey, finding.observedCondition,
            finding.preventability, finding.preventabilityBasis, finding.missingControl, finding.recommendedSystem,
            finding.accountableRole, finding.leadingIndicator, finding.sourceIds,
            JSON.stringify(finding.sourceEvidence), finding.confidence],
        );
        if (finding.projectId) {
          await client.query(
            `insert into public.recurring_issue_projects (recurring_issue_id, project_id)
             values ($1::uuid,$2::bigint) on conflict do nothing`, [issueId, finding.projectId],
          );
        }
        inserted += 1;
      }
      await client.query("commit");
      return { inserted };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

// Guardrail: candidate prose fields must never carry derived placeholder
// boilerplate. Those strings get woven into /daily-brief and /executive
// narrative (PR #801 had to strip them defensively at render time). Fail the
// run loudly at the source rather than persist polluted rows.
const BANNED_PLACEHOLDER_PATTERNS = [
  /Derived from Daily Deep Read section/i,
  /Review candidate and decide/i,
  /Review and either assign as a task or reject/i,
];

function assertNoPlaceholderProse(candidates) {
  const proseFields = ["why_it_matters", "next_action"];
  const offenders = [];
  for (const candidate of candidates) {
    for (const field of proseFields) {
      const value = candidate[field];
      if (typeof value === "string" && BANNED_PLACEHOLDER_PATTERNS.some((re) => re.test(value))) {
        offenders.push(`${candidate.normalized_signal_key} → ${field}: ${JSON.stringify(value)}`);
      }
    }
  }
  if (offenders.length) {
    throw new Error(
      `Refusing to write ${offenders.length} candidate(s) with placeholder prose in ` +
        `why_it_matters/next_action. Set these fields to null or derive real values.\n` +
        offenders.join("\n"),
    );
  }
}

// The deep read already reads the full transcript/email/Teams corpus for the
// day — so it is the right place to CREATE the real tasks, not only the
// review-gated candidates. Owner decisions (brief.callsToday) become Brandon's
// tasks; each project's actionItems become the owner's tasks with due carried
// through. These are written directly to public.tasks (source_system
// 'daily_deep_read'), idempotent per business date, so /tasks and /daily-brief
// read one operating record instead of diverging pipelines.
const BRANDON_OWNER_LABEL = "Brandon Clymer";

function safeDateIso(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function tasksFromPacket(packet, projectRows, people) {
  const brief = packet.packet_json?.brief;
  const sourceSet = packet.packet_json?.sourceSet || {};
  const businessDate =
    packet.packet_json?.businessDate || packet.covered_start_at?.toISOString?.()?.slice(0, 10);
  if (!brief || typeof brief !== "object") return [];
  const tasks = [];
  const seen = new Set();

  const push = ({ title, description, ownerLabel, ownerIsBrandon, project, dueIso, sourceIdsRaw, origin, priority }) => {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return;
    const dedupeKey = normalizeForMatch(`${project || ""} ${cleanTitle}`);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const category = ownerIsBrandon ? "brandon" : "team";
    const resolvedOwnerLabel = ownerIsBrandon ? BRANDON_OWNER_LABEL : ownerLabel || null;
    const person = resolvedOwnerLabel ? resolvePersonByName(resolvedOwnerLabel, people) : null;
    const sourceIds = canonicalizeSourceIds(sourceIdsRaw || [], sourceSet);
    const sourceProjectId = projectIdForSourceIds(sourceIds, sourceSet);
    const textProjectId = projectIdForText(`${project || ""}\n${cleanTitle}`, projectRows);
    const dueDate = safeDateIso(dueIso);
    tasks.push({
      title: cleanTitle,
      description: String(description || cleanTitle).trim(),
      project_id: sourceProjectId || textProjectId || null,
      assignee_person_id: person?.id ?? null,
      assignee_name: person?.fullName || resolvedOwnerLabel || null,
      assignee_email: person?.email ?? null,
      priority: priority || (dueDate ? "high" : "medium"),
      due_date: dueDate,
      category,
      extraction_metadata: {
        business_date: businessDate,
        category,
        daily_packet_id: packet.id,
        daily_packet_generated_at: packet.generated_at,
        source_ids: sourceIds,
        origin,
        consumer_compiler_version: COMPILER_VERSION,
        owner_label: resolvedOwnerLabel,
        project_assignment_method: sourceProjectId
          ? "source_set_single_project"
          : textProjectId
            ? "project_name_or_number_match"
            : "unassigned",
      },
    });
  };

  // Tasks come ONLY from actionItems — the trackable work. callsToday holds
  // Brandon's open DECISIONS, which are surfaced in the brief's decisions
  // section, not the task list; turning a decision ("Should you…?") into a task
  // produces a non-actionable, question-phrased row. actionItems already split
  // Brandon's own work (ownerIsBrandon) from delegated work.
  for (const project of brief.projects || []) {
    for (const item of project.actionItems || []) {
      if (!item?.text) continue;
      push({
        title: item.text,
        description: item.text,
        ownerLabel: item.owner || null,
        ownerIsBrandon: Boolean(item.ownerIsBrandon),
        project: project.name,
        dueIso: item.dueIso || null,
        sourceIdsRaw: item.sourceIds,
        origin: "action_item",
      });
    }
  }

  return tasks;
}

async function writeTasks(tasks, packet, transactionClient = null) {
  const businessDate =
    packet.packet_json?.businessDate || packet.covered_start_at?.toISOString?.()?.slice(0, 10);
  if (!businessDate) {
    throw new Error("Refusing to write tasks: packet has no business date for the idempotency key.");
  }
  return withAppTransaction(transactionClient, async (client) => {
      // Idempotent per business date: replace this day's deep-read tasks so a
      // re-run updates rather than duplicates. Only touches rows this pipeline
      // owns (source_system 'daily_deep_read').
      const deleted = await client.query(
        `
          delete from public.tasks
          where source_system = 'daily_deep_read'
            and extraction_metadata->>'business_date' = $1
        `,
        [businessDate],
      );
      let inserted = 0;
      for (const task of tasks) {
        await client.query(
          `
            insert into public.tasks (
              title, description, project_id, project_ids,
              assignee_person_id, assignee_name, assignee_email,
              status, priority, due_date,
              source_system, extraction_source, assigned_by, metadata_id, extraction_metadata
            )
            values (
              $1, $2, $3,
              case when $3::bigint is null then null else array[$3::bigint] end,
              $4, $5, $6, 'open', $7, $8,
              'daily_deep_read', 'daily_deep_read', 'Daily Deep Read', null, $9::jsonb
            )
          `,
          [
            task.title,
            task.description,
            task.project_id,
            task.assignee_person_id,
            task.assignee_name,
            task.assignee_email,
            task.priority,
            task.due_date,
            JSON.stringify(task.extraction_metadata),
          ],
        );
        inserted += 1;
      }
    return { deleted: deleted.rowCount, inserted };
  });
}

async function writeCandidates(candidates, packet) {
  return withPg(
    getRagDatabaseUrl(),
    RAG_DATABASE_CONNECTION_OPTIONS,
    async (client) => {
      await client.query("begin");
      try {
        const deleted = await client.query(
          `
            delete from public.source_signal_candidates
            where compiler_version = $1
              and extraction_json->>'daily_packet_id' = $2
          `,
          [COMPILER_VERSION, packet.id],
        );
        let inserted = 0;
        for (const candidate of candidates) {
          await client.query(
            `
              insert into public.source_signal_candidates (
                source_document_id,
                source_chunk_id,
                target_id,
                project_id,
                signal_type,
                title,
                summary,
                why_it_matters,
                current_status,
                confidence_score,
                confidence,
                status,
                suggested_owner_person_id,
                suggested_owner_label,
                next_action,
                stale_after,
                source_occurred_at,
                excerpt,
                normalized_signal_key,
                extraction_json,
                compiler_version
              )
              values (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21
              )
            `,
            [
              candidate.source_document_id,
              candidate.source_chunk_id,
              candidate.target_id,
              candidate.project_id,
              candidate.signal_type,
              candidate.title,
              candidate.summary,
              candidate.why_it_matters,
              candidate.current_status,
              candidate.confidence_score,
              candidate.confidence,
              candidate.status,
              candidate.suggested_owner_person_id,
              candidate.suggested_owner_label,
              candidate.next_action,
              candidate.stale_after,
              candidate.source_occurred_at,
              candidate.excerpt,
              candidate.normalized_signal_key,
              JSON.stringify(candidate.extraction_json),
              candidate.compiler_version,
            ],
          );
          inserted += 1;
        }
        await client.query("commit");
        return { deleted: deleted.rowCount, inserted };
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    },
  );
}

async function readBack(packet) {
  return withPg(
    getRagDatabaseUrl(),
    RAG_DATABASE_CONNECTION_OPTIONS,
    async (client) => {
      const { rows } = await client.query(
        `
          select signal_type, status, count(*)::int as count
          from public.source_signal_candidates
          where compiler_version = $1
            and extraction_json->>'daily_packet_id' = $2
          group by signal_type, status
          order by signal_type, status
        `,
        [COMPILER_VERSION, packet.id],
      );
      return rows;
    },
  );
}

// --- Slice A: project intelligence stems from the packet (ungated) ---------
// Each v3 project block carries a per-project narrative (`context`) synthesized
// from the day's FULL transcripts / emails / Teams. Roll it straight into
// project_current_state.current_summary — the exact field the /[projectId]/intelligence
// page reads — so project intelligence is a CONSUMER of the one packet spine, not a
// parallel synthesizer. No review gate: the packet is the source of truth.
// Corrections happen via downstream feedback (remove/learn), never a pre-approval hold.

function stripPacketCitations(text) {
  return String(text || "")
    .replace(/`S\d+`/g, "") // legacy backtick aliases
    .replace(/\[S\d+\]/g, "") // v3 bracket aliases don't resolve outside the packet
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

// current_summary from the v3 brief's per-project context (owner-grade narrative).
function summariesFromBrief(packet, projectRows) {
  const projects = Array.isArray(packet.packet_json?.brief?.projects)
    ? packet.packet_json.brief.projects
    : [];
  const map = new Map();
  for (const project of projects) {
    const name = String(project?.name || "").trim();
    const context = String(project?.context || "").trim();
    if (!name || !context) continue;
    const projectId = projectIdForText(`${name}\n${context}`, projectRows);
    if (!projectId || map.has(projectId)) continue; // one row per project per run
    const currentSummary = stripPacketCitations(`${name}: ${context}`);
    if (!currentSummary) continue;
    map.set(projectId, { name, currentSummary });
  }
  return map;
}

// The page renders these arrays as objects (record.title || record.summary),
// so each signal is stored as { title } — a plain string renders as nothing.
function toTitleItems(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => stripPacketCitations(item))
    .filter(Boolean)
    .map((title) => ({ title }));
}

function resolveRecordProjectId(record, projectRows) {
  const claimed = Number(record?.projectId);
  if (Number.isInteger(claimed) && claimed > 0 && projectRows.some((p) => p.id === claimed)) {
    return claimed;
  }
  // Fall back to name match if the compiler's id is stale/absent.
  return record?.projectName ? projectIdForText(record.projectName, projectRows) : null;
}

// Candidate B: structured per-project rich fields (health/risks/decisions/etc)
// straight from packet_json.projectRecords — no markdown parsing.
function richFromRecords(packet, projectRows) {
  const list = packet.packet_json?.projectRecords;
  const map = new Map();
  if (!Array.isArray(list)) return map;
  for (const record of list) {
    const projectId = resolveRecordProjectId(record, projectRows);
    if (!projectId || map.has(projectId)) continue;
    map.set(projectId, {
      healthStatus: record.healthStatus,
      activeRisks: toTitleItems(record.activeRisks),
      openDecisions: toTitleItems(record.openDecisions),
      needsAttention: toTitleItems(record.needsAttention),
      whatChanged: record.whatChanged ? toTitleItems([record.whatChanged]) : [],
      financialRead: stripPacketCitations(record.financialRead),
      scheduleRead: stripPacketCitations(record.scheduleRead),
      fieldRead: stripPacketCitations(record.fieldRead),
      confidence:
        typeof record.confidence === "number" ? { overall: record.confidence } : null,
    });
  }
  return map;
}

// Merge: current_summary from the v3 brief's per-project context + rich fields
// from the structured records, keyed by project. Either source alone is valid.
function projectCurrentStateFromPacket(packet, projectRows) {
  const summaries = summariesFromBrief(packet, projectRows);
  const rich = richFromRecords(packet, projectRows);
  const projectIds = new Set([...summaries.keys(), ...rich.keys()]);
  const records = [];
  for (const projectId of projectIds) {
    const summary = summaries.get(projectId) ?? null;
    const r = rich.get(projectId) ?? null;
    records.push({
      project_id: projectId,
      project_name: summary?.name ?? null,
      current_summary: summary?.currentSummary ?? null,
      rich: r,
    });
  }
  return records;
}

function assertProjectIntelligenceCoverage(packet, projectRows, records) {
  const activeProjectIds = new Set(
    (packet.packet_json?.sourceSet?.sources || [])
      .map((source) => Number(source?.projectId))
      .filter((projectId) => Number.isInteger(projectId) && projectId > 0),
  );
  const recordIds = new Set((records || []).map((record) => Number(record.project_id)));
  const missing = [...activeProjectIds].filter((projectId) => !recordIds.has(projectId));
  const unknown = [...activeProjectIds].filter((projectId) => !projectRows.some((project) => project.id === projectId));
  if (missing.length || unknown.length) {
    throw new Error(
      `Daily Deep Read project-intelligence coverage failure: active projects=${activeProjectIds.size}; ` +
        `missing records=${JSON.stringify(missing)}; unknown project rows=${JSON.stringify(unknown)}. ` +
        "Refusing consumer writes until every active project has a current-state record.",
    );
  }
  return { activeProjects: activeProjectIds.size, currentStateRecords: recordIds.size };
}

function projectCurrentStateProjectionEnvelope(record, packet) {
  // The controlled database boundary owns physical writes and freshness
  // precedence. This consumer supplies only fields with fresh Daily Deep Read
  // evidence; it never clears an L2-derived field by sending an empty value.
  const projection = {};
  if (record.current_summary) projection.current_summary = record.current_summary;
  const rich = record.rich;
  if (rich) {
    if (rich.healthStatus && rich.healthStatus !== "unknown") projection.health_status = rich.healthStatus;
    if (rich.activeRisks.length) projection.active_risks = rich.activeRisks;
    if (rich.openDecisions.length) projection.open_decisions = rich.openDecisions;
    if (rich.needsAttention.length) projection.needs_attention = rich.needsAttention;
    if (rich.whatChanged.length) projection.what_changed_since_last_update = rich.whatChanged;
    if (rich.financialRead) projection.financial_read = rich.financialRead;
    if (rich.scheduleRead) projection.schedule_read = rich.scheduleRead;
    if (rich.fieldRead) projection.field_read = rich.fieldRead;
    if (rich.confidence) projection.source_confidence = rich.confidence;
  }
  const toIso = (value) =>
    value && typeof value.toISOString === "function" ? value.toISOString() : value || null;
  const generatedAt = toIso(packet.generated_at);
  if (!packet.id || !generatedAt) {
    throw new Error("Daily Deep Read projection requires packet id and generated_at provenance.");
  }
  return {
    projectId: record.project_id,
    projection,
    writer: "daily_deep_read",
    provenance: {
      source_kind: "daily_deep_read_packet",
      packet_id: packet.id,
      generated_at: generatedAt,
      covered_start_at: toIso(packet.covered_start_at),
      covered_end_at: toIso(packet.covered_end_at),
      compiler_version: COMPILER_VERSION,
    },
  };
}

function assertProjectStateWriteComplete(result, expected) {
  if (result.rejected > 0) {
    throw new Error(
      `Controlled project-current-state projection rejected ${result.rejected}/${expected} projects: ` +
        JSON.stringify(result.rejectionDetails ?? []),
    );
  }
  const accounted = Number(result.updated ?? 0) + Number(result.skipped ?? 0);
  if (accounted !== expected) {
    throw new Error(
      `Controlled project-current-state projection did not account for every project: ` +
        `expected=${expected}, accounted=${accounted}.`,
    );
  }
  return result;
}

async function writeProjectCurrentState(records, packet, transactionClient = null) {
  if (!records.length) return { updated: 0, richUpdated: 0, skipped: 0, rejected: 0 };
  return withAppTransaction(transactionClient, async (client) => {
    let updated = 0;
    let richUpdated = 0;
    let skipped = 0;
    let rejected = 0;
    const rejectionDetails = [];
    for (const rec of records) {
      const envelope = projectCurrentStateProjectionEnvelope(rec, packet);
      if (!Object.keys(envelope.projection).length) {
        throw new Error(
          `Daily Deep Read produced an empty project-current-state projection for project ${rec.project_id}.`,
        );
      }
      const { rows } = await client.query(
        `select public.apply_project_current_state_projection($1::integer, $2::jsonb, $3::text, $4::jsonb) as result`,
        [
          envelope.projectId,
          JSON.stringify(envelope.projection),
          envelope.writer,
          JSON.stringify(envelope.provenance),
        ],
      );
      const result = rows[0]?.result;
      if (!result || typeof result !== "object" || typeof result.outcome !== "string") {
        throw new Error(
          `Controlled project-current-state projection returned an invalid result for project ${rec.project_id}.`,
        );
      }
      if (result.outcome === "applied") {
        updated += 1;
        if (rec.rich) richUpdated += 1;
      } else if (result.outcome === "skipped") {
        skipped += 1;
      } else if (result.outcome === "rejected") {
        rejected += 1;
        rejectionDetails.push({ projectId: rec.project_id, reason: result.reason ?? "unknown" });
      } else {
        throw new Error(
          `Controlled project-current-state projection returned unknown outcome '${result.outcome}' for project ${rec.project_id}.`,
        );
      }
    }
    return assertProjectStateWriteComplete(
      { updated, richUpdated, skipped, rejected, rejectionDetails },
      records.length,
    );
  });
}

async function readBackProjectCurrentState(packet, expectedProjectIds, transactionClient = null) {
  if (!expectedProjectIds.length) return { expected: 0, matched: 0, missingProjectIds: [] };
  const read = async (client) => {
    const { rows } = await client.query(
      `select project_id
         from public.project_current_state
        where project_id = any($1::integer[])
          and projection_writer = 'daily_deep_read'
          and projection_provenance->>'packet_id' = $2`,
      [expectedProjectIds, packet.id],
    );
    const matchedIds = new Set(rows.map((row) => Number(row.project_id)));
    const missingProjectIds = expectedProjectIds.filter((projectId) => !matchedIds.has(projectId));
    if (missingProjectIds.length) {
      throw new Error(
        `Daily Deep Read project-current-state readback failed for packet ${packet.id}: ` +
          `expected=${expectedProjectIds.length}, matched=${matchedIds.size}, missing=${JSON.stringify(missingProjectIds)}.`,
      );
    }
    return { expected: expectedProjectIds.length, matched: matchedIds.size, missingProjectIds: [] };
  };
  if (transactionClient) return read(transactionClient);
  return withPg(getAppDatabaseUrl(), { includeSslMode: false }, read);
}

async function promoteCompletedPacket(packet, consumerReceipt, transactionClient = null) {
  const requestedPacketType = packet.packet_json?.runContract?.requestedPacketType;
  if (!new Set(["current", "snapshot"]).has(requestedPacketType)) {
    throw new Error(
      `Daily Deep Read packet ${packet.id} has invalid requested packet type '${requestedPacketType}'.`,
    );
  }
  const completedAt = new Date().toISOString();
  const runContract = {
    ...packet.packet_json.runContract,
    status: "completed",
    completedAt,
    consumerReceipt,
  };
  return withAppTransaction(transactionClient, async (client) => {
      const lockResult = await client.query(
        `select id, target_id, packet_type, freshness_status, packet_json
           from public.intelligence_packets
          where id = $1::uuid
          for update`,
        [packet.id],
      );
      const staged = lockResult.rows[0];
      if (!staged) throw new Error(`Daily Deep Read staged packet ${packet.id} disappeared before promotion.`);
      if (staged.packet_json?.runContract?.status !== "staged") {
        throw new Error(
          `Daily Deep Read packet ${packet.id} is not staged; status='${staged.packet_json?.runContract?.status}'.`,
        );
      }
      if (requestedPacketType === "current") {
        await client.query(
          `update public.intelligence_packets
              set packet_type = 'snapshot'
            where target_id = $1::uuid
              and packet_type = 'current'
              and id <> $2::uuid`,
          [staged.target_id, packet.id],
        );
      }
      const promoted = await client.query(
        `update public.intelligence_packets
            set packet_type = $2,
                freshness_status = 'fresh',
                packet_json = jsonb_set(packet_json, '{runContract}', $3::jsonb, true)
          where id = $1::uuid
          returning id, target_id, packet_type, freshness_status,
                    packet_json->'runContract' as run_contract`,
        [packet.id, requestedPacketType, JSON.stringify(runContract)],
      );
      const promotedPacket = promoted.rows[0];
      if (
        !promotedPacket ||
        promotedPacket.freshness_status !== "fresh" ||
        promotedPacket.run_contract?.status !== "completed"
      ) {
        throw new Error(`Daily Deep Read packet ${packet.id} promotion readback was incomplete.`);
      }
      if (requestedPacketType === "current") {
        const count = await client.query(
          `select count(*)::int as current_count
             from public.intelligence_packets
            where target_id = $1::uuid and packet_type = 'current'`,
          [staged.target_id],
        );
        if (Number(count.rows[0]?.current_count) !== 1) {
          throw new Error(
            `Daily Deep Read current-packet invariant failed for target ${staged.target_id}: ` +
              `count=${count.rows[0]?.current_count}.`,
          );
        }
      }
    return {
      status: "completed",
      requestedPacketType,
      publishedPacketType: promotedPacket.packet_type,
      freshnessStatus: promotedPacket.freshness_status,
      completedAt,
    };
  });
}

// ── Weekly progress reports (cheap, no LLM) ──────────────────────────────────
// The daily deep read already synthesized every project once. The client-facing
// weekly progress report is just a reshape of that same per-project record — it
// must NOT re-run its own expensive per-project generation. This assembles the
// three report sections straight from the deep-read fields we already computed.

function currentWeekRange(referenceDate = new Date()) {
  // Mirror defaultWeeklyReportRange() in the app: trailing 7 days ending today.
  const end = new Date(referenceDate);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return { weekStart: start.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10) };
}

function bulletize(lines) {
  return lines.map((line) => String(line || "").trim()).filter(Boolean).map((line) => `- ${line}`).join("\n");
}

function titlesOf(items) {
  return (Array.isArray(items) ? items : []).map((item) => item?.title).filter(Boolean);
}

// Map one deep-read project record → the report sections, split by audience.
// Shared/client-visible: highlights (what changed + field/schedule/financial),
// upcoming (needs-attention), open items (decisions the client owes).
// Internal-only ("the dirt"): our active risk assessment — never sent to the client.
function assembleProgressSections(rich) {
  const highlights = [
    ...titlesOf(rich.whatChanged),
    rich.fieldRead ? `**Field:** ${rich.fieldRead}` : null,
    rich.scheduleRead ? `**Schedule:** ${rich.scheduleRead}` : null,
    rich.financialRead ? `**Financial:** ${rich.financialRead}` : null,
  ].filter(Boolean);
  const upcoming = titlesOf(rich.needsAttention);
  const open = titlesOf(rich.openDecisions);
  const internal = titlesOf(rich.activeRisks); // internal-only risk read
  if (!highlights.length && !upcoming.length && !open.length && !internal.length) return null;
  return {
    past_week_highlights: bulletize(highlights),
    upcoming_week_activities: bulletize(upcoming),
    open_items: open.length
      ? bulletize(open)
      : "- No open items requiring client action this week.",
    internal_notes: internal.length ? bulletize(internal) : null,
  };
}

function progressReportsFromPacket(packet, projectRows) {
  const rich = richFromRecords(packet, projectRows);
  const summaries = summariesFromBrief(packet, projectRows);
  const reports = [];
  for (const [projectId, richFields] of rich) {
    const sections = assembleProgressSections(richFields);
    if (!sections) continue;
    const projectName =
      summaries.get(projectId)?.name ??
      projectRows.find((row) => row.id === projectId)?.name ??
      "Project";
    reports.push({ projectId, projectName, ...sections });
  }
  return reports;
}

async function writeProgressReports(reports, packet, transactionClient = null) {
  if (!reports.length) return { created: 0, refreshed: 0, skipped: 0 };
  const { weekStart, weekEnd } = currentWeekRange();
  const sourceSnapshot = JSON.stringify({
    source: "daily_deep_read",
    packetId: packet.id,
    businessDate: packet.packet_json?.businessDate ?? null,
    generatedAt: new Date().toISOString(),
  });
  return withAppTransaction(transactionClient, async (client) => {
    let created = 0;
    let refreshed = 0;
    let skipped = 0;
    for (const report of reports) {
      const { rows } = await client.query(
        `select id, status, updated_by, source_snapshot
           from public.project_progress_reports
          where project_id = $1 and week_start = $2 and week_end = $3
          limit 1`,
        [report.projectId, weekStart, weekEnd],
      );
      const existing = rows[0];
      if (existing) {
        const isSystemOwned =
          existing.updated_by === PROGRESS_REPORT_CRON_USER_ID ||
          existing.source_snapshot?.source === "daily_deep_read";
        // Never overwrite a finalized report or one a human has edited.
        if (existing.status !== "draft" || !isSystemOwned) {
          skipped += 1;
          continue;
        }
        await client.query(
          `update public.project_progress_reports
              set past_week_highlights = $2,
                  upcoming_week_activities = $3,
                  open_items = $4,
                  internal_notes = $5,
                  source_snapshot = $6::jsonb,
                  updated_by = $7,
                  updated_at = now()
            where id = $1`,
          [
            existing.id,
            report.past_week_highlights,
            report.upcoming_week_activities,
            report.open_items,
            report.internal_notes,
            sourceSnapshot,
            PROGRESS_REPORT_CRON_USER_ID,
          ],
        );
        refreshed += 1;
        continue;
      }
      await client.query(
        `insert into public.project_progress_reports
           (project_id, title, report_type, status, week_start, week_end,
            past_week_highlights, upcoming_week_activities, open_items, internal_notes,
            source_snapshot, created_by, updated_by)
         values ($1,$2,'weekly','draft',$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$10)`,
        [
          report.projectId,
          `${report.projectName} Weekly Progress Report`,
          weekStart,
          weekEnd,
          report.past_week_highlights,
          report.upcoming_week_activities,
          report.open_items,
          report.internal_notes,
          sourceSnapshot,
          PROGRESS_REPORT_CRON_USER_ID,
        ],
      );
      created += 1;
    }
    return { created, refreshed, skipped, weekStart, weekEnd };
  });
}

async function main() {
  const packet = await loadDailyDeepReadPacket();
  const projectRows = await loadProjectRows();

  // Fast path: only (re)build the weekly progress reports from the packet.
  if (progressReportsOnly) {
    const reports = progressReportsFromPacket(packet, projectRows);
    const result = shouldWrite
      ? await writeProgressReports(reports, packet)
      : { created: 0, refreshed: 0, skipped: 0 };
    const out = { ok: true, packetId: packet.id, progressReportsOnly: true, shouldWrite, reportsInPacket: reports.length, ...result };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const people = await loadPeople();
  const candidates = candidatesFromPacket(packet, projectRows);
  if (!candidates.length) {
    throw new Error(`No candidates parsed from Daily Deep Read packet ${packet.id}.`);
  }
  assertNoPlaceholderProse(candidates);
  const evidenceDir = path.join(
    process.cwd(),
    "tmp/evidence/2026-07-07-daily-deep-read-consumers",
    packet.packet_json?.businessDate || String(packet.id),
  );
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(
    path.join(evidenceDir, "candidate-preview.json"),
    JSON.stringify({ packetId: packet.id, shouldWrite, candidates }, null, 2),
  );

  // Slice A: project intelligence stems from this same packet (ungated).
  const projectStateRecords = projectCurrentStateFromPacket(packet, projectRows);
  const projectIntelligenceCoverage = assertProjectIntelligenceCoverage(packet, projectRows, projectStateRecords);
  await fs.writeFile(
    path.join(evidenceDir, "project-current-state-preview.json"),
    JSON.stringify({ packetId: packet.id, shouldWrite, records: projectStateRecords }, null, 2),
  );
  // The deep read creates the real tasks — one operating record read by both
  // /tasks and /daily-brief.
  const taskRecords = tasksFromPacket(packet, projectRows, people);
  await fs.writeFile(
    path.join(evidenceDir, "tasks-preview.json"),
    JSON.stringify({ packetId: packet.id, shouldWrite, tasks: taskRecords }, null, 2),
  );
  // Weekly progress reports refresh from this same packet — no extra LLM cost.
  const progressReports = progressReportsFromPacket(packet, projectRows);
  await fs.writeFile(
    path.join(evidenceDir, "progress-reports-preview.json"),
    JSON.stringify({ packetId: packet.id, shouldWrite, reports: progressReports }, null, 2),
  );
  const {
    writeResult,
    readBackRows,
    projectStateResult,
    projectStateReadBack,
    taskWriteResult,
    progressReportResult,
    runContract,
  } = await runProjectionFanout({
    packet,
    candidates,
    projectStateRecords,
    taskRecords,
    progressReports,
    shouldWrite,
    dependencies: {
      writeCandidates,
      readBackCandidates: readBack,
      withTransaction: withAppTransaction,
      writeProjectCurrentState,
      readBackProjectCurrentState,
      writeTasks,
      writeProgressReports,
      promoteCompletedPacket,
    },
  });

  const summary = {
    ok: true,
    packetId: packet.id,
    compilerVersion: COMPILER_VERSION,
    shouldWrite,
    runContract,
    candidateCount: candidates.length,
    writeResult,
    projectIntelligence: {
      ...projectIntelligenceCoverage,
      projectsInPacket: projectStateRecords.length,
      ...projectStateResult,
      readBack: projectStateReadBack,
    },
    tasks: {
      count: taskRecords.length,
      brandon: taskRecords.filter((task) => task.category === "brandon").length,
      team: taskRecords.filter((task) => task.category === "team").length,
      ...taskWriteResult,
    },
    progressReports: {
      reportsInPacket: progressReports.length,
      ...progressReportResult,
    },
    readBack: readBackRows,
    evidenceDir,
  };
  await fs.writeFile(path.join(evidenceDir, "consumer-run-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

// Pure extractors exported for unit testing (no DB). The CLI entry point below
// only runs when this file is executed directly, not when imported.
export {
  candidatesFromPacket,
  projectCurrentStateFromPacket,
  projectCurrentStateProjectionEnvelope,
  assertProjectStateWriteComplete,
  promoteCompletedPacket,
  assertProjectIntelligenceCoverage,
  tasksFromPacket,
  progressReportsFromPacket,
  assembleProgressSections,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
