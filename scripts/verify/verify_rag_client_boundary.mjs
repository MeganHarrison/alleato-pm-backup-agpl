#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "frontend/src");

const ragTables = [
  "document_attribution_candidates",
  "document_chunks",
  "fireflies_ingestion_jobs",
  "graph_subscriptions",
  "graph_sync_state",
  "ingestion_dead_letter",
  "ingestion_jobs",
  "packet_refresh_jobs",
  "rag_document_metadata",
  "rag_pipeline_state",
  "source_intelligence_jobs",
  "source_signal_candidates",
  "source_sync_health_snapshots",
  "source_sync_runs",
];

const ragRpcs = [
  "search_document_chunks",
  "search_document_chunks_by_category",
];

const findings = [];

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "__tests__" ||
        entry.name === "__mocks__" ||
        entry.name === "node_modules"
      ) {
        return [];
      }
      return listSourceFiles(absolute);
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) return [];
    if (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.tsx")) return [];
    if (entry.name.endsWith(".stories.tsx")) return [];
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

function shouldSkipFile(file) {
  const rel = relative(file);
  return (
    rel.startsWith("frontend/src/types/") ||
    rel === "frontend/src/components/dev-tools/db-inventory.generated.ts"
  );
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function scanQueryLiterals(file, source, kind, values) {
  const valuePattern = values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`\\.${kind}\\(\\s*["'](${valuePattern})["']\\s*\\)`, "g");
  let match;
  while ((match = re.exec(source)) !== null) {
    const usesRagServiceClient = source.includes("createRagServiceClient");
    const usesToolContextRag =
      source.includes("createToolContext") &&
      source.includes("type ToolContext") &&
      source.includes("ctx.rag");

    if (!usesRagServiceClient && !usesToolContextRag) {
      addFinding(
        file,
        source,
        match.index,
        `RAG-owned ${kind}("${match[1]}") must use createRagServiceClient() or ToolContext.rag.`,
      );
    }
  }
}

function scanLegacyFallbacks(file, source) {
  const fallbackRe =
    /isRagDatabase(?:Reads|Writes)Enabled\(\)\s*\?\s*createRagServiceClient\(\)\s*:\s*createServiceClient\(\)/g;
  let match;
  while ((match = fallbackRe.exec(source)) !== null) {
    addFinding(
      file,
      source,
      match.index,
      "RAG database access must not fall back to the main app database.",
    );
  }
}

for (const file of listSourceFiles(sourceRoot)) {
  if (shouldSkipFile(file)) continue;
  const source = stripComments(fs.readFileSync(file, "utf8"));
  scanQueryLiterals(file, source, "from", ragTables);
  scanQueryLiterals(file, source, "rpc", ragRpcs);
  scanLegacyFallbacks(file, source);
}

if (findings.length > 0) {
  console.error("RAG client boundary check failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.message}`);
  }
  process.exit(1);
}

console.log("RAG client boundary check passed.");
