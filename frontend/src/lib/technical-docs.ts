import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

const repoRoot =
  path.basename(process.cwd()) === "frontend"
    ? path.join(process.cwd(), "..")
    : process.cwd();

type TechnicalDocSource = {
  category: string;
  directory?: string;
  files?: string[];
  slugPrefix: string;
  description: string;
};

export type TechnicalDoc = {
  slug: string;
  href: string;
  title: string;
  description: string;
  category: string;
  sourcePath: string;
  filePath: string;
  featured: boolean;
  order: number;
};

const TECHNICAL_DOC_SOURCES: TechnicalDocSource[] = [
  {
    category: "Core References",
    slugPrefix: "reference",
    files: [
      "docs/AGENTIC-TOOL-LAYER.md",
      "docs/FK-TYPES-REFERENCE.md",
      "docs/RUNBOOK.md",
      "docs/ERROR-PREVENTION-SYSTEM.md",
      "docs/MANDATORY-ERROR-PREVENTION.md",
      "docs/PREVENTION-CHECKLIST.md",
      "docs/REALITY-MAP.md",
      "docs/development-guardrails.md",
      "docs/development-guardrails-detailed.md",
      "docs/directory-auth-permissions.md",
      "docs/file-upload-storage-patterns.md",
      "docs/pages-directory.md",
    ],
    description:
      "Root-level engineering references for schema, runtime, security, guardrails, and codebase orientation.",
  },
  {
    category: "AI & Intelligence",
    directory: "docs/architecture",
    slugPrefix: "architecture",
    description: "Agent architecture, RAG, tool inventory, source pipelines, and AI runtime references.",
  },
  {
    category: "AI Plans & Pipelines",
    directory: "docs/ai-plan",
    slugPrefix: "ai-plan",
    description:
      "AI operating plans, RAG pipeline design, evaluation guidance, and assistant implementation notes.",
  },
  {
    category: "Deployment & Operations",
    directory: "docs/deployment",
    slugPrefix: "deployment",
    description: "Runtime deployment, cron, auth migration, and operational runbooks.",
  },
  {
    category: "Engineering Practices",
    directory: "docs/development",
    slugPrefix: "development",
    description: "Developer workflow, route maps, table-page standards, and implementation guardrails.",
  },
  {
    category: "Design System",
    directory: "docs/design",
    slugPrefix: "design",
    description: "UI baseline, tokens, component guidance, and frontend presentation standards.",
  },
  {
    category: "Feature References",
    directory: "docs/features",
    slugPrefix: "features",
    description: "Feature inventories, product system references, automation, memory, and subsystem guides.",
  },
  {
    category: "Project Overview",
    directory: "docs/project-overview",
    slugPrefix: "project-overview",
    description: "Codebase maps, architecture summaries, source tree analysis, and implementation context.",
  },
  {
    category: "Patterns & Guardrails",
    directory: "docs/patterns",
    slugPrefix: "patterns",
    description: "Reusable prevention patterns for recurring implementation and data-contract failures.",
  },
  {
    category: "Reference",
    directory: "docs/reference",
    slugPrefix: "env-reference",
    description: "Environment variables and configuration references.",
  },
  {
    category: "Testing & QA",
    directory: "docs/testing",
    slugPrefix: "testing",
    description: "Testing strategy, scenario matrices, browser verification, and QA implementation references.",
  },
  {
    category: "TypeScript Reliability",
    directory: "docs/typescript-errors",
    slugPrefix: "typescript-errors",
    description: "TypeScript prevention guides, error ledgers, and quality guardrails.",
  },
];

const FEATURED_SOURCE_PATHS = new Map<string, number>([
  ["docs/architecture/AI-TOOLS-INVENTORY.md", 0],
  ["docs/architecture/AI-RAG-ARCHITECTURE.md", 1],
  ["docs/architecture/AI-ASSISTANT-ARCHITECTURE-REFERENCE.md", 2],
  ["docs/architecture/COMMUNICATIONS-DATA-PIPELINE.md", 3],
]);

const EXCLUDED_SEGMENTS = new Set([
  ".archive",
  "evals",
  "generated",
  "node_modules",
  "notebooklm-marketing-accounting-upload",
  "notebooklm-owner-podcast-upload",
  "results",
]);

