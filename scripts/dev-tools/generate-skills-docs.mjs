#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs", "alleato-os-docs");
const skillsDocsRoot = path.join(docsRoot, "skills");
const generatedRoot = path.join(skillsDocsRoot, "generated");

const sources = [
  {
    id: "workspace",
    label: "Workspace Skills",
    root: path.join(repoRoot, ".codex", "skills"),
    overviewPage: "skills/workspace-skills",
    overviewFile: path.join(skillsDocsRoot, "workspace-skills.mdx"),
    description:
      "Skills stored in this repository's local .codex/skills directory.",
  },
  {
    id: "agents",
    label: "User Skills",
    root: "/Users/meganharrison/.agents/skills",
    overviewPage: "skills/user-skills",
    overviewFile: path.join(skillsDocsRoot, "user-skills.mdx"),
    description: "User-level skills installed under ~/.agents/skills.",
  },
  {
    id: "codex",
    label: "Global Codex Skills",
    root: "/Users/meganharrison/.codex/skills",
    overviewPage: "skills/global-codex-skills",
    overviewFile: path.join(skillsDocsRoot, "global-codex-skills.mdx"),
    description: "Global Codex skills installed under ~/.codex/skills.",
  },
  {
    id: "plugins",
    label: "Plugin Skills",
    root: "/Users/meganharrison/.codex/plugins/cache",
    overviewPage: "skills/plugin-skills",
    overviewFile: path.join(skillsDocsRoot, "plugin-skills.mdx"),
    description: "Skills shipped through bundled and cached plugins.",
  },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDirContents(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
  }
}

function listSkillFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const results = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(nextPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(nextPath);
      }
    }
  }

  walk(rootDir);
  return results.sort((a, b) => a.localeCompare(b));
}

