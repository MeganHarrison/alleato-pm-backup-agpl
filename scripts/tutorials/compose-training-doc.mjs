#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORBIDDEN_BRAND_PATTERN = /\bprocore\b/gi;
const FORBIDDEN_LINK_PATTERN =
  /https?:\/\/(?:v2\.)?(?:support|docs)\.procore\.com[^\s)>\]]*/gi;
const RAW_URL_PATTERN = /https?:\/\/[^\s)>\]]+/gi;
const DEFAULT_MODEL = process.env.TRAINING_DOC_COMPOSER_MODEL || "gpt-4.1-mini";

function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // Use the existing environment when the file is not present.
  }
}

loadEnv(path.resolve(__dirname, "../../frontend/.env"));
loadEnv(path.resolve(__dirname, "../../frontend/.env.local"));

function parseArgs(argv) {
  const options = {
    audience: "internal",
    docType: "how-to",
    noAi: false,
    outputDir: null,
    query: "",
    title: "",
    topK: 5,
  };

  let manifestPath = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--query") {
      options.query = requireValue(argv, ++index, arg);
    } else if (arg === "--title") {
      options.title = requireValue(argv, ++index, arg);
    } else if (arg === "--output-dir") {
      options.outputDir = requireValue(argv, ++index, arg);
    } else if (arg === "--audience") {
      options.audience = requireValue(argv, ++index, arg);
    } else if (arg === "--doc-type") {
      options.docType = requireValue(argv, ++index, arg);
    } else if (arg === "--top-k") {
      options.topK = Number.parseInt(requireValue(argv, ++index, arg), 10) || 5;
    } else if (arg === "--no-ai") {
      options.noAi = true;
    } else if (!manifestPath) {
      manifestPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!manifestPath) {
    throw new Error("Missing manifest path.");
  }
  if (!options.query.trim()) {
    throw new Error("Missing required --query value.");
  }

  return {
    ...options,
    manifestPath: path.resolve(manifestPath),
  };
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/tutorials/compose-training-doc.mjs <manifest.json> --query "<workflow query>" [options]

Options:
  --title <title>           Override the generated document title
  --output-dir <dir>        Output directory. Default: manifest directory
  --audience <audience>     Draft audience label. Default: internal
  --doc-type <type>         "how-to" or "tutorial". Default: how-to
  --top-k <n>               Support article matches to use. Default: 5
  --no-ai                   Skip model drafting and use the deterministic fallback
`);
}

export function sanitizeSupportText(value) {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(FORBIDDEN_LINK_PATTERN, "")
    .replace(RAW_URL_PATTERN, "")
    .replace(FORBIDDEN_BRAND_PATTERN, "Alleato")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeDraftMarkdown(markdown) {
  return markdown
    .replace(
      /\[([^\]]+)\]\((https?:\/\/(?:v2\.)?(?:support|docs)\.procore\.com[^)]+)\)/gi,
      "$1",
    )
    .replace(FORBIDDEN_LINK_PATTERN, "")
    .replace(FORBIDDEN_BRAND_PATTERN, "Alleato")
    .replace(/\n## Source Materials[\s\S]*$/i, "")
    .replace(/\n## References[\s\S]*$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateNoForbiddenContent(markdown) {
  const forbidden = [];
  if (FORBIDDEN_BRAND_PATTERN.test(markdown)) {
    forbidden.push("brand mention");
  }
  FORBIDDEN_BRAND_PATTERN.lastIndex = 0;
  if (FORBIDDEN_LINK_PATTERN.test(markdown)) {
    forbidden.push("external source link");
  }
  FORBIDDEN_LINK_PATTERN.lastIndex = 0;

  if (forbidden.length) {
    throw new Error(
      `Generated documentation still contains forbidden source content: ${forbidden.join(", ")}.`,
    );
  }
}

function toBulletSentences(text, limit = 3) {
  return sanitizeSupportText(text)
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(
      (item) =>
        item &&
        item.length >= 30 &&
        item.length <= 220 &&
        !/^see\b/i.test(item) &&
        !/^or$/i.test(item),
    )
    .slice(0, limit);
}

function buildSourceBrief(results, articlesById) {
  const lines = [
    "# Source Brief",
    "",
    "Internal drafting notes built from the stored support-article corpus.",
    "Do not publish this file directly.",
    "",
  ];

  for (const result of results) {
    const article = articlesById.get(result.article_id);
    const similarity = `${Math.round(result.similarity * 100)}%`;
    lines.push(`## ${sanitizeSupportText(result.title)}`);
    lines.push("");
    lines.push(`- Match: ${similarity}`);
    if (article?.category || article?.subcategory) {
      const category = [article.category, article.subcategory]
        .filter(Boolean)
        .join(" / ");
      lines.push(`- Category: ${sanitizeSupportText(category)}`);
    }
    if (result.heading) {
      lines.push(`- Section: ${sanitizeSupportText(result.heading)}`);
    }
    lines.push("- Useful notes:");
    for (const sentence of toBulletSentences(result.chunk_text, 3)) {
      lines.push(`  - ${sentence}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function buildFallbackDraft({ manifest, sourceNotes, title, audience, docType }) {
  const cleanTitle = sanitizeSupportText(title || manifest.title);
  const cleanSummary = sanitizeSupportText(manifest.description || "");
  const beforeYouStart = sourceNotes.slice(0, 4);
  const lines = [
    `# ${cleanTitle}`,
    "",
    cleanSummary,
    "",
    "## Before You Start",
    "",
    ...(beforeYouStart.length
      ? beforeYouStart.map((note) => `- ${note}`)
      : ["- Confirm you have access to the correct project and tool."]),
    "",
    "## Steps",
    "",
  ];

  for (const [index, step] of manifest.steps.entries()) {
    lines.push(`### Step ${index + 1}: ${sanitizeSupportText(step.title)}`);
    lines.push("");
    lines.push(sanitizeSupportText(step.instruction));
    lines.push("");
    lines.push(`![${sanitizeSupportText(step.title)}](${step.screenshot})`);
    if (step.expected) {
      lines.push("");
      lines.push(`Expected result: ${sanitizeSupportText(step.expected)}`);
    }
    lines.push("");
  }

  lines.push("## Quality Check");
  lines.push("");
  lines.push(
    docType === "tutorial"
      ? "- Complete the full workflow once without detouring to another tool."
      : "- Confirm the final state in the app matches the expected result for each step.",
  );
  lines.push(
    audience === "client"
      ? "- Remove any internal-only configuration or reviewer notes before publishing."
      : "- Remove any environment-specific or seeded-data references before publishing.",
  );

  return `${sanitizeDraftMarkdown(lines.join("\n").trim())}\n`;
}

