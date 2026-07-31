#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const guidesDir = resolve(repoRoot, "frontend/src/content/training-guides");
const outputPath = resolve(
  repoRoot,
  "backend/src/services/training/generated_guide_corpus.json",
);
const checkOnly = process.argv.includes("--check");

function parseScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(source, fileName) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${fileName}: expected YAML frontmatter`);
  }

  const metadata = {};
  let activeList = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const listItem = rawLine.match(/^\s+-\s+(.+)$/);
    if (listItem && activeList) {
      metadata[activeList].push(parseScalar(listItem[1]));
      continue;
    }

    const field = rawLine.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!field) {
      throw new Error(`${fileName}: unsupported frontmatter line "${rawLine}"`);
    }
    const [, key, value = ""] = field;
    if (value.trim()) {
      metadata[key] = parseScalar(value);
      activeList = null;
    } else {
      metadata[key] = [];
      activeList = key;
    }
  }

  for (const required of ["slug", "title", "description", "roleIds"]) {
    if (!metadata[required]) {
      throw new Error(`${fileName}: missing ${required} frontmatter`);
    }
  }
  if (!Array.isArray(metadata.roleIds) || metadata.roleIds.length === 0) {
    throw new Error(`${fileName}: roleIds must contain at least one role`);
  }

  const content = match[2].trim();
  if (!content) {
    throw new Error(`${fileName}: guide content is empty`);
  }

  return {
    slug: metadata.slug,
    title: metadata.title,
    description: metadata.description,
    roleIds: metadata.roleIds,
    sourcePath: `frontend/src/content/training-guides/${fileName}`,
    sourceHash: createHash("sha256").update(source).digest("hex"),
    content,
  };
}

async function buildCorpus() {
  const paths = (await readdir(guidesDir))
    .filter((path) => path.endsWith(".mdx"))
    .sort()
    .map((path) => resolve(guidesDir, path));
  if (paths.length === 0) {
    throw new Error(`No training guides found under ${guidesDir}`);
  }

  const guides = await Promise.all(
    paths.map(async (path) =>
      parseFrontmatter(await readFile(path, "utf8"), basename(path)),
    ),
  );
  const slugs = new Set();
  for (const guide of guides) {
    if (slugs.has(guide.slug)) {
      throw new Error(`Duplicate training guide slug: ${guide.slug}`);
    }
    slugs.add(guide.slug);
  }

  return `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedFrom: "frontend/src/content/training-guides/*.mdx",
      guides,
    },
    null,
    2,
  )}\n`;
}

const nextCorpus = await buildCorpus();
if (checkOnly) {
  const currentCorpus = await readFile(outputPath, "utf8").catch(() => "");
  if (currentCorpus !== nextCorpus) {
    throw new Error(
      "Generated training guide corpus is stale. Run npm run training:rag:corpus.",
    );
  }
  console.log("Training guide corpus is current.");
} else {
  await writeFile(outputPath, nextCorpus);
  console.log(`Wrote ${outputPath}`);
}
