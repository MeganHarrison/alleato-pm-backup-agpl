#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const checkedPaths = [
  "backend/src/services/pipeline",
  "backend/src/services/ingestion/fireflies_pipeline.py",
  "backend/src/services/integrations/microsoft_graph",
  "backend/src/services/intelligence",
  "backend/src/services/task_extraction.py",
  "backend/src/services/supabase_helpers.py",
  "frontend/src/lib/ai",
  "frontend/src/app/api/tasks",
];

const heavyColumns = ["content", "raw_text", "summary_embedding"];
const findings = [];

function listFiles(target) {
  const absolute = path.join(repoRoot, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === "__pycache__" || entry.name === "node_modules") return [];
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return listFiles(path.relative(repoRoot, child));
    if (/\.(py|ts|tsx)$/.test(entry.name)) return [child];
    return [];
  });
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function addFinding(file, source, index, message) {
  findings.push({
    file: path.relative(repoRoot, file),
    line: lineForOffset(source, index),
    message,
  });
}

for (const file of checkedPaths.flatMap(listFiles)) {
  const source = fs.readFileSync(file, "utf8");
  const chains = source.matchAll(
    /(?:table|from_|from)\(\s*["']document_metadata["']\s*\)[\s\S]{0,400}?\.select\(\s*["'`]([\s\S]*?)["'`]\s*\)/g,
  );
  for (const match of chains) {
    const selectList = match[1];
    if (selectList.trim() === "*") {
      addFinding(file, source, match.index ?? 0, "document_metadata select(\"*\") is forbidden in AI/RAG paths");
      continue;
    }
    const selectedHeavyColumns = heavyColumns.filter((column) =>
      new RegExp(`(^|[^a-zA-Z0-9_])${column}([^a-zA-Z0-9_]|$)`).test(selectList),
    );
    if (selectedHeavyColumns.length > 0) {
      addFinding(
        file,
        source,
        match.index ?? 0,
        `document_metadata select includes heavy column(s): ${selectedHeavyColumns.join(", ")}`,
      );
    }
  }
}

if (findings.length > 0) {
  console.error("RAG document metadata boundary check failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.message}`);
  }
  process.exit(1);
}

console.log("RAG document metadata boundary check passed.");
