#!/usr/bin/env node

/**
 * @file init-procore-module.js
 * @description Scaffolding utility that initializes the directory structure for
 * a new Procore module crawl.
 *
 * Takes a module name as a CLI argument, normalizes it to kebab-case, creates
 * the screenshots/, dom/, and reports/ subdirectories under
 * procore-crawls/<module>/, and writes a boilerplate README.md describing the
 * module's purpose, folder layout, and usage instructions.
 *
 * Directory layout:
 *   screenshots/  - One .png per crawled page, filename matches the page name
 *   dom/          - Per-page subfolders containing dom.html + metadata.json
 *   reports/      - Aggregated reports (sitemap, detailed-report, link-graph)
 *
 * Includes a safety check to prevent overwriting an existing module directory.
 *
 * Usage:
 *   node scripts/init-procore-module.js <module-name>
 *
 * Example:
 *   node scripts/init-procore-module.js drawings
 *
 * Output:
 *   procore-crawls/<module>/
 *     ├── screenshots/
 *     ├── dom/
 *     ├── reports/
 *     └── README.md
 *   module-configs/<module>.json  (starter crawler config)
 */
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   CONFIG
========================================================= */

const CRAWL_ROOT_DIR = path.resolve("./procore-crawls");
const CONFIG_DIR = path.resolve(__dirname, "..", "module-configs");

/* =========================================================
   ARG PARSING
========================================================= */

const [, , moduleNameRaw] = process.argv;

if (!moduleNameRaw) {
  console.error("❌ Missing module name.");
  console.error("Usage: node scripts/init-procore-module.js <module-name>");
  process.exit(1);
}

// Normalize module name (kebab-case, lowercase)
const moduleName = moduleNameRaw
  .toLowerCase()
  .replace(/[^a-z0-9\-]/g, "-")
  .replace(/--+/g, "-")
  .replace(/^-|-$/g, "");

const MODULE_DIR = path.join(CRAWL_ROOT_DIR, moduleName);
const SCREENSHOTS_DIR = path.join(MODULE_DIR, "screenshots");
const DOM_DIR = path.join(MODULE_DIR, "dom");
const REPORTS_DIR = path.join(MODULE_DIR, "reports");
const README_PATH = path.join(MODULE_DIR, "README.md");

/* =========================================================
   SAFETY CHECKS
========================================================= */

if (fs.existsSync(MODULE_DIR)) {
  console.error(`❌ Module already exists: ${moduleName}`);
  console.error("Aborting to avoid accidental overwrite.");
  process.exit(1);
}

/* =========================================================
   INIT
========================================================= */

async function initModule() {
  console.log(`🚀 Initializing Procore module: ${moduleName}`);

  await fs.ensureDir(SCREENSHOTS_DIR);
  await fs.ensureDir(DOM_DIR);
  await fs.ensureDir(REPORTS_DIR);

  const readmeContent = `# Procore Module: ${moduleName}

## Purpose

This directory contains **crawler output and reports** for the Procore **${moduleName}** tool.

This module is part of a larger system designed to:
- Observe Procore functionality
- Extract UI and behavioral intelligence
- Ingest structured data into Supabase
- Enable accurate rebuilding and parity analysis

---

## Directory Structure

\`\`\`
${moduleName}/
├── screenshots/              # One screenshot per page, named to match
│   ├── <page-name>.png
│   └── ...
├── dom/                      # DOM snapshots + metadata per page
│   └── <page-name>/
│       ├── dom.html
│       └── metadata.json
├── reports/
│   ├── sitemap-table.md
│   ├── detailed-report.json
│   └── link-graph.json
├── README.md
\`\`\`

---

## How This Module Is Used

1. A Playwright crawler targets the Procore **${moduleName}** tool
2. Screenshots are saved to \`screenshots/\` (one .png per page, named to match the page)
3. DOM snapshots and metadata are saved to \`dom/<page-name>/\`
4. Reports are generated into \`reports/\`
4. The ETL script ingests this data into Supabase using:
   \`\`\`bash
   PROCORE_MODULE=${moduleName} node etl/etl_ingest_procore_crawl.js
   \`\`\`

---

## Notes

- This folder represents **explicit intent** to crawl and model this Procore tool
- Structure should not be modified by ETL scripts
- Add tool-specific notes here as discoveries are made
`;

  await fs.writeFile(README_PATH, readmeContent, "utf8");

  // Generate starter crawler config
  await fs.ensureDir(CONFIG_DIR);
  const configPath = path.join(CONFIG_DIR, `${moduleName}.json`);

  if (!fs.existsSync(configPath)) {
    const starterConfig = {
      module: moduleName,
      startUrl: `https://us02.procore.com/webclients/host/companies/COMPANY_ID/projects/PROJECT_ID/tools/${moduleName}`,
      pages: [
        {
          name: `${moduleName}-list`,
          label: `${moduleNameRaw} List`,
          category: moduleName,
          interactions: []
        }
      ]
    };

    await fs.writeJson(configPath, starterConfig, { spaces: 2 });
    console.log(`📋 Starter config created: ${configPath}`);
    console.log("   Edit the startUrl and add interactions before crawling.");
  } else {
    console.log(`📋 Config already exists: ${configPath} (skipped)`);
  }

  console.log("✅ Module initialized successfully");
  console.log(`📁 Location: ${MODULE_DIR}`);
}

/* =========================================================
   EXECUTE
========================================================= */

initModule().catch(err => {
  console.error("🔥 Module initialization failed:", err);
  process.exit(1);
});
