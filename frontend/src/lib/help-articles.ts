import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

import { getUnknownHelpActionIds } from "./help-actions";

const repoRoot =
  path.basename(process.cwd()) === "frontend"
    ? path.join(process.cwd(), "..")
    : process.cwd();

export const HELP_ARTICLES_ROOT = path.join(repoRoot, "docs", "help");

export const HELP_ARTICLE_AUDIENCES = [
  "internal",
  "client",
  "subcontractor",
  "admin",
] as const;

export const HELP_ARTICLE_VISIBILITIES = [
  "draft",
  "published",
  "internal",
  "archived",
] as const;

export type HelpArticleAudience = (typeof HELP_ARTICLE_AUDIENCES)[number];
export type HelpArticleVisibility = (typeof HELP_ARTICLE_VISIBILITIES)[number];
export type HelpArticleSection = "project-tools" | "ai-features";

export type HelpArticleFrontmatter = {
  title: string;
  description: string;
  audience: HelpArticleAudience;
  visibility: HelpArticleVisibility;
  module: string;
  category: string;
  tags: string[];
  featured: boolean;
  client_visible: boolean;
  ai_visible: boolean;
  order: number;
  related_routes: string[];
  related_actions: string[];
};

export type HelpArticle = {
  slug: string;
  href: string;
  filePath: string;
  section: HelpArticleSection;
  frontmatter: HelpArticleFrontmatter;
  content: string;
};

export type HelpArticleSearchResult = {
  article: HelpArticle;
  score: number;
  excerpt: string;
};

export type HelpArticleValidationResult = {
  valid: boolean;
  articles: HelpArticle[];
  errors: string[];
};

type RawFrontmatter = Record<string, unknown>;

type SimpleFrontmatter = {
  title: string;
  description: string;
  featured: boolean;
  order: number;
  related_routes: string[];
  related_actions: string[];
};

const HELP_SECTION_DIRECTORIES: Record<HelpArticleSection, string> = {
  "project-tools": path.join(HELP_ARTICLES_ROOT, "project-tools"),
  "ai-features": path.join(HELP_ARTICLES_ROOT, "ai-features"),
};

const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  "ai-and-intelligence": "AI & Intelligence",
  "users-and-permissions": "Users & Permissions",
};

export async function getHelpArticles(options?: {
  audience?: HelpArticleAudience;
  clientVisibleOnly?: boolean;
  clientHelpCenterOnly?: boolean;
  aiVisibleOnly?: boolean;
  defaultAiHelpOnly?: boolean;
  includeDrafts?: boolean;
  category?: string;
  featuredOnly?: boolean;
}): Promise<HelpArticle[]> {
  const result = await validateHelpArticles();
  if (!result.valid) {
    throw new Error(`Help article validation failed:\n${result.errors.join("\n")}`);
  }

  return result.articles
    .filter((article) => {
      const meta = article.frontmatter;
      if (options?.audience && meta.audience !== options.audience) return false;
      if (options?.category && meta.category !== options.category) return false;
      if (options?.featuredOnly && !meta.featured) return false;
      return true;
    })
    .sort((a, b) => {
      const orderDelta = a.frontmatter.order - b.frontmatter.order;
      if (orderDelta !== 0) return orderDelta;
      return a.frontmatter.title.localeCompare(b.frontmatter.title);
    });
}

export async function getHelpArticleBySlug(
  slug: string,
  options?: { includeDrafts?: boolean },
): Promise<HelpArticle | null> {
  const articles = await getHelpArticles({ includeDrafts: options?.includeDrafts });
  return articles.find((article) => article.slug === slug) ?? null;
}

