#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const frontendRoot = path.join(repoRoot, "frontend");
const liveTypesPath = path.join(frontendRoot, "src", "types", "database.types.ts");
const localTypesPath = path.join(frontendRoot, "src", "types", "database.local.types.ts");
const SYSTEM_RELATIONS = new Set(["_migrations", "_sql", "pg_tables"]);
const DROPPED_RELATIONS = new Set([`project_${"cost"}_codes`]);

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractBlock(content, blockName) {
  const startToken = `${blockName}: {`;
  const start = content.indexOf(startToken);
  if (start === -1) return "";

  let depth = 0;
  let blockStart = -1;
  for (let i = start; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === "{") {
      depth += 1;
      if (blockStart === -1) blockStart = i;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && blockStart !== -1) {
        return content.slice(blockStart + 1, i);
      }
    }
  }

  return "";
}

function extractRelationNames(typesContent, blockName) {
  const block = extractBlock(typesContent, blockName);
  const names = new Set();
  const regex = /^\s{6}([A-Za-z0-9_]+):\s*\{/gm;
  for (const match of block.matchAll(regex)) {
    names.add(match[1]);
  }
  return names;
}

function getRgMatches() {
  const scanRoots = ["frontend/src"];
  if (process.env.SCHEMA_AUDIT_INCLUDE_SCRIPTS === "1") {
    scanRoots.push("scripts");
  }

  const raw = execFileSync(
    "rg",
    [
      "--pcre2",
      "-n",
      "-o",
      String.raw`\.from\((["'])(([A-Za-z0-9_]+))\1\)`,
      ...scanRoots,
      "-g",
      "!frontend/src/types/database.types.ts",
      "-g",
      "!frontend/src/types/database.local.types.ts",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [file, lineNo, match] = line.split(":");
      const relationMatch = match.match(/\.from\((["'])([A-Za-z0-9_]+)\1\)/);
      return {
        file,
        line: Number(lineNo),
        relation: relationMatch?.[2] ?? "",
      };
    })
    .filter((entry) => entry.relation);
}

function shouldIgnoreMatch(entry) {
  if (SYSTEM_RELATIONS.has(entry.relation)) {
    return true;
  }

  const content = readFile(path.join(repoRoot, entry.file));
  const lines = content.split("\n");
  const line = lines[entry.line - 1] ?? "";
  const trimmedLine = line.trim();
  const contextWindow = lines
    .slice(Math.max(0, entry.line - 3), entry.line + 1)
    .join("\n");

  if (
    trimmedLine.startsWith("//") ||
    trimmedLine.startsWith("*") ||
    trimmedLine.startsWith("/*") ||
    contextWindow.includes(".storage.from(") ||
    (contextWindow.includes(".storage") && line.includes(".from(")) ||
    line.includes("match(") ||
    line.includes("new Function(") ||
    line.includes('.from("table")') ||
    entry.file.includes("frontend/src/components/dev-tools/")
  ) {
    return true;
  }

  return false;
}

function collectUnknownRelations(knownRelations) {
  const matches = getRgMatches();
  const unknownByRelation = new Map();

  for (const match of matches) {
    if (shouldIgnoreMatch(match)) continue;
    if (knownRelations.has(match.relation)) continue;
    const existing = unknownByRelation.get(match.relation) ?? [];
    existing.push(`${match.file}:${match.line}`);
    unknownByRelation.set(match.relation, existing);
  }

  return unknownByRelation;
}

function collectLocalOnlyRelations(liveRelations) {
  if (!fs.existsSync(localTypesPath)) return [];

  const localContent = readFile(localTypesPath);
  const localRelations = new Set([
    ...extractRelationNames(localContent, "Tables"),
    ...extractRelationNames(localContent, "Views"),
  ]);

  return [...localRelations].filter((relation) => !liveRelations.has(relation)).sort();
}

function collectDroppedRelationReferences() {
  let raw = "";
  try {
    raw = execFileSync(
      "rg",
      [
        "-n",
        ...DROPPED_RELATIONS,
        "frontend/src",
        "scripts",
        "-g",
        "!*.json",
        "-g",
        "!frontend/src/types/database.types.ts",
        "-g",
        "!frontend/src/types/database.local.types.ts",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes("scripts/database/audit-live-schema-references.mjs"));
}

function main() {
  if (!fs.existsSync(liveTypesPath)) {
    console.error(`Missing live database types at ${liveTypesPath}`);
    process.exit(1);
  }

  const liveContent = readFile(liveTypesPath);
  const liveRelations = new Set([
    ...extractRelationNames(liveContent, "Tables"),
    ...extractRelationNames(liveContent, "Views"),
  ]);

  const unknownRelations = collectUnknownRelations(liveRelations);
  const localOnlyRelations = collectLocalOnlyRelations(liveRelations);
  const droppedRelationReferences = collectDroppedRelationReferences();

  let failed = false;

  if (unknownRelations.size > 0) {
    failed = true;
    console.error("Unknown live schema references found:");
    for (const [relation, locations] of [...unknownRelations.entries()].sort()) {
      console.error(`- ${relation}`);
      for (const location of locations.slice(0, 8)) {
        console.error(`  ${location}`);
      }
      if (locations.length > 8) {
        console.error(`  ... ${locations.length - 8} more`);
      }
    }
  }

  if (localOnlyRelations.length > 0) {
    failed = true;
    console.error("Stale local-only schema relations found in frontend/src/types/database.local.types.ts:");
    for (const relation of localOnlyRelations) {
      console.error(`- ${relation}`);
    }
  }

  if (droppedRelationReferences.length > 0) {
    failed = true;
    console.error("Dropped schema relation references found:");
    for (const location of droppedRelationReferences.slice(0, 12)) {
      console.error(`- ${location}`);
    }
    if (droppedRelationReferences.length > 12) {
      console.error(`- ... ${droppedRelationReferences.length - 12} more`);
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log(`Schema reference audit passed. Checked ${liveRelations.size} live relations.`);
}

main();
