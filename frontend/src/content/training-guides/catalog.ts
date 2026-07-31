import { readFile } from "node:fs/promises";
import path from "node:path";

import type { TrainingGuide } from "@/features/training/types";

import { parseGuideFrontmatter } from "./frontmatter";

const frontendRoot =
  path.basename(process.cwd()) === "frontend"
    ? process.cwd()
    : path.join(process.cwd(), "frontend");

const guideSourceLoaders = {
  "pm-handbook": () =>
    readFile(
      path.join(
        frontendRoot,
        "src/content/training-guides/pm-handbook.mdx",
      ),
      "utf8",
    ),
  "superintendent-handbook": () =>
    readFile(
      path.join(
        frontendRoot,
        "src/content/training-guides/superintendent-handbook.mdx",
      ),
      "utf8",
    ),
  "alleato-pm-software-guide": () =>
    readFile(
      path.join(
        frontendRoot,
        "src/content/training-guides/alleato-pm-software-guide.mdx",
      ),
      "utf8",
    ),
  "manager-coaching-guide": () =>
    readFile(
      path.join(
        frontendRoot,
        "src/content/training-guides/manager-coaching-guide.mdx",
      ),
      "utf8",
    ),
} satisfies Record<string, () => Promise<string>>;

export const TRAINING_GUIDE_SLUGS = Object.freeze(
  Object.keys(guideSourceLoaders) as Array<keyof typeof guideSourceLoaders>,
);

export type TrainingGuideSlug = (typeof TRAINING_GUIDE_SLUGS)[number];

export interface TrainingGuideDocument extends TrainingGuide {
  body: string;
}

function isTrainingGuideSlug(slug: string): slug is TrainingGuideSlug {
  return Object.hasOwn(guideSourceLoaders, slug);
}

function removeRenderedDocumentTitle(body: string): string {
  return body.replace(/^\s*#\s+[^\r\n]+\r?\n+/, "").trim();
}

async function loadTrainingGuide(
  slug: TrainingGuideSlug,
): Promise<TrainingGuideDocument> {
  let source: string;
  try {
    source = await guideSourceLoaders[slug]();
  } catch (error) {
    throw new Error(`Training guide '${slug}' could not be loaded.`, {
      cause: error,
    });
  }

  let parsed: ReturnType<typeof parseGuideFrontmatter>;
  try {
    parsed = parseGuideFrontmatter(source);
  } catch (error) {
    throw new Error(
      `Training guide '${slug}' has invalid frontmatter: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  if (parsed.frontmatter.slug !== slug) {
    throw new Error(
      `Training guide '${slug}' declares mismatched slug '${parsed.frontmatter.slug}'.`,
    );
  }

  return {
    ...parsed.frontmatter,
    body: removeRenderedDocumentTitle(parsed.body),
  };
}

export async function getTrainingGuideSummaries(): Promise<TrainingGuide[]> {
  const guides = await Promise.all(TRAINING_GUIDE_SLUGS.map(loadTrainingGuide));
  return guides.map(({ body: _body, ...guide }) => guide);
}

export async function getTrainingGuideBySlug(
  slug: string,
): Promise<TrainingGuideDocument | null> {
  if (!isTrainingGuideSlug(slug)) return null;
  return loadTrainingGuide(slug);
}