export async function getTechnicalDocs(): Promise<TechnicalDoc[]> {
  const docs = (
    await Promise.all(TECHNICAL_DOC_SOURCES.map((source) => getDocsForSource(source)))
  ).flat();

  return docs.sort((a, b) => {
    const featuredDelta = Number(b.featured) - Number(a.featured);
    if (featuredDelta !== 0) return featuredDelta;
    const orderDelta = a.order - b.order;
    if (orderDelta !== 0) return orderDelta;
    const categoryDelta = a.category.localeCompare(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.title.localeCompare(b.title);
  });
}

export async function getTechnicalDocBySlug(
  slug: string,
): Promise<(TechnicalDoc & { content: string }) | null> {
  const docs = await getTechnicalDocs();
  const doc = docs.find((candidate) => candidate.slug === slug);
  if (!doc) return null;

  const content = await fs.readFile(doc.filePath, "utf8");
  return {
    ...doc,
    content,
  };
}

export function getTechnicalDocCategories(docs: TechnicalDoc[]) {
  const categoryDescriptions = new Map(
    TECHNICAL_DOC_SOURCES.map((source) => [source.category, source.description]),
  );
  const groups = new Map<string, TechnicalDoc[]>();

  for (const doc of docs) {
    groups.set(doc.category, [...(groups.get(doc.category) ?? []), doc]);
  }

  return Array.from(groups.entries()).map(([name, categoryDocs]) => ({
    name,
    description: categoryDescriptions.get(name) ?? "",
    docs: categoryDocs,
  }));
}

export function filterTechnicalDocs(
  docs: TechnicalDoc[],
  query: string,
): TechnicalDoc[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return docs;

  return docs.filter((doc) => {
    const searchable = [
      doc.title,
      doc.description,
      doc.category,
      doc.sourcePath,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

async function getDocsForSource(source: TechnicalDocSource): Promise<TechnicalDoc[]> {
  const root = source.directory ? path.join(repoRoot, source.directory) : repoRoot;
  const files = source.files
    ? await getExistingSourceFiles(source.files)
    : await getMarkdownFiles(root);

  return Promise.all(
    files.map(async (filePath) => {
      const sourcePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
      const relativeToSource = path
        .relative(root, filePath)
        .replace(/\\/g, "/")
        .replace(/\.mdx?$/i, "");
      const content = await fs.readFile(filePath, "utf8");
      const title = extractTitle(content) ?? formatTitle(path.basename(filePath));
      const description = extractDescription(content) ?? source.description;
      const featuredOrder = FEATURED_SOURCE_PATHS.get(sourcePath);
      const slugPath = source.files
        ? slugifyPath(path.basename(filePath).replace(/\.mdx?$/i, ""))
        : slugifyPath(relativeToSource);

      return {
        slug: `${source.slugPrefix}/${slugPath}`,
        href: `/docs/technical/${source.slugPrefix}/${slugPath}`,
        title,
        description,
        category: source.category,
        sourcePath,
        filePath,
        featured: featuredOrder !== undefined,
        order: featuredOrder ?? 1000,
      };
    }),
  );
}

async function getExistingSourceFiles(sourceFiles: string[]): Promise<string[]> {
  const files = await Promise.all(
    sourceFiles.map(async (sourcePath) => {
      const filePath = path.join(repoRoot, sourcePath);
      try {
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          return filePath;
        }
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "technical_doc_source_missing",
            timestamp: new Date().toISOString(),
            sourcePath,
            filePath,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return null;
      }

      console.warn(
        JSON.stringify({
          event: "technical_doc_source_not_file",
          timestamp: new Date().toISOString(),
          sourcePath,
          filePath,
        }),
      );
      return null;
    }),
  );

  return files.filter((file): file is string => Boolean(file));
}

async function getMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function recurse(dir: string, segments: string[]) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    for (const entry of entries) {
      if (entry.name.startsWith(".") || EXCLUDED_SEGMENTS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const nextSegments = [...segments, entry.name];

      if (entry.isDirectory()) {
        await recurse(fullPath, nextSegments);
        continue;
      }

      if (!/\.mdx?$/i.test(entry.name)) continue;
      if (nextSegments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) continue;
      files.push(fullPath);
    }
  }

  await recurse(root, []);
  return files;
}

function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function extractDescription(content: string): string | null {
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/, "");
  const paragraphs = withoutFrontmatter
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/^#+\s+/gm, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((paragraph) => paragraph && !paragraph.startsWith("|"));
  const first = paragraphs.find((paragraph) => paragraph.length > 40);
  if (!first) return null;
  return first.length > 180 ? `${first.slice(0, 179).trim()}...` : first;
}

function formatTitle(filename: string): string {
  return filename
    .replace(/\.mdx?$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugifyPath(value: string): string {
  return value
    .split("/")
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}
