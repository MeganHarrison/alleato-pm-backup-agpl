#!/usr/bin/env node

/**
 * Backfill OneDrive/SharePoint document project_id from source_path project numbers.
 *
 * This is bounded and model-free. It handles paths such as:
 *   2025 Jobs/25- 109 Uniqlo (...)/...
 * by matching the normalized project_number to public.projects.project_number.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const requireFromFrontend = createRequire(path.join(repoRoot, "frontend/package.json"));
const { createClient } = requireFromFrontend("@supabase/supabase-js");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), override: false, quiet: true });

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  args.set(arg.slice(2), next && !next.startsWith("--") ? next : "true");
}

const lookbackDays = Number(args.get("days") ?? process.env.ONEDRIVE_PATH_ASSIGN_BACKFILL_DAYS ?? 14);
const limit = Number(args.get("limit") ?? process.env.ONEDRIVE_PATH_ASSIGN_BACKFILL_LIMIT ?? 1_000);
const timeoutMs = Number(args.get("timeout-ms") ?? process.env.ONEDRIVE_PATH_ASSIGN_BACKFILL_TIMEOUT_MS ?? 20_000);
const dryRun = args.get("dry-run") === "true";

if (!Number.isFinite(lookbackDays) || !Number.isFinite(limit) || !Number.isFinite(timeoutMs)) {
  console.error("--days, --limit, and --timeout-ms must be numeric.");
  process.exit(1);
}

function normalizeProjectNumber(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "").trim();
}

function appendTag(existing, tag) {
  const tags = String(existing ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!tags.includes(tag)) tags.push(tag);
  return tags.join(",");
}

const appSupabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const appServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const ragSupabaseUrl = process.env.RAG_SUPABASE_URL;
const ragServiceRoleKey = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY;

if (!appSupabaseUrl || !appServiceRoleKey) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
if (!ragSupabaseUrl || !ragServiceRoleKey) {
  console.error("RAG_SUPABASE_URL and RAG_SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const appClient = createClient(appSupabaseUrl, appServiceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: timeoutFetch },
});
const ragClient = createClient(ragSupabaseUrl, ragServiceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: timeoutFetch },
});

function timeoutFetch(input, init = {}) {
  return fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function mustQuery(label, builder) {
  const { data, error } = await builder;
  if (error) {
    throw new Error(`${label} failed: ${error.message}`);
  }
  return data ?? [];
}

const docs = await mustQuery(
  "document_metadata select",
  appClient
    .from("document_metadata")
    .select("id,title,source_path,tags,source_metadata,created_at")
    .eq("source", "microsoft_graph")
    .eq("category", "document")
    .is("project_id", null)
    .is("deleted_at", null)
    .not("source_path", "is", null)
    .gte("created_at", isoDaysAgo(lookbackDays))
    .order("created_at", { ascending: false })
    .limit(limit),
);

const projects = (await mustQuery(
  "projects select",
  appClient
    .from("projects")
    .select("id,name,project_number")
    .eq("archived", false)
    .not("project_number", "is", null),
))
  .map((project) => ({
    ...project,
    normalized_project_number: normalizeProjectNumber(project.project_number),
  }))
  .filter((project) => project.normalized_project_number.length >= 4);

const assignments = [];
const ambiguous = [];
for (const doc of docs) {
  const normalizedPath = normalizeProjectNumber(doc.source_path);
  const matches = projects
    .filter((project) => normalizedPath.includes(project.normalized_project_number))
    .sort((a, b) => b.normalized_project_number.length - a.normalized_project_number.length);
  if (matches.length === 0) continue;
  if (
    matches.length > 1 &&
    matches[0].normalized_project_number.length === matches[1].normalized_project_number.length &&
    Number(matches[0].id) !== Number(matches[1].id)
  ) {
    ambiguous.push({
      id: doc.id,
      title: doc.title,
      source_path: doc.source_path,
      matches: matches.slice(0, 5).map((project) => ({
        project_id: Number(project.id),
        project_number: project.project_number,
        name: project.name,
      })),
    });
    continue;
  }
  assignments.push({
    document_id: String(doc.id),
    title: doc.title,
    source_path: doc.source_path,
    tags: appendTag(doc.tags, "project_auto_backfill:source_path_project_number_v1"),
    project_id: Number(matches[0].id),
    project_name: matches[0].name,
    project_number: matches[0].project_number,
    source_metadata: {
      ...(typeof doc.source_metadata === "object" && doc.source_metadata ? doc.source_metadata : {}),
      project_assignment_backfill: {
        status: "assigned",
        source: "source_path_project_number",
        project_number: matches[0].project_number,
        assigned_at: new Date().toISOString(),
      },
    },
  });
}

const failures = [];
if (!dryRun) {
  for (const assignment of assignments) {
    const { error: appError } = await appClient
      .from("document_metadata")
      .update({
        project_id: assignment.project_id,
        project: assignment.project_name,
        tags: assignment.tags,
        source_metadata: assignment.source_metadata,
      })
      .eq("id", assignment.document_id)
      .is("project_id", null)
      .is("deleted_at", null);
    if (appError) {
      failures.push({
        document_id: assignment.document_id,
        table: "document_metadata",
        error: appError.message,
      });
      continue;
    }

    const { data: existingJobs, error: jobReadError } = await ragClient
      .from("source_processing_jobs")
      .select("id,status,metadata")
      .eq("source_document_id", assignment.document_id)
      .is("project_id", null)
      .limit(20);
    if (jobReadError) {
      failures.push({
        document_id: assignment.document_id,
        table: "source_processing_jobs",
        error: jobReadError.message,
      });
      continue;
    }

    for (const job of existingJobs ?? []) {
      const { error: jobUpdateError } = await ragClient
        .from("source_processing_jobs")
        .update({
          project_id: assignment.project_id,
          status: job.status === "project_assignment_review" ? "project_assigned" : job.status,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(typeof job.metadata === "object" && job.metadata ? job.metadata : {}),
            project_assignment_backfill: {
              status: "assigned",
              source: "source_path_project_number",
              project_number: assignment.project_number,
              assigned_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", job.id);
      if (jobUpdateError) {
        failures.push({
          document_id: assignment.document_id,
          table: "source_processing_jobs",
          error: jobUpdateError.message,
        });
      }
    }
  }
}

console.log(JSON.stringify({
  status: failures.length > 0 ? "fail" : "pass",
  dryRun,
  lookbackDays,
  docsScanned: docs.length,
  assignments: assignments.length,
  updated: dryRun ? 0 : assignments.length - failures.filter((failure) => failure.table === "document_metadata").length,
  ambiguous: ambiguous.length,
  failures,
  samples: assignments.slice(0, 20).map((assignment) => ({
    document_id: assignment.document_id,
    title: assignment.title,
    project_id: assignment.project_id,
    project_number: assignment.project_number,
    project_name: assignment.project_name,
    source_path: assignment.source_path,
  })),
  ambiguousSamples: ambiguous.slice(0, 10),
}, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
