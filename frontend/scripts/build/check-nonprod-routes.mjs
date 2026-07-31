import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(frontendRoot, "scripts/build/nonprod-routes.json");
const statePath = path.join(frontendRoot, ".next-nonprod-routes/disabled-routes.json");
const appRoot = path.join(frontendRoot, "src/app");
const appSurfacePath = path.join(frontendRoot, "src/lib/app-surface/app-surface.generated.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const missing = [];
const disabledInSource = [];
const duplicates = manifest.files.filter((file, index) => manifest.files.indexOf(file) !== index);

function collectDynamicRouteFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolutePath = path.join(directory, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      files.push(...collectDynamicRouteFiles(absolutePath));
    } else if ((entry === "page.tsx" || entry === "route.ts") && absolutePath.includes("[")) {
      files.push(path.relative(frontendRoot, absolutePath).split(path.sep).join("/"));
    }
  }
  return files;
}

function pageFileToUrl(relativePath) {
  const segments = relativePath
    .replace(/^src\/app\//, "")
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

for (const relativePath of manifest.files) {
  const absolutePath = path.join(frontendRoot, relativePath);
  const disabledPath = `${absolutePath}.nonprod`;

  if (!existsSync(absolutePath)) {
    missing.push(relativePath);
  }

  if (existsSync(disabledPath)) {
    disabledInSource.push(`${relativePath}.nonprod`);
  }
}

if (missing.length > 0 || disabledInSource.length > 0 || duplicates.length > 0) {
  console.error("[build] Non-production route manifest is out of sync.");
  if (missing.length > 0) {
    console.error(`Missing active files:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  }
  if (disabledInSource.length > 0) {
    console.error(`Disabled files left in source:\n${disabledInSource.map((file) => `- ${file}`).join("\n")}`);
  }
  if (duplicates.length > 0) {
    console.error(`Duplicate manifest entries:\n${[...new Set(duplicates)].map((file) => `- ${file}`).join("\n")}`);
  }
  process.exit(1);
}

const excludedFiles = new Set(manifest.files);
const productionDynamicRouteFiles = collectDynamicRouteFiles(appRoot)
  .filter((file) => !excludedFiles.has(file)).length;
const estimatedGeneratedRoutes = manifest.observedGeneratedRouteFixedCost
  + productionDynamicRouteFiles * manifest.observedGeneratedRoutesPerDynamicSource;
if (
  !Number.isInteger(manifest.maxProductionDynamicRouteFiles) ||
  !Number.isInteger(manifest.observedGeneratedRouteFixedCost) ||
  !Number.isInteger(manifest.observedGeneratedRoutesPerDynamicSource) ||
  !Number.isInteger(manifest.maxEstimatedGeneratedRoutes) ||
  productionDynamicRouteFiles > manifest.maxProductionDynamicRouteFiles ||
  estimatedGeneratedRoutes > manifest.maxEstimatedGeneratedRoutes
) {
  console.error("[build] Production dynamic-route budget exceeded.");
  console.error(
    `Vercel accepts at most ${manifest.vercelRouteLimit ?? 2048} generated routes; ` +
      `${productionDynamicRouteFiles} dynamic source files estimate ${estimatedGeneratedRoutes} generated routes, ` +
      `budgets ${manifest.maxProductionDynamicRouteFiles ?? "missing"} dynamic files and ${manifest.maxEstimatedGeneratedRoutes ?? "missing"} generated routes.`,
  );
  console.error(
    "Consolidate an existing dynamic route boundary before adding another. Static page exclusions do not reduce this provider limit.",
  );
  process.exit(1);
}

const appSurface = JSON.parse(readFileSync(appSurfacePath, "utf8"));
const indexedUrls = new Set((appSurface.pages ?? []).map((page) => page.url));
const excludedPageUrls = manifest.files
  .filter((file) => file.endsWith("/page.tsx"))
  .map(pageFileToUrl);
const indexedNonprodUrls = excludedPageUrls.filter((url) => indexedUrls.has(url));
if (indexedNonprodUrls.length > 0) {
  console.error("[build] Non-production pages are still exposed through the production findAppPage index.");
  console.error(indexedNonprodUrls.map((url) => `- ${url}`).join("\n"));
  console.error("Run npm run map:project after updating nonprod-routes.json.");
  process.exit(1);
}

if (existsSync(statePath)) {
  console.error("[build] Found active non-production route state file. A previous production build did not clean up.");
  console.error(`Remove or restore: ${path.relative(frontendRoot, statePath)}`);
  process.exit(1);
}

console.log(
  `[build] Non-production route manifest is valid (${manifest.files.length} files; ` +
    `${productionDynamicRouteFiles}/${manifest.maxProductionDynamicRouteFiles} production dynamic files; ` +
    `estimated ${estimatedGeneratedRoutes}/${manifest.maxEstimatedGeneratedRoutes} generated routes)`,
);
