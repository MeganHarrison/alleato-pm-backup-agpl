#!/usr/bin/env node

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const appRoot = path.join(repoRoot, "frontend/src/app");
const helpRoot = path.join(repoRoot, "docs/alleato-os-docs/help/articles");
const outputRoot = path.join(repoRoot, "docs/architecture/generated");
const runtimeRoot = path.join(repoRoot, "backend/src/services/agents/app_expert/runtime");
const runtimeGeneratedRoot = path.join(runtimeRoot, "generated");
const runtimeHelpRoot = path.join(runtimeRoot, "help/articles");

function titleCase(value) {
  return value
    .replace(/\[[^\]]+\]/g, "")
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
}

function filePathToRoute(relativeFile) {
  let route = relativeFile.replace(/\/page\.(tsx|ts|jsx|js)$/u, "");
  route = route
    .split("/")
    .filter((segment) => !/^\([^)]+\)$/u.test(segment))
    .join("/");
  route = route.replace(/\\/gu, "/");
  return route ? `/${route}`.replace(/\/+/gu, "/") : "/";
}

function routeGroup(relativeFile) {
  const match = relativeFile.match(/(?:^|\/)\(([^)]+)\)/u);
  return match?.[1] ?? null;
}

function dynamicSegments(route) {
  return Array.from(route.matchAll(/\[([^\]]+)\]/gu)).map((match) => match[1]);
}

function inferScope(route, group) {
  if (route.startsWith("/auth")) return "auth";
  if (route.startsWith("/admin") || group === "admin") return "admin";
  if (route.includes("[projectId]")) return "project";
  if (route.startsWith("/settings")) return "user_settings";
  if (route.startsWith("/api")) return "api";
  return "global";
}

function inferCategory(route, group) {
  if (group === "admin" || route.startsWith("/admin")) return "Admin";
  if (route.startsWith("/auth")) return "Authentication";
  if (route.startsWith("/directory")) return "Directory";
  if (route.startsWith("/settings")) return "Settings";
  if (route.startsWith("/ai-assistant") || route.startsWith("/rag")) return "AI";
  if (route.includes("/budget") || route.includes("/contract") || route.includes("/commitment") || route.includes("/invoice") || route.includes("/change")) return "Financial";
  if (route.includes("[projectId]")) return "Project";
  return titleCase(group ?? route.split("/").filter(Boolean)[0] ?? "Main") || "Main";
}

