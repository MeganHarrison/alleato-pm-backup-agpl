#!/usr/bin/env node
/**
 * Pre-commit guardrail: every API route that renders a PDF via puppeteer +
 * @sparticuz/chromium MUST be force-included in next.config.ts's
 * outputFileTracingIncludes.
 *
 * Why this exists: @sparticuz/chromium ships its headless Chromium as
 * brotli-compressed blobs in its `bin/` dir, which executablePath() reads at
 * runtime via a constructed path — NOT a static `require`. Next.js output file
 * tracing therefore drops `bin/*.br` even though the package is in
 * serverExternalPackages. The route builds and deploys fine, then crashes ONLY
 * in production with:
 *   "The input directory .../@sparticuz/chromium/bin does not exist."
 * (request_id 43936ef5 on projects/[projectId]/progress-reports/[reportId]/pdf,
 *  2026-06-18). This is invisible locally (dev uses system Chrome) and passes
 *  every build gate. The only thing that catches it is shipping it — exactly the
 *  "should have been caught pre-deploy → add a check" bucket.
 *
 * A route "renders a PDF" if it imports renderPdfFromHtml or @sparticuz/chromium.
 * Each such route's path (derived from its file location) must appear as a key
 * in outputFileTracingIncludes. If you add a PDF/email route, add the key.
 *
 * Run: node scripts/audits/check-pdf-route-tracing.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const API_DIR = join(REPO_ROOT, "frontend/src/app/api");
const NEXT_CONFIG = join(REPO_ROOT, "frontend/next.config.ts");

const PDF_SIGNAL = /renderPdfFromHtml|@sparticuz\/chromium/;

/** Recursively collect every route.ts file under the api dir. */
function collectRouteFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

/** frontend/src/app/api/foo/[bar]/pdf/route.ts -> /api/foo/[bar]/pdf */
function routePathFromFile(file) {
  const rel = file.slice(join(REPO_ROOT, "frontend/src/app").length);
  return rel.replace(/\\/g, "/").replace(/\/route\.tsx?$/, "");
}

const routeFiles = collectRouteFiles(API_DIR);
const pdfRoutes = routeFiles
  .filter((f) => PDF_SIGNAL.test(readFileSync(f, "utf8")))
  .map(routePathFromFile)
  .sort();

const config = readFileSync(NEXT_CONFIG, "utf8");
const missing = pdfRoutes.filter((route) => !config.includes(`"${route}"`));

if (missing.length > 0) {
  console.error(
    "\nERROR: PDF-rendering route(s) not force-traced in next.config.ts.\n" +
      "@sparticuz/chromium's binary blobs are dropped by output file tracing,\n" +
      "so these routes build fine but crash in production. Add each route as a\n" +
      "key in outputFileTracingIncludes with value CHROMIUM_TRACE_GLOBS:\n",
  );
  for (const route of missing) console.error(`  "${route}": CHROMIUM_TRACE_GLOBS,`);
  console.error("");
  process.exit(1);
}

console.log(`✓ ${pdfRoutes.length} PDF route(s) force-traced in next.config.ts`);
