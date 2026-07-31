import { appHelpToolGroups } from "./app-help-content";
import type { PublishedTrainingDoc } from "@/lib/training-docs/docs-site";

export interface AppKnowledgeToolCategory {
  slug: string;
  title: string;
  description: string;
  routePrefixes: string[];
}

export const APP_KNOWLEDGE_TOOL_CATEGORIES: AppKnowledgeToolCategory[] =
  appHelpToolGroups.map((group) => ({
    slug: slugifyToolCategory(group.title),
    title: group.title,
    description: group.description,
    routePrefixes: Array.from(
      new Set(
        group.articles
          .flatMap((article) => article.routes)
          .map(normalizeRoutePrefix)
          .filter((route): route is string => Boolean(route)),
      ),
    ),
  }));

const CATEGORY_BY_SLUG = new Map(
  APP_KNOWLEDGE_TOOL_CATEGORIES.map((category) => [category.slug, category]),
);

export function slugifyToolCategory(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAppKnowledgeToolCategory(slug: string) {
  return CATEGORY_BY_SLUG.get(slugifyToolCategory(slug)) ?? null;
}

export function getAppKnowledgeToolHref(category: AppKnowledgeToolCategory) {
  return `/knowledge/app/${category.slug}`;
}

export function getTrainingDocToolCategory(doc: PublishedTrainingDoc) {
  const metadataCategory = normalizeMetadataCategory(doc.appToolCategory);
  if (metadataCategory) {
    const category = getAppKnowledgeToolCategory(metadataCategory);
    if (category) return category;
  }

  const sourceRoute = doc.sourceRoute?.trim();
  if (!sourceRoute) return null;

  const normalizedSourceRoute = normalizeRouteForMatch(sourceRoute);
  return (
    APP_KNOWLEDGE_TOOL_CATEGORIES.find((category) =>
      category.routePrefixes.some((prefix) => routeMatchesPrefix(normalizedSourceRoute, prefix)),
    ) ?? null
  );
}

export function getTrainingDocsForToolCategory(
  docs: readonly PublishedTrainingDoc[],
  category: AppKnowledgeToolCategory,
) {
  return docs.filter((doc) => getTrainingDocToolCategory(doc)?.slug === category.slug);
}

function normalizeMetadataCategory(value: string | null) {
  if (!value) return null;
  return slugifyToolCategory(value);
}

function normalizeRoutePrefix(route: string) {
  const normalized = normalizeRouteForMatch(route);
  if (!normalized || normalized === "/") return null;

  const segments = normalized.split("/").filter(Boolean);
  const toolSegment =
    segments[0] === "[projectid]" || segments[0] === "[projectId]"
      ? segments[1]
      : segments[0];

  return toolSegment ? `/${toolSegment}` : null;
}

function normalizeRouteForMatch(route: string) {
  return route
    .trim()
    .replace(/\[[^\]]+\]/g, (segment) => segment.toLowerCase())
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function routeMatchesPrefix(route: string, prefix: string) {
  if (route.startsWith(prefix)) return true;

  const segments = route.split("/").filter(Boolean);
  if (segments.length < 2) return false;

  const firstSegmentLooksProjectScoped =
    /^\d+$/.test(segments[0]) || segments[0] === "[projectid]";

  if (!firstSegmentLooksProjectScoped) return false;

  return `/${segments[1]}`.startsWith(prefix);
}