function inferPageType(route) {
  if (route.endsWith("/new")) return "form";
  if (route.endsWith("/edit")) return "form";
  if (route.includes("/admin")) return "admin";
  if (route.includes("dashboard") || route.endsWith("/home")) return "dashboard";
  if (route.includes("/settings")) return "settings";
  if (route.includes("/ai-assistant") || route.includes("/rag")) return "chat";
  return "page";
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      files.push(...(await walk(fullPath)));
    } else if (/^page\.(tsx|ts|jsx|js)$/u.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function discoverRoutes() {
  if (!existsSync(appRoot)) {
    throw new Error(`App root not found: ${appRoot}`);
  }
  const files = await walk(appRoot);
  const routes = [];
  for (const file of files) {
    const relativeFile = path.relative(appRoot, file).replace(/\\/gu, "/");
    const route = filePathToRoute(relativeFile);
    const segments = dynamicSegments(route);
    const group = routeGroup(relativeFile);
    const stats = await fs.stat(file);
    const titleSegment =
      route
        .split("/")
        .filter((segment) => segment && !segment.startsWith("["))
        .at(-1) ?? "Portfolio";
    routes.push({
      route,
      title: titleCase(titleSegment) || "Portfolio",
      category: inferCategory(route, group),
      type: inferPageType(route),
      scope: inferScope(route, group),
      dynamic: segments.length > 0,
      dynamicSegments: segments,
      routeGroup: group,
      appFile: path.relative(repoRoot, file).replace(/\\/gu, "/"),
      lastModified: stats.mtime.toISOString(),
    });
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/u.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => item.trim().replace(/^["']|["']$/gu, ""));
  }
  return trimmed.replace(/^["']|["']$/gu, "");
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---", 4);
  if (end < 0) return null;
  const lines = raw.slice(4, end).split("\n");
  const meta = {};
  let activeKey = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const listMatch = line.match(/^\s+-\s+(.*)$/u);
    if (listMatch && activeKey) {
      if (!Array.isArray(meta[activeKey])) meta[activeKey] = [];
      meta[activeKey].push(parseScalar(listMatch[1]));
      continue;
    }
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!keyMatch) continue;
    activeKey = keyMatch[1];
    meta[activeKey] = keyMatch[2] === "" ? [] : parseScalar(keyMatch[2]);
  }
  return {
    meta,
    content: raw.slice(end + "\n---".length).trim(),
  };
}

async function markdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(fullPath)));
    } else if (/\.mdx?$/iu.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function readHelpArticles() {
  const sourceRoot = existsSync(helpRoot) ? helpRoot : runtimeHelpRoot;
  if (!existsSync(sourceRoot)) {
    throw new Error(
      `APP_EXPERT_HELP_SOURCE_MISSING: neither ${path.relative(repoRoot, helpRoot)} nor ${path.relative(repoRoot, runtimeHelpRoot)} exists.`,
    );
  }
  if (sourceRoot === runtimeHelpRoot) {
    console.warn(
      `[app-expert] ${path.relative(repoRoot, helpRoot)} is absent; preserving the bundled runtime help corpus from ${path.relative(repoRoot, runtimeHelpRoot)}.`,
    );
  }

  const files = await markdownFiles(sourceRoot);
  const articles = [];
  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const parsed = parseFrontmatter(raw);
    if (!parsed) continue;
    const relative = path.relative(sourceRoot, file).replace(/\\/gu, "/");
    articles.push({
      slug: relative.replace(/\.mdx?$/iu, ""),
      // Keep the logical docs path stable even when this repository has only
      // the bundled runtime mirror. App Expert resolves the same relative path
      // against both roots, so artifact regeneration cannot silently erase or
      // relabel help coverage after the public docs repository split.
      filePath: `docs/alleato-os-docs/help/articles/${relative}`,
      title: String(parsed.meta.title ?? titleCase(relative.replace(/\.mdx?$/iu, ""))),
      description: String(parsed.meta.description ?? ""),
      audience: String(parsed.meta.audience ?? "client"),
      visibility: String(parsed.meta.visibility ?? "draft"),
      module: String(parsed.meta.module ?? "uncategorized"),
      category: String(parsed.meta.category ?? "General"),
      tags: Array.isArray(parsed.meta.tags) ? parsed.meta.tags.map(String) : [],
      clientVisible: Boolean(parsed.meta.client_visible),
      aiVisible: Boolean(parsed.meta.ai_visible),
      order: Number(parsed.meta.order ?? 9999),
      relatedRoutes: Array.isArray(parsed.meta.related_routes) ? parsed.meta.related_routes.map(String) : [],
      relatedActions: Array.isArray(parsed.meta.related_actions) ? parsed.meta.related_actions.map(String) : [],
    });
  }
  if (articles.length === 0) {
    throw new Error(
      `APP_EXPERT_HELP_SOURCE_EMPTY: ${path.relative(repoRoot, sourceRoot)} contained no frontmatter-backed help articles.`,
    );
  }
  return articles.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function buildFeatureRegistry(routes, articles) {
  const routeByPath = new Map(routes.map((route) => [route.route, route]));
  const features = articles.map((article) => {
    const matchedRoutes = article.relatedRoutes
      .map((route) => routeByPath.get(route) ?? null)
      .filter(Boolean);
    return {
      id: article.slug,
      title: article.title,
      description: article.description,
      module: article.module,
      category: article.category,
      status: article.visibility === "published" ? "documented" : "draft",
      clientVisible: article.clientVisible,
      aiVisible: article.aiVisible,
      tags: article.tags,
      routes: article.relatedRoutes,
      routeFiles: matchedRoutes.map((route) => route.appFile),
      relatedActions: article.relatedActions,
      helpArticle: article.filePath,
      source: "help_article",
    };
  });

  const documentedRoutes = new Set(features.flatMap((feature) => feature.routes));
  for (const route of routes) {
    if (documentedRoutes.has(route.route)) continue;
    features.push({
      id: `route:${route.route}`,
      title: route.title,
      description: `Route discovered from ${route.appFile}. User-facing help article not yet linked.`,
      module: route.category.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, ""),
      category: route.category,
      status: "route_discovered",
      clientVisible: route.scope !== "admin" && route.scope !== "auth",
      aiVisible: true,
      tags: [route.scope, route.type].filter(Boolean),
      routes: [route.route],
      routeFiles: [route.appFile],
      relatedActions: [],
      helpArticle: null,
      source: "route_inventory",
    });
  }

  return features.sort((a, b) => a.module.localeCompare(b.module) || a.title.localeCompare(b.title));
}

