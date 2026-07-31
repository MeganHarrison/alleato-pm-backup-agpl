import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  TRAINING_DOC_DEFAULT_COLLECTION,
  TRAINING_DOC_IMAGE_ROOT,
  TRAINING_DOC_INDEX_PATH,
  TRAINING_DOC_NAV_PAGE,
  normalizeTrainingDocSlug,
  type TrainingDocStatus,
} from "./constants";

export interface TrainingDocAssetPublishInput {
  fileName: string;
  caption: string | null;
  altText: string | null;
  assetType?: "screenshot" | "image" | "video";
  mimeType?: string | null;
  stepOrder: number;
  bytes: Uint8Array;
}

export interface TrainingDocStepPublishInput {
  title: string;
  instructionMarkdown: string;
  expectedResult: string | null;
  sourceUrl: string | null;
  stepOrder: number;
  screenshot: {
    fileName: string;
    caption: string | null;
    altText: string | null;
  } | null;
}

export interface TrainingDocPublishInput {
  title: string;
  slug: string;
  summary: string | null;
  audience: "internal" | "client" | "subcontractor" | "admin";
  status: TrainingDocStatus;
  sourceRoute: string | null;
  reviewNotes: string | null;
  bodyMarkdown: string;
  targetCollection?: string | null;
  assets: TrainingDocAssetPublishInput[];
  steps?: TrainingDocStepPublishInput[];
}

export interface PublishedTrainingDoc {
  title: string;
  slug: string;
  summary: string | null;
  audience: string;
  status: string;
  sourceRoute: string | null;
  publishedDocPath: string;
  lastPublishedAt: string | null;
  appToolCategory: string | null;
}

const DOCS_JSON_RELATIVE_PATH = "docs.json";
const TRAINING_DOCS_INDEX_TITLE = "Training Docs";

function assertSafeRelativePath(value: string, label: string): string {
  const normalized = value.trim().replaceAll("\\", "/");
  if (
    !normalized ||
    path.isAbsolute(normalized) ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new Error(`${label} must be a relative path inside the docs site.`);
  }

  return normalized.replace(/^\/+/, "").replace(/\/+$/g, "");
}

export function resolveDocsSiteRoot(): string {
  const repoRoot =
    path.basename(process.cwd()) === "frontend"
      ? path.resolve(process.cwd(), "..")
      : process.cwd();

  const candidates = [
    path.join(repoRoot, "docs", "alleato-os-docs"),
    path.join(
      os.homedir(),
      "Documents",
      "alleato-pm",
      "docs",
      "alleato-os-docs",
    ),
    path.join(
      os.homedir(),
      "Documents",
      "github",
      "alleato-os",
      "apps",
      "docs",
    ),
  ];

  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    const docsJsonPath = path.join(normalized, DOCS_JSON_RELATIVE_PATH);
    if (existsSync(docsJsonPath)) {
      return normalized;
    }
  }

  throw new Error(
    "Unable to resolve the Alleato OS docs root with docs.json present.",
  );
}

