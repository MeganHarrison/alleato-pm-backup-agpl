#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsRoot = path.join(root, "docs", "alleato-os-docs");
const files = [
  "docs.json",
  "project-intelligence/index.mdx",
  "project-intelligence/current-state.mdx",
  "project-intelligence/activation-runbook.mdx",
  "project-intelligence/verification.mdx",
];

const requiredTerms = {
  "project-intelligence/index.mdx": [
    "project_intelligence_synthesis_v1",
    "backend/src/services/intelligence/project_intelligence.py",
    "Do not describe Project Intelligence as activated",
  ],
  "project-intelligence/current-state.mdx": [
    "project_intelligence_synthesis_v1",
    "If a live read-back does not show fresh",
  ],
  "project-intelligence/activation-runbook.mdx": [
    "refresh_project_intelligence",
    "dry_run=true",
    "npm run rag:verify:project-intelligence-live-paths",
  ],
  "project-intelligence/verification.mdx": [
    "npm run rag:verify:source-lifecycle",
    "project_intelligence_updated",
    "Documentation Guardrail",
  ],
};

const failures = [];

for (const relativePath of files) {
  const absolutePath = path.join(docsRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing required docs file: ${relativePath}`);
  }
}

const docsJsonPath = path.join(docsRoot, "docs.json");
if (fs.existsSync(docsJsonPath)) {
  try {
    const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, "utf8"));
    const navText = JSON.stringify(docsJson.navigation ?? []);
    for (const page of files.filter((file) => file.startsWith("project-intelligence/"))) {
      const pageName = page.replace(/\.mdx$/, "");
      if (!navText.includes(pageName)) {
        failures.push(`docs.json navigation does not include ${pageName}`);
      }
    }
  } catch (error) {
    failures.push(`docs.json is not valid JSON: ${error.message}`);
  }
}

for (const [relativePath, terms] of Object.entries(requiredTerms)) {
  const absolutePath = path.join(docsRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, "utf8");
  for (const term of terms) {
    if (!content.includes(term)) {
      failures.push(`${relativePath} is missing required term: ${term}`);
    }
  }
}

if (failures.length > 0) {
  console.error("[FAIL] Project Intelligence docs source-of-truth check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[PASS] Project Intelligence docs source-of-truth check passed.");
