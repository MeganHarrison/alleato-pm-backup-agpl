import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

export const HELP_ARTICLES_DIR = path.join(
  REPO_ROOT,
  "backend/src/services/agents/app_expert/runtime/help/articles",
);

export type HelpArticle = {
  slug: string;
  title: string;
  description: string;
  module: string;
  category: string;
  tags: string[];
  relatedRoutes: string[];
  sourcePath: string;
  body: string;
};

export type HelpSearchResult = {
  slug: string;
  title: string;
  description: string;
  module: string;
  category: string;
  tags: string[];
  relatedRoutes: string[];
  sourcePath: string;
  score: number;
  excerpt: string;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  const inline = value.match(/^\[(.*)\]$/);
  if (inline) {
    return inline[1]
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return [];
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  const lines = raw.slice(3, end).split(/\r?\n/);
  let activeListKey: string | null = null;

  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && activeListKey) {
      const previous = meta[activeListKey] ? `${meta[activeListKey]},` : "";
      meta[activeListKey] = `${previous}${listItem[1].trim()}`;
      continue;
    }

    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!entry) continue;

    activeListKey = null;
    const [, key, value] = entry;
    if (value.trim() === "") {
      activeListKey = key;
      meta[key] = "";
    } else {
      meta[key] = value.trim().replace(/^["']|["']$/g, "");
    }
  }

  return { meta, body: raw.slice(end + 4).trim() };
}

function titleFromBody(body: string, fallback: string): string {
  const heading = body.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || fallback;
}

export async function loadHelpArticles(): Promise<HelpArticle[]> {
  let filenames: string[];
  try {
    filenames = await readdir(HELP_ARTICLES_DIR);
  } catch (error) {
    throw new Error(
      `App help article directory is unavailable at ${HELP_ARTICLES_DIR}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const mdxFiles = filenames.filter((name) => name.endsWith(".mdx")).sort();
  if (mdxFiles.length === 0) {
    throw new Error(`No app help articles found in ${HELP_ARTICLES_DIR}.`);
  }

  const articles = await Promise.all(
    mdxFiles.map(async (filename) => {
      const sourcePath = path.join(HELP_ARTICLES_DIR, filename);
      const raw = await readFile(sourcePath, "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const slug = filename.replace(/\.mdx$/, "");
      return {
        slug,
        title: meta.title || titleFromBody(body, slug),
        description: meta.description || "",
        module: meta.module || "",
        category: meta.category || "",
        tags: parseList(meta.tags),
        relatedRoutes: parseList(meta.related_routes),
        sourcePath: path.relative(REPO_ROOT, sourcePath),
        body,
      } satisfies HelpArticle;
    }),
  );

  return articles.filter((article) => article.body.trim().length > 0);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
    .map((token) => token.replace(/s$/, ""))
    .filter((token) => !STOPWORDS.has(token));
}

function normalizeSearchText(value: string): string {
  return tokenize(value).join(" ");
}

function makeExcerpt(body: string, queryTokens: string[]): string {
  const normalizedParagraphs = body
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const paragraph =
    normalizedParagraphs.find((part) => {
      const lower = part.toLowerCase();
      return queryTokens.some((token) => lower.includes(token));
    }) || normalizedParagraphs[0] || "";

  return paragraph.length > 420 ? `${paragraph.slice(0, 417).trim()}...` : paragraph;
}

export async function searchHelpArticles(
  query: string,
  limit = 5,
): Promise<HelpSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error("search_app_help requires a query with at least 2 characters.");
  }

  const articles = await loadHelpArticles();
  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) {
    throw new Error("search_app_help query must contain searchable letters or numbers.");
  }

  const scored = articles
    .map((article) => {
      const titleTokens = tokenize(article.title);
      const tagTokens = article.tags.flatMap(tokenize);
      const titleText = normalizeSearchText(article.title);
      const moduleText = normalizeSearchText(article.module);
      const routeText = normalizeSearchText(article.relatedRoutes.join(" "));
      const queryText = queryTokens.join(" ");
      const haystackSource = [
        article.title,
        article.description,
        article.module,
        article.category,
        article.tags.join(" "),
        article.relatedRoutes.join(" "),
        article.body,
      ].join(" ");
      const haystack = tokenize(haystackSource);
      const haystackText = haystack.join(" ");

      let score = 0;
      if (titleText.includes(queryText)) score += 24;
      if (moduleText.includes(queryText)) score += 16;
      if (routeText.includes(queryText)) score += 12;
      if (haystackText.includes(queryText)) score += 8;
      if (queryTokens.every((token) => titleTokens.includes(token))) score += 12;

      for (const token of queryTokens) {
        if (titleTokens.includes(token)) score += 8;
        if (tagTokens.includes(token)) score += 5;
        score += Math.min(haystack.filter((candidate) => candidate === token).length, 6);
        score += Math.min(
          haystack.filter((candidate) => candidate.includes(token)).length * 0.25,
          3,
        );
      }

      return {
        ...article,
        score,
        excerpt: makeExcerpt(article.body, queryTokens),
      };
    })
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, Math.min(limit, 10)));

  return scored.map(({ body: _body, ...result }) => result);
}
