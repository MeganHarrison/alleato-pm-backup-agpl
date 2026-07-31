#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "backend/src");

const ragTables = [
  "graph_subscriptions",
  "graph_sync_state",
  "outlook_email_intake",
  "outlook_email_intake_attachments",
  "outlook_email_skip_audit",
  "pipeline_model_usage",
  "project_daily_deltas",
  "source_processing_jobs",
  "source_syntheses",
  "source_sync_health_snapshots",
  "source_sync_runs",
  "system_alerts",
];

const findings = [];

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__" || entry.name === "node_modules") return [];
      return listSourceFiles(absolute);
    }
    if (!entry.name.endsWith(".py")) return [];
    if (entry.name.endsWith("_test.py") || entry.name.startsWith("test_")) return [];
    return [absolute];
  });
}

function relative(file) {
  return path.relative(repoRoot, file);
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function addFinding(file, source, index, message) {
  findings.push({
    file: relative(file),
    line: lineForOffset(source, index),
    message,
  });
}

function stripComments(source) {
  return source.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''|#.*$/gm, "");
}

function scanQueryLiterals(file, source, values) {
  const valuePattern = values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`\\.(?:table|from_)\\(\\s*["'](${valuePattern})["']\\s*\\)`, "g");
  let match;
  while ((match = re.exec(source)) !== null) {
    const hasRagClientResolver =
      source.includes("get_rag_write_client") ||
      source.includes("get_rag_read_client") ||
      source.includes("get_outlook_intake_write_client") ||
      source.includes("get_outlook_intake_read_client") ||
      source.includes("get_rag_supabase_client") ||
      source.includes("RAG_DATABASE_URL") ||
      source.includes("RAG_SUPABASE_URL");
    if (!hasRagClientResolver) {
      addFinding(
        file,
        source,
        match.index,
        `RAG-owned table "${match[1]}" must use an AI DB resolver, not an implicit PM APP client.`,
      );
    }
  }
}

for (const file of listSourceFiles(sourceRoot)) {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  scanQueryLiterals(file, source, ragTables);
}

if (findings.length > 0) {
  console.error("Backend RAG table boundary check failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.message}`);
  }
  process.exit(1);
}

console.log("Backend RAG table boundary check passed.");
