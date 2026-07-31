#!/usr/bin/env node
/**
 * Crawl Procore Support Documentation (v2.support.procore.com)
 *
 * Fetches all pages from the sitemap, extracts markdown content,
 * chunks it, generates embeddings, and stores in Supabase.
 *
 * Uses crawl4ai via a Python subprocess for reliable JS-rendered page crawling.
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 *
 * Usage:
 *   node scripts/crawl-procore-support-docs.mjs [options]
 *
 * Options:
 *   --dry-run           Preview without writing to DB
 *   --limit N           Only crawl first N pages
 *   --batch-size N      Embedding batch size (default: 20)
 *   --skip-crawl        Skip crawling, only embed existing articles without embeddings
 *   --skip-embed        Skip embedding, only crawl and store pages
 *   --force             Re-crawl even if content_hash matches
 *   --concurrency N     Parallel crawl workers (default: 3)
 *   --chunk-size N      Target tokens per chunk (default: 600)
 *   --chunk-overlap N   Overlap tokens between chunks (default: 80)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Load .env (same pattern as backfill scripts)
// ---------------------------------------------------------------------------
try {
  const envFile = readFileSync(join(__dirname, "../.env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env not found; rely on existing env vars
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
  console.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_CRAWL = args.includes("--skip-crawl");
const SKIP_EMBED = args.includes("--skip-embed");
const FORCE = args.includes("--force");
// --include-mobile: opt-in to include Android/iOS pages (excluded by default)
const INCLUDE_MOBILE = args.includes("--include-mobile");
const WEB_ONLY = !INCLUDE_MOBILE; // default: always exclude mobile/device pages
const LIMIT = parseInt(args[args.indexOf("--limit") + 1]) || 0;
const BATCH_SIZE = parseInt(args[args.indexOf("--batch-size") + 1]) || 20;
const CONCURRENCY = parseInt(args[args.indexOf("--concurrency") + 1]) || 3;
const CHUNK_SIZE = parseInt(args[args.indexOf("--chunk-size") + 1]) || 600;
const CHUNK_OVERLAP =
  parseInt(args[args.indexOf("--chunk-overlap") + 1]) || 80;

const SITEMAP_URL = "https://v2.support.procore.com/sitemap.xml";
const CACHE_DIR = join(__dirname, "../.cache/procore-docs");
const PYTHON_BIN = join(__dirname, "../.venv-crawl/bin/python3");

// ---------------------------------------------------------------------------
// Supabase REST helper (same pattern as backfill scripts)
// ---------------------------------------------------------------------------
async function supabaseQuery(path, method = "GET", body = null) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer:
      method === "PATCH" || method === "POST"
        ? "return=representation"
        : undefined,
  };
  // Remove undefined headers
  Object.keys(headers).forEach((k) => headers[k] === undefined && delete headers[k]);

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase ${method} ${path}: ${resp.status} ${text}`);
  }
  if (resp.status === 204) return null;
  const text = await resp.text();
  if (!text) return null;
  return JSON.parse(text);
}

// Upsert helper for support_articles
async function upsertArticle(article) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation,resolution=merge-duplicates",
  };
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/support_articles`, {
    method: "POST",
    headers,
    body: JSON.stringify(article),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upsert article: ${resp.status} ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// OpenAI Embeddings (same pattern as backfill scripts)
// ---------------------------------------------------------------------------
async function embedTexts(texts) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      dimensions: 3072,
      input: texts,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI embeddings: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Sitemap parser
// ---------------------------------------------------------------------------
async function fetchSitemapUrls() {
  console.log(`Fetching sitemap: ${SITEMAP_URL}`);
  const resp = await fetch(SITEMAP_URL);
  if (!resp.ok) throw new Error(`Sitemap fetch failed: ${resp.status}`);
  const xml = await resp.text();

  // Extract URLs and lastmod dates from sitemap XML
  const urls = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  const entries = xml.split("<url>");

  for (const entry of entries.slice(1)) {
    const locMatch = /<loc>(.*?)<\/loc>/.exec(entry);
    const lastmodMatch = /<lastmod>(.*?)<\/lastmod>/.exec(entry);
    if (locMatch) {
      urls.push({
        url: locMatch[1].trim(),
        lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
      });
    }
  }

  console.log(`Found ${urls.length} URLs in sitemap`);
  return urls;
}

// ---------------------------------------------------------------------------
// Crawl a single page using crawl4ai via Python subprocess
// ---------------------------------------------------------------------------
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

const JSON_DELIMITER = "---CRAWL4AI_JSON---";

const CRAWL_PYTHON_SCRIPT = `
import sys, json, asyncio, os, warnings
warnings.filterwarnings("ignore")
os.environ["CRAWL4AI_LOG_LEVEL"] = "ERROR"

async def crawl_url(url):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    import logging
    logging.getLogger("crawl4ai").setLevel(logging.ERROR)

    browser_config = BrowserConfig(headless=True, verbose=False)
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_until="networkidle",
        page_timeout=30000,
        excluded_tags=["nav", "footer", "header", "script", "style", "noscript"],
        remove_overlay_elements=True,
        verbose=False,
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)
        if result.success:
            return {
                "success": True,
                "markdown": result.markdown_v2.raw_markdown if hasattr(result, 'markdown_v2') and result.markdown_v2 else result.markdown,
                "title": result.metadata.get("title", "") if result.metadata else "",
                "description": result.metadata.get("description", "") if result.metadata else "",
            }
        else:
            return {"success": False, "error": result.error_message or "Unknown error"}

url = sys.argv[1]
result = asyncio.run(crawl_url(url))
print("${JSON_DELIMITER}")
print(json.dumps(result))
`;

async function crawlPage(url) {
  ensureCacheDir();

  // Check cache first
  const cacheKey = createHash("md5").update(url).digest("hex");
  const cachePath = join(CACHE_DIR, `${cacheKey}.json`);

  if (!FORCE && existsSync(cachePath)) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, "utf-8"));
      if (cached.markdown) {
        return cached;
      }
    } catch {
      // Cache corrupted, re-crawl
    }
  }

  // Write the Python script to a temp file (always overwrite to pick up changes)
  const scriptPath = join(CACHE_DIR, "_crawl_single.py");
  writeFileSync(scriptPath, CRAWL_PYTHON_SCRIPT);

  try {
    const output = execSync(`"${PYTHON_BIN}" "${scriptPath}" "${url}"`, {
      encoding: "utf-8",
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024, // 10MB for large pages
    });

    // Extract JSON after the delimiter (crawl4ai prints logs to stdout)
    const delimIdx = output.indexOf(JSON_DELIMITER);
    const jsonStr = delimIdx >= 0
      ? output.slice(delimIdx + JSON_DELIMITER.length).trim()
      : output.trim();
    const result = JSON.parse(jsonStr);

    if (result.success && result.markdown) {
      // Cache the result
      writeFileSync(cachePath, JSON.stringify(result, null, 2));
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Content processing
// ---------------------------------------------------------------------------
function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function extractCategory(url) {
  // Extract category from URL pattern or breadcrumb
  const slug = url.replace("https://v2.support.procore.com/", "");

  if (slug.startsWith("faq-")) {
    // Try to extract tool/feature name from the slug
    const faqSlug = slug.replace("faq-", "");
    // Common category prefixes
    const categories = [
      "analytics",
      "android",
      "bid",
      "budget",
      "change-order",
      "change-event",
      "commitment",
      "company",
      "correspondence",
      "daily-log",
      "directory",
      "document",
      "drawing",
      "email",
      "erp",
      "form",
      "incident",
      "inspection",
      "invoice",
      "ios",
      "meeting",
      "observation",
      "permission",
      "photo",
      "prime-contract",
      "procurement",
      "procore-pay",
      "project",
      "punch-list",
      "rfi",
      "report",
      "schedule",
      "specification",
      "submittal",
      "task",
      "timecard",
      "transmittal",
      "workforce",
    ];

    for (const cat of categories) {
      if (faqSlug.startsWith(cat)) {
        return {
          category: cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          subcategory: "FAQ",
        };
      }
    }
    return { category: "General", subcategory: "FAQ" };
  }

  return { category: "General", subcategory: null };
}

function cleanMarkdown(markdown) {
  if (!markdown) return "";

  let cleaned = markdown
    // Remove excessive whitespace
    .replace(/\n{4,}/g, "\n\n\n")
    // Remove navigation/menu artifacts common in crawled docs
    .replace(/^(Skip to|Jump to|Table of Contents).*$/gm, "")
    // Remove common footer patterns
    .replace(/---\s*\n.*?(Privacy|Terms|Cookie|©).*$/s, "")
    .trim();

  return cleaned;
}

function countWords(text) {
  return text
    .replace(/[#*`\[\]()]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Chunking — split markdown by headings, then by token target
// ---------------------------------------------------------------------------
function estimateTokens(text) {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

function chunkMarkdown(markdown, targetTokens = CHUNK_SIZE, overlapTokens = CHUNK_OVERLAP) {
  const chunks = [];

  // Split by headings (## or ###)
  const sections = markdown.split(/(?=^#{1,3}\s)/m);
  let currentChunk = "";
  let currentHeading = "";

  for (const section of sections) {
    const headingMatch = section.match(/^(#{1,3})\s+(.+)/);
    const sectionHeading = headingMatch ? headingMatch[2].trim() : currentHeading;

    if (estimateTokens(currentChunk + section) > targetTokens && currentChunk) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        heading: currentHeading,
      });

      // Start new chunk with overlap
      const sentences = currentChunk.split(/(?<=[.!?])\s+/);
      const overlapText = [];
      let overlapLen = 0;
      for (let i = sentences.length - 1; i >= 0 && overlapLen < overlapTokens; i--) {
        overlapText.unshift(sentences[i]);
        overlapLen += estimateTokens(sentences[i]);
      }
      currentChunk = overlapText.join(" ") + "\n\n" + section;
      currentHeading = sectionHeading;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + section;
      if (headingMatch) currentHeading = sectionHeading;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      heading: currentHeading,
    });
  }

  // If we got nothing from heading-based splitting (e.g., no headings),
  // fall back to simple paragraph-based chunking
  if (chunks.length === 0 && markdown.trim()) {
    const paragraphs = markdown.split(/\n\n+/);
    let chunk = "";
    for (const para of paragraphs) {
      if (estimateTokens(chunk + para) > targetTokens && chunk) {
        chunks.push({ text: chunk.trim(), heading: "" });
        chunk = para;
      } else {
        chunk += (chunk ? "\n\n" : "") + para;
      }
    }
    if (chunk.trim()) {
      chunks.push({ text: chunk.trim(), heading: "" });
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------
async function asyncPool(concurrency, items, fn) {
  const results = [];
  const executing = new Set();

  for (const [index, item] of items.entries()) {
    const p = fn(item, index).then((result) => {
      executing.delete(p);
      return result;
    });
    executing.add(p);
    results.push(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(70));
  console.log("Procore Support Documentation Crawler");
  console.log("=".repeat(70));
  console.log(`Sitemap:      ${SITEMAP_URL}`);
  console.log(`Embedding:    text-embedding-3-large (3072 dimensions, halfvec)`);
  console.log(`Chunk size:   ~${CHUNK_SIZE} tokens (overlap: ${CHUNK_OVERLAP})`);
  console.log(`Concurrency:  ${CONCURRENCY}`);
  console.log(`Batch size:   ${BATCH_SIZE} (for embeddings)`);
  if (LIMIT) console.log(`Limit:        ${LIMIT} pages`);
  if (DRY_RUN) console.log(`Mode:         DRY RUN`);
  if (SKIP_CRAWL) console.log(`Mode:         SKIP CRAWL (embed only)`);
  if (SKIP_EMBED) console.log(`Mode:         SKIP EMBED (crawl only)`);
  if (FORCE) console.log(`Mode:         FORCE (ignore cache + content_hash)`);
  if (WEB_ONLY) console.log(`Filter:       Excluding Android/iOS pages (default — use --include-mobile to override)`);
  console.log("=".repeat(70));
  console.log();

  // -------------------------------------------------------------------------
  // Phase 1: Crawl pages
  // -------------------------------------------------------------------------
  if (!SKIP_CRAWL) {
    console.log("Phase 1: Crawling pages from sitemap...");
    console.log("-".repeat(50));

    let sitemapEntries = await fetchSitemapUrls();

    // Filter out homepage (it's a landing page, not documentation)
    sitemapEntries = sitemapEntries.filter(
      (e) => e.url !== "https://v2.support.procore.com/"
    );

    // Exclude FAQ pages (short Q&A articles, not product manual content)
    // Use --include-faq to override
    if (!args.includes("--include-faq")) {
      const beforeFaq = sitemapEntries.length;
      sitemapEntries = sitemapEntries.filter((e) => {
        const path = e.url.replace("https://v2.support.procore.com", "");
        return !path.startsWith("/faq-");
      });
      console.log(`FAQ filter: excluded ${beforeFaq - sitemapEntries.length} FAQ pages (${sitemapEntries.length} remaining)`);
    }

    // Exclude mobile/device-specific pages by default (use --include-mobile to override)
    if (WEB_ONLY) {
      const mobilePatterns = [
        // Product manuals for Android/iOS (e.g. /product-manuals/submittals-android/)
        "-android", "-ios",
        // Generic mobile keywords
        "(android)", "(ios)", "-mobile-device", "-mobile-app",
      ];
      const before = sitemapEntries.length;
      sitemapEntries = sitemapEntries.filter((e) => {
        const lower = e.url.toLowerCase();
        return !mobilePatterns.some((kw) => lower.includes(kw));
      });
      console.log(`Mobile filter: excluded ${before - sitemapEntries.length} Android/iOS pages (${sitemapEntries.length} remaining)`);
    }

    // Allowlist filter: only crawl relevant project/company tool sections
    // Use --all-sections to bypass (e.g. for a full re-crawl)
    if (!args.includes("--all-sections")) {
      const ALLOWED_SECTIONS = [
        // Core project tools
        "daily-log-project",
        "photos-project",
        "punch-list-project",
        "schedule-project",
        "observations-project",
        "meetings-project",
        "emails-project",
        "direct-costs-project",
        "forms-project",
        "tasks-project",
        "incidents-project",
        "inspections-project",
        "coordination-issues-project",
        "correspondence-project",
        "transmittals-project",
        "directory-project",
        "directory-company",
        "reports-project",
        "prime-contracts-project",
        "document-management-project",
        // Already-crawled tools (keep them in the skip-if-existing logic)
        "budget-project",
        "commitments-project",
        "change-events-project",
        "change-orders-project",
        "invoicing-project",
        "drawings-project",
        "specifications-project",
        "submittals-project",
        "rfis-project",
        // Process guides (high value how-to content)
        "process-guides",
        // Core support sections that aren't tool-specific
        "getting-started",
      ];

      const before = sitemapEntries.length;
      sitemapEntries = sitemapEntries.filter((e) => {
        const path = e.url.replace("https://v2.support.procore.com", "");
        // Allow if the path contains any of the allowed section slugs
        return ALLOWED_SECTIONS.some((section) => path.includes(`/${section}/`) || path.includes(`/${section}-`));
      });
      console.log(`Section allowlist: filtered to ${sitemapEntries.length} pages (excluded ${before - sitemapEntries.length} irrelevant sections)`);
      console.log(`  Excluded: procore-pay, resource-planning, admin, ERP integrations, SSO, analytics, timesheets, bidding, etc.`);
    }

    if (LIMIT) sitemapEntries = sitemapEntries.slice(0, LIMIT);

    console.log(`Crawling ${sitemapEntries.length} pages...\n`);

    let crawled = 0;
    let skipped = 0;
    let failed = 0;

    await asyncPool(CONCURRENCY, sitemapEntries, async (entry, idx) => {
      const { url, lastmod } = entry;
      const progress = `[${idx + 1}/${sitemapEntries.length}]`;

      try {
        // Check if we already have this article with same content
        if (!FORCE) {
          const existing = await supabaseQuery(
            `support_articles?url=eq.${encodeURIComponent(url)}&select=id,content_hash,last_crawled_at`
          );
          if (existing && existing.length > 0) {
            // If we have it and it was crawled after the lastmod, skip
            if (lastmod && existing[0].last_crawled_at > lastmod) {
              skipped++;
              return;
            }
          }
        }

        // Crawl the page
        const result = await crawlPage(url);
        if (!result.success || !result.markdown) {
          console.log(`${progress} FAIL: ${url} — ${result.error || "no content"}`);
          failed++;
          return;
        }

        const markdown = cleanMarkdown(result.markdown);
        if (!markdown || countWords(markdown) < 20) {
          console.log(`${progress} SKIP: ${url} — too short (${countWords(markdown)} words)`);
          skipped++;
          return;
        }

        // Skip 404 / error pages
        const titleLower = (result.title || "").toLowerCase();
        if (titleLower.includes("page not found") || titleLower.includes("404")) {
          console.log(`${progress} SKIP: ${url} — 404 page`);
          skipped++;
          return;
        }

        const contentHash = sha256(markdown);
        const { category, subcategory } = extractCategory(url);
        const title = result.title || url.split("/").pop().replace(/^faq-/, "").replace(/-/g, " ");

        // Check if content changed
        if (!FORCE) {
          const existing = await supabaseQuery(
            `support_articles?url=eq.${encodeURIComponent(url)}&select=id,content_hash`
          );
          if (existing && existing.length > 0 && existing[0].content_hash === contentHash) {
            skipped++;
            return;
          }
        }

        if (DRY_RUN) {
          console.log(
            `${progress} WOULD UPSERT: ${title.slice(0, 60)} (${countWords(markdown)} words, cat: ${category})`
          );
          crawled++;
          return;
        }

        // Upsert the article
        const articleData = {
          url,
          title: title.slice(0, 500),
          description: (result.description || "").slice(0, 1000),
          markdown_content: markdown,
          category,
          subcategory,
          content_hash: contentHash,
          word_count: countWords(markdown),
          last_crawled_at: new Date().toISOString(),
          source_updated_at: lastmod || null,
        };

        const [upserted] = await upsertArticle(articleData);

        // Delete old chunks for this article (will re-chunk during embed phase)
        await fetch(
          `${SUPABASE_URL}/rest/v1/support_article_chunks?article_id=eq.${upserted.id}`,
          {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        );

        // Create new chunks
        const chunks = chunkMarkdown(markdown);
        if (chunks.length > 0) {
          const chunkRows = chunks.map((c, i) => ({
            article_id: upserted.id,
            chunk_index: i,
            chunk_text: c.text,
            heading: c.heading || null,
            token_count: estimateTokens(c.text),
          }));

          await fetch(`${SUPABASE_URL}/rest/v1/support_article_chunks`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(chunkRows),
          });
        }

        console.log(
          `${progress} OK: ${title.slice(0, 50)} (${countWords(markdown)} words, ${chunks.length} chunks)`
        );
        crawled++;
      } catch (err) {
        console.log(`${progress} ERROR: ${url} — ${err.message}`);
        failed++;
      }
    });

    console.log();
    console.log(`Crawl complete: ${crawled} crawled, ${skipped} skipped, ${failed} failed`);
    console.log();
  }

  // -------------------------------------------------------------------------
  // Phase 2: Embed chunks that are missing embeddings
  // -------------------------------------------------------------------------
  if (!SKIP_EMBED) {
    console.log("Phase 2: Embedding chunks...");
    console.log("-".repeat(50));

    // Fetch all chunks missing embeddings
    const PAGE_SIZE = 500;
    let allChunks = [];
    let offset = 0;

    while (true) {
      const page = await supabaseQuery(
        `support_article_chunks?embedding=is.null&select=id,chunk_text,heading,article_id&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`
      );
      if (!page || page.length === 0) break;
      allChunks.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (allChunks.length === 0) {
      console.log("All chunks already have embeddings!");
    } else {
      console.log(`Found ${allChunks.length} chunks to embed\n`);

      let embedded = 0;
      let embedFailed = 0;

      for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);

        try {
          const texts = batch.map((c) => {
            // Include heading for better context in the embedding
            const parts = [];
            if (c.heading) parts.push(c.heading);
            parts.push(c.chunk_text);
            return parts.join("\n\n");
          });

          if (DRY_RUN) {
            console.log(
              `[Batch ${batchNum}/${totalBatches}] WOULD EMBED ${batch.length} chunks`
            );
            embedded += batch.length;
            continue;
          }

          const embeddings = await embedTexts(texts);

          // Update each chunk with its embedding
          for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j];
            const embedding = embeddings[j];

            // Use PATCH to update the embedding
            await fetch(
              `${SUPABASE_URL}/rest/v1/support_article_chunks?id=eq.${chunk.id}`,
              {
                method: "PATCH",
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({
                  embedding: JSON.stringify(embedding),
                }),
              }
            );
          }

          embedded += batch.length;
          console.log(
            `[Batch ${batchNum}/${totalBatches}] Embedded ${batch.length} chunks (total: ${embedded}/${allChunks.length})`
          );

          // Small delay to avoid rate limits
          if (i + BATCH_SIZE < allChunks.length) {
            await new Promise((r) => setTimeout(r, 200));
          }
        } catch (err) {
          console.error(
            `[Batch ${batchNum}/${totalBatches}] ERROR: ${err.message}`
          );
          embedFailed += batch.length;
        }
      }

      console.log();
      console.log(
        `Embedding complete: ${embedded} embedded, ${embedFailed} failed`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log();
  console.log("=".repeat(70));

  if (!DRY_RUN) {
    const articleCount = await supabaseQuery(
      "support_articles?select=id&limit=1",
      "HEAD"
    ).catch(() => null);

    // Get counts via a simpler approach
    const articles = await supabaseQuery(
      "support_articles?select=id"
    );
    const chunks = await supabaseQuery(
      "support_article_chunks?select=id&embedding=not.is.null"
    );
    const unembedded = await supabaseQuery(
      "support_article_chunks?select=id&embedding=is.null"
    );

    console.log(`Total articles:          ${articles ? articles.length : "?"}`);
    console.log(`Embedded chunks:         ${chunks ? chunks.length : "?"}`);
    console.log(`Chunks without embedding: ${unembedded ? unembedded.length : "?"}`);
  }

  console.log("=".repeat(70));
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