export function renderTrainingDocMdx(input: TrainingDocPublishInput): string {
  const slug = normalizeTrainingDocSlug(input.slug, input.title);
  const pageTitle = input.title.trim();
  const description =
    (input.summary ?? "").trim() || "Training documentation article.";
  const relatedRoutes = input.sourceRoute?.trim()
    ? `related_routes:\n  - ${input.sourceRoute.trim()}\n`
    : "related_routes: []\n";

  const sortedSteps = (input.steps ?? [])
    .slice()
    .sort((left, right) => left.stepOrder - right.stepOrder);
  const videoAssets = input.assets.filter((asset) => asset.assetType === "video");
  const imageAssets = input.assets.filter((asset) => asset.assetType !== "video");
  const videoSection = videoAssets.length
    ? [
        "## Walkthrough Video",
        "",
        ...videoAssets.flatMap((asset) => {
          const videoPath = `/${TRAINING_DOC_IMAGE_ROOT}/${slug}/${asset.fileName}`;
          const lines = [
            `<video controls playsinline preload="metadata" src="${videoPath}"></video>`,
          ];
          if (asset.caption?.trim()) {
            lines.push("", `_${asset.caption.trim()}_`);
          }
          lines.push("");
          return lines;
        }),
      ].join("\n")
    : "";
  const stepSection = sortedSteps.length
    ? [
        "## Steps",
        "",
        ...sortedSteps.flatMap((step, index) => {
          const lines = [
            `### Step ${index + 1}: ${step.title.trim()}`,
            "",
            step.instructionMarkdown.trim(),
          ];

          if (step.screenshot) {
            const imagePath = `/${TRAINING_DOC_IMAGE_ROOT}/${slug}/${step.screenshot.fileName}`;
            const altText =
              step.screenshot.altText?.trim() ||
              step.screenshot.caption?.trim() ||
              step.title.trim();
            lines.push("", `![${altText}](${imagePath})`);
            if (step.screenshot.caption?.trim()) {
              lines.push("", `_${step.screenshot.caption.trim()}_`);
            }
          }

          if (step.expectedResult?.trim()) {
            lines.push("", `Expected result: ${step.expectedResult.trim()}`);
          }

          if (step.sourceUrl?.trim()) {
            lines.push("", `Source screen: \`${step.sourceUrl.trim()}\``);
          }

          lines.push("");
          return lines;
        }),
      ].join("\n")
    : "";

  const assetSection =
    !stepSection && imageAssets.length
      ? [
          "## Screenshots",
          "",
          ...imageAssets
            .sort((left, right) => left.stepOrder - right.stepOrder)
            .flatMap((asset) => {
              const imagePath = `/${TRAINING_DOC_IMAGE_ROOT}/${slug}/${asset.fileName}`;
              const altText =
                asset.altText?.trim() || asset.caption?.trim() || pageTitle;
              const lines = [`![${altText}](${imagePath})`];
              if (asset.caption?.trim()) {
                lines.push("", `_${asset.caption.trim()}_`);
              }
              lines.push("");
              return lines;
            }),
        ].join("\n")
      : "";

  const notesSection = input.reviewNotes?.trim()
    ? `\n## Review Notes\n\n${input.reviewNotes.trim()}\n`
    : "";

  const body = stepSection
    ? stripLegacyStepsSection(input.bodyMarkdown).trim()
    : input.bodyMarkdown.trim();

  return [
    "---",
    `title: ${pageTitle}`,
    `description: ${description}`,
    `audience: ${input.audience}`,
    "visibility: published",
    "module: training-docs",
    "category: Training Docs",
    `tags: [training, sop, ${slug}]`,
    "featured: false",
    `client_visible: ${String(input.audience === "client")}`,
    "ai_visible: true",
    "order: 900",
    relatedRoutes.trimEnd(),
    "related_actions: []",
    "---",
    "",
    `# ${pageTitle}`,
    "",
    description,
    "",
    body,
    videoSection ? `\n${videoSection}` : "",
    stepSection ? `\n${stepSection}` : "",
    assetSection ? `\n${assetSection}` : "",
    notesSection,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderTrainingDocsIndex(docs: PublishedTrainingDoc[]): string {
  const entries = docs
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((doc) => {
      const pagePath = doc.publishedDocPath.replace(/\.mdx$/i, "");
      const summary =
        doc.summary?.trim() ||
        "Training doc published from the Alleato review workflow.";
      const meta = [
        doc.sourceRoute ? `Route: \`${doc.sourceRoute}\`` : null,
        doc.lastPublishedAt ? `Published: ${doc.lastPublishedAt}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      return [
        `## [${doc.title}](/${pagePath})`,
        "",
        summary,
        meta ? `\n${meta}\n` : "",
      ].join("\n");
    })
    .join("\n");

  return [
    "---",
    `title: ${TRAINING_DOCS_INDEX_TITLE}`,
    "description: Reviewed Alleato SOPs and workflow guides published from the internal training docs workflow.",
    "audience: internal",
    "visibility: published",
    "module: training-docs",
    "category: Training Docs",
    "tags: [training, sop, review]",
    "featured: false",
    "client_visible: false",
    "ai_visible: true",
    "order: 890",
    "related_routes: []",
    "related_actions: []",
    "---",
    "",
    `# ${TRAINING_DOCS_INDEX_TITLE}`,
    "",
    "This section contains reviewed SOPs published from Alleato's internal training docs workflow.",
    "",
    entries || "No published training docs yet.",
    "",
  ].join("\n");
}

function stripLegacyStepsSection(markdown: string): string {
  return markdown.replace(/\n?## Steps\n[\s\S]*?(?=\n##\s|$)/, "\n").trim();
}

export async function ensureTrainingDocsNav(docsRoot: string): Promise<void> {
  const docsJsonPath = path.join(docsRoot, DOCS_JSON_RELATIVE_PATH);
  const docsJsonRaw = await readFile(docsJsonPath, "utf8");
  const docsJson = JSON.parse(docsJsonRaw) as {
    navigation?: {
      tabs?: Array<{
        tab?: string;
        groups?: Array<{ group?: string; pages?: unknown[] }>;
      }>;
    };
  };

  const productTab = docsJson.navigation?.tabs?.find(
    (tab) => tab.tab === "Product",
  );
  const productGroup = productTab?.groups?.find(
    (group) => group.group === "Product",
  );
  const helpArticlesGroup = productGroup?.pages?.find(
    (page): page is { group: string; pages: unknown[] } =>
      typeof page === "object" &&
      page !== null &&
      "group" in page &&
      "pages" in page &&
      (page as { group?: string }).group === "Help Articles",
  );

  if (!helpArticlesGroup) {
    throw new Error("docs.json Product > Help Articles group not found.");
  }

  const existingTrainingGroup = helpArticlesGroup.pages.find(
    (page): page is { group: string; pages: string[] } =>
      typeof page === "object" &&
      page !== null &&
      "group" in page &&
      (page as { group?: string }).group === "Training Docs",
  );

  if (existingTrainingGroup) {
    if (!existingTrainingGroup.pages.includes(TRAINING_DOC_NAV_PAGE)) {
      existingTrainingGroup.pages.unshift(TRAINING_DOC_NAV_PAGE);
    }
  } else {
    helpArticlesGroup.pages.push({
      group: "Training Docs",
      expanded: false,
      pages: [TRAINING_DOC_NAV_PAGE],
    });
  }

  await writeFile(
    docsJsonPath,
    `${JSON.stringify(docsJson, null, 2)}\n`,
    "utf8",
  );
}

export async function publishTrainingDocToDocsSite(
  docsRoot: string,
  input: TrainingDocPublishInput,
  publishedDocs: PublishedTrainingDoc[],
): Promise<{
  publishedDocPath: string;
  assetPaths: string[];
  indexPath: string;
}> {
  const slug = normalizeTrainingDocSlug(input.slug, input.title);
  if (!slug) {
    throw new Error("Training doc slug is required before publishing.");
  }

  const targetCollection = assertSafeRelativePath(
    input.targetCollection?.trim() || TRAINING_DOC_DEFAULT_COLLECTION,
    "Training doc target collection",
  );
  const pageRelativePath = `${targetCollection}/${slug}.mdx`;
  const pageAbsolutePath = path.join(docsRoot, pageRelativePath);
  const assetDirRelativePath = `${TRAINING_DOC_IMAGE_ROOT}/${slug}`;
  const assetDirAbsolutePath = path.join(docsRoot, assetDirRelativePath);
  const indexAbsolutePath = path.join(docsRoot, TRAINING_DOC_INDEX_PATH);

  await mkdir(path.dirname(pageAbsolutePath), { recursive: true });
  await mkdir(assetDirAbsolutePath, { recursive: true });

  const existingFiles = new Set<string>();
  try {
    const priorAssets = await readFile(
      path.join(assetDirAbsolutePath, ".asset-manifest"),
      "utf8",
    );
    for (const line of priorAssets
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)) {
      existingFiles.add(line);
    }
  } catch (error) {
    if (!isNodeErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  const nextFiles = new Set<string>();
  const assetPaths: string[] = [];
  for (const asset of input.assets) {
    const safeFileName = assertSafeRelativePath(
      asset.fileName,
      "Training doc asset file name",
    );
    const assetAbsolutePath = path.join(assetDirAbsolutePath, safeFileName);
    await writeFile(assetAbsolutePath, asset.bytes);
    nextFiles.add(safeFileName);
    assetPaths.push(path.join(assetDirRelativePath, safeFileName));
  }

  for (const staleFile of existingFiles) {
    if (!nextFiles.has(staleFile)) {
      await rm(path.join(assetDirAbsolutePath, staleFile), { force: true });
    }
  }

  await writeFile(
    path.join(assetDirAbsolutePath, ".asset-manifest"),
    `${Array.from(nextFiles).sort().join("\n")}\n`,
    "utf8",
  );

  await writeFile(pageAbsolutePath, `${renderTrainingDocMdx(input)}\n`, "utf8");
  await writeFile(
    indexAbsolutePath,
    `${renderTrainingDocsIndex(publishedDocs)}\n`,
    "utf8",
  );
  await ensureTrainingDocsNav(docsRoot);

  return {
    publishedDocPath: pageRelativePath,
    assetPaths,
    indexPath: TRAINING_DOC_INDEX_PATH,
  };
}

function isNodeErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