function enrichRoutes(routes, features) {
  const featuresByRoute = new Map();
  for (const feature of features) {
    for (const route of feature.routes ?? []) {
      if (!featuresByRoute.has(route)) featuresByRoute.set(route, []);
      featuresByRoute.get(route).push({
        id: feature.id,
        title: feature.title,
        description: feature.description,
        status: feature.status,
        source: feature.source,
        tags: feature.tags,
        helpArticle: feature.helpArticle,
      });
    }
  }

  return routes.map((route) => {
    const relatedFeatures = featuresByRoute.get(route.route) ?? [];
    return {
      ...route,
      relatedFeatures: relatedFeatures.map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description,
        status: feature.status,
        source: feature.source,
        tags: feature.tags,
      })),
      relatedHelpArticles: relatedFeatures
        .filter((feature) => feature.helpArticle)
        .map((feature) => feature.helpArticle),
    };
  });
}

async function writeJson(fileName, value) {
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.mkdir(runtimeGeneratedRoot, { recursive: true });
  const target = path.join(outputRoot, fileName);
  const runtimeTarget = path.join(runtimeGeneratedRoot, fileName);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.writeFile(runtimeTarget, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return target;
}

async function syncRuntimeHelpArticles() {
  if (!existsSync(helpRoot)) return;
  await fs.rm(runtimeHelpRoot, { recursive: true, force: true });
  await fs.mkdir(runtimeHelpRoot, { recursive: true });
  await fs.cp(helpRoot, runtimeHelpRoot, {
    recursive: true,
    filter: (source) => {
      const name = path.basename(source);
      return !name.startsWith(".") && (existsSync(source) ? true : false);
    },
  });
}

async function main() {
  const routes = await discoverRoutes();
  const articles = await readHelpArticles();
  await syncRuntimeHelpArticles();
  const features = buildFeatureRegistry(routes, articles);
  const enrichedRoutes = enrichRoutes(routes, features);
  const generatedAt = new Date().toISOString();
  const documentedRouteCount = enrichedRoutes.filter(
    (route) => route.relatedHelpArticles.length > 0,
  ).length;

  const sitemapPath = await writeJson("app-sitemap.generated.json", {
    schemaVersion: 1,
    generatedAt,
    source: "scripts/docs/generate-app-expert-artifacts.mjs",
    routeCount: enrichedRoutes.length,
    documentedRouteCount,
    helpArticleCount: articles.length,
    routes: enrichedRoutes,
  });
  const registryPath = await writeJson("feature-registry.generated.json", {
    schemaVersion: 1,
    generatedAt,
    source: "scripts/docs/generate-app-expert-artifacts.mjs",
    featureCount: features.length,
    documentedFeatureCount: features.filter((feature) => feature.status === "documented").length,
    routeDiscoveredFeatureCount: features.filter((feature) => feature.status === "route_discovered").length,
    features,
  });

  console.log(`Generated ${routes.length} routes -> ${path.relative(repoRoot, sitemapPath)}`);
  console.log(`Generated ${features.length} features -> ${path.relative(repoRoot, registryPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