export async function searchHelpArticles(
  query: string,
  options?: {
    aiVisibleOnly?: boolean;
    clientVisibleOnly?: boolean;
    clientHelpCenterOnly?: boolean;
    defaultAiHelpOnly?: boolean;
    category?: string;
    limit?: number;
  },
): Promise<HelpArticleSearchResult[]> {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = normalizedQuery.split(" ").filter((term) => term.length > 1);
  const articles = await getHelpArticles({
    aiVisibleOnly: options?.aiVisibleOnly,
    clientVisibleOnly: options?.clientVisibleOnly,
    clientHelpCenterOnly: options?.clientHelpCenterOnly,
    defaultAiHelpOnly: options?.defaultAiHelpOnly,
    category: options?.category,
  });

  if (queryTerms.length === 0) {
    return articles.slice(0, options?.limit ?? 5).map((article) => ({
      article,
      score: 0,
      excerpt: createHelpArticleExcerpt(article.content, []),
    }));
  }

  return articles
    .map((article) => {
      const score = scoreHelpArticle(article, queryTerms, normalizedQuery);
      return {
        article,
        score,
        excerpt: createHelpArticleExcerpt(article.content, queryTerms),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
      return a.article.frontmatter.order - b.article.frontmatter.order;
    })
    .slice(0, options?.limit ?? 5);
}

export async function validateHelpArticles(): Promise<HelpArticleValidationResult> {
  const errors: string[] = [];
  const articles: HelpArticle[] = [];
  const seenSlugs = new Map<string, string>();

  for (const [section, root] of Object.entries(HELP_SECTION_DIRECTORIES) as Array<
    [HelpArticleSection, string]
  >) {
    const files = await getMarkdownFiles(root);

    for (const filePath of files) {
      const relativePath = path.relative(HELP_ARTICLES_ROOT, filePath).replace(/\\/g, "/");
      const location = parseArticleLocation(relativePath, errors);
      if (!location) continue;

      const raw = await fs.readFile(filePath, "utf8");
      const parsed = parseFrontmatter(raw);
      if (!parsed) {
        errors.push(`${relativePath}: missing required frontmatter block`);
        continue;
      }

      const frontmatter = normalizeFrontmatter(
        parsed.frontmatter,
        relativePath,
        section,
        location.categorySlug,
        location.slug,
        errors,
      );
      if (!frontmatter) continue;

      const duplicatePath = seenSlugs.get(location.slug);
      if (duplicatePath) {
        errors.push(
          `${relativePath}: slug "${location.slug}" already used by ${duplicatePath}. File names under docs/help must be unique.`,
        );
        continue;
      }

      seenSlugs.set(location.slug, relativePath);
      articles.push({
        slug: location.slug,
        href: `/docs/${location.slug}`,
        filePath,
        section,
        frontmatter,
        content: stripNonRenderingMarkers(parsed.content).trim(),
      });
    }
  }

  return {
    valid: errors.length === 0,
    articles,
    errors,
  };
}

async function getMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function recurse(dir: string) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await recurse(fullPath);
      } else if (/\.mdx?$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await recurse(root);
  return files;
}

function parseArticleLocation(relativePath: string, errors: string[]) {
  const segments = relativePath.split("/");
  if (segments.length !== 3) {
    errors.push(
      `${relativePath}: docs must live in docs/help/<section>/<category>/<file>.md`,
    );
    return null;
  }

  const [section, categorySlug, fileName] = segments;
  if (
    section !== "project-tools" &&
    section !== "ai-features"
  ) {
    errors.push(
      `${relativePath}: section must be "project-tools" or "ai-features"`,
    );
    return null;
  }

  const slug = fileName.replace(/\.mdx?$/i, "");
  if (!slug) {
    errors.push(`${relativePath}: article file name must not be empty`);
    return null;
  }

  return {
    section: section as HelpArticleSection,
    categorySlug,
    slug,
  };
}

function stripNonRenderingMarkers(content: string): string {
  return content.replace(/<!--\s*allow-outside-documentation\s*-->\s*/g, "");
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_#[\](){}:;,.!?'"|/\\>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreHelpArticle(
  article: HelpArticle,
  queryTerms: string[],
  normalizedQuery: string,
): number {
  const { frontmatter } = article;
  const title = normalizeSearchText(frontmatter.title);
  const description = normalizeSearchText(frontmatter.description);
  const moduleName = normalizeSearchText(frontmatter.module);
  const category = normalizeSearchText(frontmatter.category);
  const tags = normalizeSearchText(frontmatter.tags.join(" "));
  const routes = normalizeSearchText(frontmatter.related_routes.join(" "));
  const actions = normalizeSearchText(frontmatter.related_actions.join(" "));
  const content = normalizeSearchText(article.content);

  let score = 0;
  if (title.includes(normalizedQuery)) score += 20;
  if (description.includes(normalizedQuery)) score += 12;
  if (category.includes(normalizedQuery)) score += 8;
  if (moduleName.includes(normalizedQuery)) score += 8;
  if (tags.includes(normalizedQuery)) score += 6;
  if (routes.includes(normalizedQuery)) score += 5;
  if (actions.includes(normalizedQuery)) score += 4;
  if (content.includes(normalizedQuery)) score += 3;

  for (const term of queryTerms) {
    if (title.includes(term)) score += 5;
    if (description.includes(term)) score += 3;
    if (moduleName.includes(term)) score += 2;
    if (category.includes(term)) score += 2;
    if (tags.includes(term)) score += 1;
    if (content.includes(term)) score += 1;
  }

  return score;
}

function createHelpArticleExcerpt(content: string, queryTerms: string[]): string {
  const plain = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "";
  if (queryTerms.length === 0) return plain.slice(0, 180);

  const lower = plain.toLowerCase();
  const firstMatch = queryTerms
    .map((term) => lower.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstMatch === undefined) {
    return plain.slice(0, 180);
  }

  const start = Math.max(0, firstMatch - 60);
  const excerpt = plain.slice(start, start + 220).trim();
  return start > 0 ? `...${excerpt}` : excerpt;
}

