#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const registryPath = path.join(
  repoRoot,
  "docs/architecture/executive-intelligence-adapter-registry.json",
);

const requiredFields = [
  "id",
  "kind",
  "subject",
  "canonicalSource",
  "authorityClass",
  "writerOwner",
  "writerAnchor",
  "writers",
  "writerMode",
  "ownershipStatus",
  "readAdapter",
  "freshnessOwner",
  "failureDetector",
  "legacyOrParallel",
];

const failures = [];
let registry;

try {
  registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
} catch (error) {
  console.error(
    `Executive Intelligence adapter registry could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

if (registry.version !== 1 || !Array.isArray(registry.entries) || registry.entries.length === 0) {
  failures.push("registry must contain a non-empty version 1 entries array");
}

const ids = new Set();
for (const entry of registry.entries ?? []) {
  for (const field of requiredFields) {
    const value = entry[field];
    if ((typeof value === "string" && value.trim()) || (Array.isArray(value) && value.length > 0)) continue;
    failures.push(`${entry.id ?? "unknown entry"}: missing ${field}`);
  }

  if (ids.has(entry.id)) failures.push(`${entry.id}: duplicate registry id`);
  ids.add(entry.id);

  if (!Array.isArray(entry.writers) || entry.writers.length === 0) {
    failures.push(`${entry.id}: missing writer inventory`);
  } else if (!entry.writers.includes(entry.writerAnchor)) {
    failures.push(`${entry.id}: writerAnchor must be included in writer inventory`);
  }

  if (entry.writerMode === "single_projection_writer" && entry.writers.length !== 1) {
    failures.push(`${entry.id}: duplicate controlled projection writers: ${entry.writers.join(", ")}`);
  }

  if (entry.ownershipStatus === "conflict") {
    failures.push(`${entry.id}: unresolved writer ownership conflict; AAI-1096 must establish one controlled projection writer`);
  }

  for (const field of ["writerAnchor", "readAdapter", "failureDetector"]) {
    const relativePath = entry[field];
    if (typeof relativePath !== "string") continue;
    if (!fs.existsSync(path.join(repoRoot, relativePath))) {
      failures.push(`${entry.id}: ${field} does not exist at ${relativePath}`);
    }
  }
}

const requiredEntryIds = [
  "daily-executive-brief",
  "project-operating-record",
  "source-signal-evidence",
  "financial-ground-truth",
  "official-schedule",
  "executive-brief-delivery",
];
for (const id of requiredEntryIds) {
  if (!ids.has(id)) failures.push(`required executive input is unmapped: ${id}`);
}

const requiredDeferredDomains = new Set([
  "executive-attention-and-conflict",
  "projection-enforcement",
]);
for (const deferred of registry.deferredDomains ?? []) requiredDeferredDomains.delete(deferred.id);
for (const missing of requiredDeferredDomains) {
  failures.push(`required deferred ownership boundary is missing: ${missing}`);
}

if (failures.length > 0) {
  console.error("Executive Intelligence adapter registry verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Executive Intelligence adapter registry verified: ${registry.entries.length} canonical inputs, ${registry.deferredDomains.length} deferred domains.`,
);
