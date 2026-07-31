#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs", "alleato-os-docs");
const manifestPath = path.join(docsRoot, "skills", "generated", "skills-manifest.json");
const docsJsonPath = path.join(docsRoot, "docs.json");

const sources = [
  { id: "workspace", root: path.join(repoRoot, ".codex", "skills") },
  { id: "agents", root: "/Users/meganharrison/.agents/skills" },
  { id: "codex", root: "/Users/meganharrison/.codex/skills" },
  { id: "plugins", root: "/Users/meganharrison/.codex/plugins/cache" },
];

function listSkillFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const results = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(nextPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(nextPath);
      }
    }
  }
  walk(rootDir);
  return results;
}

const failures = [];

if (!fs.existsSync(manifestPath)) {
  failures.push("missing skills manifest");
}

if (!fs.existsSync(docsJsonPath)) {
  failures.push("missing docs.json");
}

let manifest = null;
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    failures.push(`invalid skills manifest JSON: ${error.message}`);
  }
}

if (manifest) {
  const expectedCount = sources.reduce(
    (sum, source) => sum + listSkillFiles(source.root).length,
    0,
  );
  if (manifest.totalSkills !== expectedCount) {
    failures.push(
      `manifest totalSkills ${manifest.totalSkills} does not match filesystem count ${expectedCount}`,
    );
  }

  const requiredPages = [
    "skills/index.mdx",
    "skills/workspace-skills.mdx",
    "skills/user-skills.mdx",
    "skills/global-codex-skills.mdx",
    "skills/plugin-skills.mdx",
  ];

  for (const relativePath of requiredPages) {
    if (!fs.existsSync(path.join(docsRoot, relativePath))) {
      failures.push(`missing required docs page: ${relativePath}`);
    }
  }

  const documentationWriter = manifest.skills.find(
    (skill) =>
      skill.absolutePath ===
      "/Users/meganharrison/.agents/skills/documentation-writer/SKILL.md",
  );

  if (!documentationWriter) {
    failures.push("documentation-writer skill is missing from the manifest");
  } else {
    const outputPath = path.join(docsRoot, documentationWriter.outputFile);
    if (!fs.existsSync(outputPath)) {
      failures.push("documentation-writer docs page file is missing");
    } else {
      const page = fs.readFileSync(outputPath, "utf8");
      if (!page.includes("/Users/meganharrison/.agents/skills/documentation-writer/SKILL.md")) {
        failures.push("documentation-writer docs page is missing the actual filesystem path");
      }
    }
  }
}

if (fs.existsSync(docsJsonPath)) {
  try {
    const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, "utf8"));
    const serialized = JSON.stringify(docsJson);
    const requiredNavEntries = [
      "skills/index",
      "skills/workspace-skills",
      "skills/user-skills",
      "skills/global-codex-skills",
      "skills/plugin-skills",
    ];
    for (const entry of requiredNavEntries) {
      if (!serialized.includes(entry)) {
        failures.push(`docs.json navigation does not include ${entry}`);
      }
    }
    if (!serialized.includes('"group":"Skills"')) {
      failures.push('docs.json navigation does not include the "Skills" group');
    }
  } catch (error) {
    failures.push(`docs.json is not valid JSON: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error("Skills docs verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Skills docs verification passed.");