function parseSkillFile(content) {
  let body = content;
  let frontmatter = {};

  if (content.startsWith("---\n")) {
    const end = content.indexOf("\n---\n", 4);
    if (end !== -1) {
      const rawFrontmatter = content.slice(4, end).trim();
      body = content.slice(end + 5).replace(/^\n+/, "");
      for (const line of rawFrontmatter.split("\n")) {
        const separator = line.indexOf(":");
        if (separator === -1) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        value = value.replace(/^['"]|['"]$/g, "");
        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter, body };
}

function slugifySegment(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildFileSlug(relativePath) {
  const withoutSuffix = relativePath.replace(/\/SKILL\.md$/, "");
  const joined = withoutSuffix
    .split(path.sep)
    .filter(Boolean)
    .map((segment) => slugifySegment(segment) || "root")
    .join("--");
  const hash = crypto
    .createHash("sha1")
    .update(relativePath)
    .digest("hex")
    .slice(0, 8);
  return `${joined}-${hash}`;
}

function summarizeBody(body) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
  return lines[0] || "Skill reference.";
}

function escapeInline(value) {
  return value.replace(/\|/g, "\\|");
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function buildSkillPage(entry) {
  const rawSource = entry.rawContent.replace(/~~~~/g, "~~~~~");

  return `---
title: ${JSON.stringify(entry.name)}
description: ${JSON.stringify(entry.description)}
category: "Skills"
owner: "Engineering"
freshness: "generated"
last_verified: "2026-06-25"
---

# ${entry.name}

This page is generated from the actual \`SKILL.md\` file on disk.

## Metadata

| Field | Value |
| --- | --- |
| Source group | ${entry.sourceLabel} |
| Source root | \`${entry.sourceRoot}\` |
| Relative skill path | \`${entry.relativePath}\` |
| Actual file | \`${entry.absolutePath}\` |
| Description | ${entry.description} |
| Docs overview | [${entry.sourceLabel}](/${entry.overviewPage}) |

## Why this exists

Use this page when you want to review the real instructions behind a skill
without leaving the docs site. The content below is copied from the actual
\`SKILL.md\` file, not rewritten by hand.

## Raw SKILL.md

~~~~md
${rawSource}
~~~~
`;
}

function buildOverviewPage(source, entries) {
  const rows = entries
    .map(
      (entry) =>
        `| [${escapeInline(entry.name)}](/${entry.route}) | ${escapeInline(
          entry.description,
        )} | \`${entry.relativePath}\` |`,
    )
    .join("\n");

  return `---
title: "${source.label}"
description: "${source.description}"
category: "Skills"
owner: "Engineering"
freshness: "generated"
last_verified: "2026-06-25"
---

# ${source.label}

${source.description}

## Source

- Root: \`${source.root}\`
- Skill count: ${entries.length}

## Skills

| Skill | Description | Relative path |
| --- | --- | --- |
${rows}
`;
}

function buildIndexPage(allEntriesBySource) {
  const sourceRows = sources
    .map((source) => {
      const count = allEntriesBySource[source.id]?.length ?? 0;
      return `| [${source.label}](/${source.overviewPage}) | ${count} | \`${source.root}\` |`;
    })
    .join("\n");

  const totalCount = Object.values(allEntriesBySource).reduce(
    (sum, entries) => sum + entries.length,
    0,
  );

  const documentationWriter = allEntriesBySource.agents?.find(
    (entry) =>
      entry.absolutePath ===
      "/Users/meganharrison/.agents/skills/documentation-writer/SKILL.md",
  );

  const documentationWriterLine = documentationWriter
    ? `The actual docs-writing skill you asked for is [documentation-writer](/${documentationWriter.route}).`
    : "The documentation-writer skill was not found in the scanned sources.";

  return `---
title: "Skills"
description: "Generated reference for every installed skill available to this workspace."
category: "Skills"
owner: "Engineering"
freshness: "generated"
last_verified: "2026-06-25"
---

# Skills

This section is generated from the installed \`SKILL.md\` files discovered
across the workspace, user skill directories, global Codex directories, and
plugin caches.

${documentationWriterLine}

## Source groups

| Group | Skill count | Root |
| --- | ---: | --- |
${sourceRows}

## What you can review here

- the exact filesystem path for each skill
- the source group it came from
- the raw \`SKILL.md\` content copied from disk

## Update workflow

Regenerate this section when the installed skill set changes:

\`\`\`bash
npm run docs:generate-skills
npm run docs:verify:skills
\`\`\`

Total skills discovered: **${totalCount}**
`;
}

ensureDir(skillsDocsRoot);
ensureDir(generatedRoot);
removeDirContents(generatedRoot);

const manifest = [];
const bySource = {};

for (const source of sources) {
  const skillFiles = listSkillFiles(source.root);
  const sourceOutputDir = path.join(generatedRoot, source.id);
  ensureDir(sourceOutputDir);

  const entries = skillFiles.map((absolutePath) => {
    const rawContent = fs.readFileSync(absolutePath, "utf8");
    const relativePath = path.relative(source.root, absolutePath);
    const { frontmatter, body } = parseSkillFile(rawContent);
    const slug = buildFileSlug(relativePath);
    const route = `skills/generated/${source.id}/${slug}`;
    const outputFile = path.join(sourceOutputDir, `${slug}.mdx`);
    const name =
      frontmatter.name ||
      path.basename(path.dirname(absolutePath)) ||
      path.basename(slug, ".mdx");
    const description = frontmatter.description || summarizeBody(body);

    const entry = {
      sourceId: source.id,
      sourceLabel: source.label,
      sourceRoot: source.root,
      overviewPage: source.overviewPage,
      name,
      description,
      absolutePath,
      relativePath: relativePath.replace(/\\/g, "/"),
      route,
      outputFile,
      rawContent,
    };

    writeFile(outputFile, buildSkillPage(entry));
    manifest.push({
      sourceId: entry.sourceId,
      sourceLabel: entry.sourceLabel,
      sourceRoot: entry.sourceRoot,
      name: entry.name,
      description: entry.description,
      absolutePath: entry.absolutePath,
      relativePath: entry.relativePath,
      route: entry.route,
      outputFile: path.relative(docsRoot, entry.outputFile).replace(/\\/g, "/"),
    });

    return entry;
  });

  bySource[source.id] = entries;
  writeFile(source.overviewFile, buildOverviewPage(source, entries));
}

writeFile(path.join(skillsDocsRoot, "index.mdx"), buildIndexPage(bySource));
writeFile(
  path.join(generatedRoot, "skills-manifest.json"),
  `${JSON.stringify(
    {
      generatedAt: "2026-06-25",
      totalSkills: manifest.length,
      sources: sources.map((source) => ({
        id: source.id,
        label: source.label,
        root: source.root,
        skillCount: bySource[source.id]?.length ?? 0,
        overviewPage: source.overviewPage,
      })),
      skills: manifest,
    },
    null,
    2,
  )}\n`,
);

console.log(`Generated ${manifest.length} skills docs pages.`);