function parseFrontmatter(raw: string): { frontmatter: RawFrontmatter; content: string } | null {
  if (!raw.startsWith("---\n")) return null;
  const closeIndex = raw.indexOf("\n---", 4);
  if (closeIndex === -1) return null;

  const frontmatterSource = raw.slice(4, closeIndex).trim();
  const content = raw.slice(closeIndex + 4);
  return {
    frontmatter: parseSimpleYaml(frontmatterSource),
    content,
  };
}

function parseSimpleYaml(source: string): RawFrontmatter {
  const result: RawFrontmatter = {};
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const key = match[1];
    const rawValue = match[2] ?? "";

    if (rawValue === "") {
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
        i += 1;
        items.push(unquote(lines[i].replace(/^\s+-\s+/, "").trim()));
      }
      result[key] = items;
      continue;
    }

    result[key] = parseScalar(rawValue.trim());
  }

  return result;
}

function parseScalar(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => unquote(item.trim()));
  }
  return unquote(value);
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function normalizeFrontmatter(
  frontmatter: RawFrontmatter,
  relativePath: string,
  section: HelpArticleSection,
  categorySlug: string,
  slug: string,
  errors: string[],
): HelpArticleFrontmatter | null {
  const simple = normalizeSimpleFrontmatter(frontmatter, relativePath, errors);
  if (!simple) return null;

  const category = formatCategoryLabel(categorySlug);
  const moduleName = slug.replace(/-/g, "_");
  const sectionTag = section === "ai-features" ? "ai-features" : "project-tools";
  const tags = uniqueStrings([
    sectionTag,
    categorySlug,
    ...simple.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  ]);

  const unknownActionIds = getUnknownHelpActionIds(simple.related_actions);
  if (unknownActionIds.length > 0) {
    errors.push(
      `${relativePath}: unknown related_actions value(s): ${unknownActionIds.join(", ")}`,
    );
  }

  return {
    title: simple.title,
    description: simple.description,
    audience: "client",
    visibility: "published",
    module: moduleName,
    category,
    tags,
    featured: simple.featured,
    client_visible: true,
    ai_visible: true,
    order: simple.order,
    related_routes: simple.related_routes,
    related_actions: simple.related_actions,
  };
}

function normalizeSimpleFrontmatter(
  frontmatter: RawFrontmatter,
  relativePath: string,
  errors: string[],
): SimpleFrontmatter | null {
  const title = requireString(frontmatter.title, relativePath, "title", errors);
  const description = requireString(
    frontmatter.description,
    relativePath,
    "description",
    errors,
  );
  const featured = requireOptionalBoolean(
    frontmatter.featured,
    relativePath,
    "featured",
    errors,
    false,
  );
  const order = requireOptionalNumber(
    frontmatter.order,
    relativePath,
    "order",
    errors,
    1000,
  );
  const relatedRoutes = requireOptionalStringArray(
    frontmatter.related_routes,
    relativePath,
    "related_routes",
    errors,
  );
  const relatedActions = requireOptionalStringArray(
    frontmatter.related_actions,
    relativePath,
    "related_actions",
    errors,
  );

  if (
    !title ||
    !description ||
    featured === null ||
    order === null ||
    !relatedRoutes ||
    !relatedActions
  ) {
    return null;
  }

  return {
    title,
    description,
    featured,
    order,
    related_routes: relatedRoutes,
    related_actions: relatedActions,
  };
}

function formatCategoryLabel(categorySlug: string): string {
  const override = CATEGORY_LABEL_OVERRIDES[categorySlug];
  if (override) return override;

  return categorySlug
    .split("-")
    .filter(Boolean)
    .map((segment) => {
      if (segment === "ai") return "AI";
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function requireString(
  value: unknown,
  relativePath: string,
  field: string,
  errors: string[],
): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  errors.push(`${relativePath}: "${field}" must be a non-empty string`);
  return null;
}

function requireOptionalBoolean(
  value: unknown,
  relativePath: string,
  field: string,
  errors: string[],
  fallback: boolean,
): boolean | null {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  errors.push(`${relativePath}: "${field}" must be true or false`);
  return null;
}

function requireOptionalNumber(
  value: unknown,
  relativePath: string,
  field: string,
  errors: string[],
  fallback: number,
): number | null {
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  errors.push(`${relativePath}: "${field}" must be an integer`);
  return null;
}

function requireOptionalStringArray(
  value: unknown,
  relativePath: string,
  field: string,
  errors: string[],
): string[] | null {
  if (value === undefined) return [];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  errors.push(`${relativePath}: "${field}" must be a string array`);
  return null;
}