async function generateEmbedding(query) {
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
  const base =
    process.env.AI_GATEWAY_API_KEY
      ? "https://ai-gateway.vercel.sh/v1"
      : "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("Missing AI_GATEWAY_API_KEY or OPENAI_API_KEY for support-article retrieval.");
  }

  const response = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      dimensions: 3072,
      input: query.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.data[0].embedding;
}

async function searchSupportArticles(query, topK) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const embedding = await generateEmbedding(query);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/search_support_articles`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: topK,
      match_threshold: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Support article search failed: ${response.status} ${await response.text()}`);
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(
      `No support article matches were found for query "${query}". Rephrase the query with the app tool or workflow name.`,
    );
  }
  return results;
}

async function fetchSupportArticles(articleIds) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const uniqueIds = [...new Set(articleIds)].filter(Boolean);
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (uniqueIds.length === 0) {
    return [];
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/support_articles?id=in.(${uniqueIds.join(",")})&select=id,title,description,markdown_content,category,subcategory`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Support article fetch failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function composeWithModel({ title, audience, docType, manifest, sourceBrief, sourceArticles }) {
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
  const base =
    process.env.AI_GATEWAY_API_KEY
      ? "https://ai-gateway.vercel.sh/v1"
      : "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("Missing AI_GATEWAY_API_KEY or OPENAI_API_KEY for draft generation.");
  }

  const payload = {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Write concise Alleato product documentation in Markdown. Never mention Procore. Never link to external documentation. Remove any source-only instructions, roles, permissions, or UI that do not apply to Alleato. Use the captured workflow steps as the primary truth for the step order. Use the support-article excerpts only to improve setup notes, labels, and quality checks. Return Markdown only.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            audience,
            docType,
            title,
            manifest,
            sourceBrief,
            sourceArticles: sourceArticles.map((article) => ({
              title: sanitizeSupportText(article.title),
              description: sanitizeSupportText(article.description || ""),
              notes: toBulletSentences(article.markdown_content, 6),
            })),
          },
          null,
          2,
        ),
      },
    ],
  };

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Draft generation failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Draft generation returned an empty response.");
  }
  return content;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(options.manifestPath, "utf8"));
  const outputDir =
    options.outputDir ? path.resolve(options.outputDir) : path.dirname(options.manifestPath);
  await mkdir(outputDir, { recursive: true });

  const results = await searchSupportArticles(options.query, options.topK);
  const sourceArticles = await fetchSupportArticles(results.map((item) => item.article_id));
  const articlesById = new Map(sourceArticles.map((article) => [article.id, article]));
  const sourceBrief = buildSourceBrief(results, articlesById);
  const sourceNotes = results.flatMap((item) => toBulletSentences(item.chunk_text, 2));

  const draftTitle = options.title || manifest.title;
  const rawDraft = options.noAi
    ? buildFallbackDraft({
        manifest,
        sourceNotes,
        title: draftTitle,
        audience: options.audience,
        docType: options.docType,
      })
    : await composeWithModel({
        title: draftTitle,
        audience: options.audience,
        docType: options.docType,
        manifest,
        sourceBrief,
        sourceArticles,
      });
  const sanitizedDraft = sanitizeDraftMarkdown(rawDraft);
  validateNoForbiddenContent(sanitizedDraft);

  const sourceBriefPath = path.join(outputDir, "source-brief.md");
  const draftPath = path.join(outputDir, "documentation-draft.md");
  const inputPath = path.join(outputDir, "documentation-input.json");

  await writeFile(sourceBriefPath, sourceBrief, "utf8");
  await writeFile(`${inputPath}`, `${JSON.stringify({ manifest, results }, null, 2)}\n`, "utf8");
  await writeFile(draftPath, `${sanitizedDraft.trim()}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        draftPath,
        inputPath,
        sourceBriefPath,
        sourceMatches: results.length,
        usedAi: !options.noAi,
      },
      null,
      2,
    ),
  );
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
