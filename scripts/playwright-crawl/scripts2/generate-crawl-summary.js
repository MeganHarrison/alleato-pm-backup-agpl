/**
 * @file generate-crawl-summary.js
 * @description Post-crawl aggregation script that produces a single crawl-summary.json.
 *
 * Scans the crawl directory for captured page data:
 *   screenshots/  - One .png per page, filename matches the page name
 *   dom/          - Per-page subfolders containing dom.html, metadata.json, network.json
 *
 * Queries Supabase for app_commands and app_system_actions related to the module,
 * extracts UI components (tables, forms, dropdowns, buttons, modals) from page
 * metadata, aggregates network request data, and writes a consolidated summary
 * with stats, component inventory, screenshot index, and spec artifact availability.
 * Designed to feed into the PRP creation workflow.
 *
 * Environment variables:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   PROCORE_MODULE            - Module name (e.g. "submittals")
 *   CRAWL_ROOT_DIR            - Root directory for crawl data (default: ./procore-crawls)
 *   CRAWL_DIR                 - Absolute path override for module directory
 *
 * Output:
 *   <MODULE_DIR>/crawl-summary.json
 *
 * Usage:
 *   PROCORE_MODULE=submittals node scripts/generate-crawl-summary.js
 */
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PROCORE_MODULE,
  CRAWL_ROOT_DIR = "./procore-crawls"
} = process.env;

if (!PROCORE_MODULE) {
  throw new Error("Missing PROCORE_MODULE env var (e.g. submittals)");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const MODULE_DIR = process.env.CRAWL_DIR || path.join(CRAWL_ROOT_DIR, PROCORE_MODULE);
const SCREENSHOTS_DIR = path.join(MODULE_DIR, "screenshots");
const DOM_DIR = path.join(MODULE_DIR, "dom");
const REPORTS_DIR = path.join(MODULE_DIR, "reports");
const SPEC_DIR = path.join(MODULE_DIR, "spec");

/**
 * Load domain commands from Supabase
 */
async function loadCommands() {
  const { data, error } = await supabase
    .from("app_commands")
    .select("*")
    .eq("module", PROCORE_MODULE)
    .order("command_key");

  if (error) {
    console.warn("⚠️  Could not load commands from Supabase:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Load system actions from Supabase
 */
async function loadSystemActions() {
  const { data, error } = await supabase
    .from("app_system_actions")
    .select("*")
    .eq("affects_resource", PROCORE_MODULE);

  if (error) {
    console.warn("⚠️  Could not load system actions:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Scan crawl directory for captured page data.
 *
 * Layout:
 *   screenshots/<page-name>.png
 *   dom/<page-name>/dom.html
 *   dom/<page-name>/metadata.json
 *   dom/<page-name>/network.json
 */
async function scanPages() {
  const pages = [];

  if (!await fs.pathExists(DOM_DIR)) {
    console.warn(`⚠️  No dom/ directory found in ${MODULE_DIR}`);
    return pages;
  }

  const dirs = await fs.readdir(DOM_DIR);

  for (const dir of dirs) {
    const domPageDir = path.join(DOM_DIR, dir);
    const stat = await fs.stat(domPageDir);
    if (!stat.isDirectory()) continue;

    const metadataPath = path.join(domPageDir, "metadata.json");
    const domPath = path.join(domPageDir, "dom.html");
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${dir}.png`);

    const page = {
      name: dir,
      path: domPageDir,
      hasMetadata: await fs.pathExists(metadataPath),
      hasScreenshot: await fs.pathExists(screenshotPath),
      hasDom: await fs.pathExists(domPath),
      metadata: null,
      screenshotRelativePath: null
    };

    if (page.hasMetadata) {
      try {
        page.metadata = await fs.readJson(metadataPath);
      } catch (e) {
        console.warn(`⚠️  Could not read metadata for ${dir}:`, e.message);
      }
    }

    if (page.hasScreenshot) {
      page.screenshotRelativePath = `screenshots/${dir}.png`;
    }

    pages.push(page);
  }

  return pages;
}

/**
 * Extract UI components from page metadata.
 *
 * Reads from the generic crawler metadata format:
 *   systemActions[]    - Interaction-discovered actions with semanticHint
 *   clickableDetails[] - Buttons/links with semanticHint
 *   dropdownDetails[]  - Dropdown menus with option values
 *   tabDetails[]       - Tab navigation elements
 *   tableDetails[]     - Table column headers, row counts, pagination
 *   forms[]            - Form field inventories with required indicators
 */
function extractUIComponents(pages) {
  const components = {
    tables: [],
    forms: [],
    dropdowns: [],
    buttons: [],
    modals: [],
    tableStructures: [],
    formStructures: [],
    semanticHints: {}
  };

  for (const page of pages) {
    if (!page.metadata) continue;

    const meta = page.metadata;

    // Interaction-discovered actions (context menus, modal buttons)
    if (Array.isArray(meta.systemActions)) {
      for (const action of meta.systemActions) {
        if (action.semanticHint) {
          components.semanticHints[action.semanticHint] =
            (components.semanticHints[action.semanticHint] || 0) + 1;
        }

        if (action.type === "context_menu") {
          components.dropdowns.push({
            label: action.text,
            page: page.name,
            type: "context_menu",
            semanticHint: action.semanticHint || null
          });
        } else if (action.type === "modal_action") {
          components.modals.push({
            label: action.text,
            page: page.name,
            semanticHint: action.semanticHint || null
          });
        } else if (action.type === "button" || action.type === "menuitem") {
          components.buttons.push({
            label: action.text,
            page: page.name,
            semanticHint: action.semanticHint || null
          });
        }
      }
    }

    // Clickable elements (buttons, links)
    if (Array.isArray(meta.clickableDetails)) {
      for (const btn of meta.clickableDetails) {
        if (btn.text) {
          if (btn.semanticHint) {
            components.semanticHints[btn.semanticHint] =
              (components.semanticHints[btn.semanticHint] || 0) + 1;
          }
          components.buttons.push({
            label: btn.text,
            page: page.name,
            semanticHint: btn.semanticHint || null
          });
        }
      }
    }

    // Dropdowns with option values
    if (Array.isArray(meta.dropdownDetails)) {
      for (const item of meta.dropdownDetails) {
        if (item.text || item.label) {
          components.dropdowns.push({
            label: item.text || item.label,
            page: page.name,
            type: item.type || "dropdown",
            optionCount: Array.isArray(item.options) ? item.options.length : 0
          });
        }
      }
    }

    // Table structures with column details
    if (Array.isArray(meta.tableDetails)) {
      for (const td of meta.tableDetails) {
        components.tableStructures.push({
          page: page.name,
          columns: td.columns || [],
          columnCount: (td.columns || []).length,
          rowCount: td.rowCount ?? null,
          hasPagination: td.hasPagination ?? false,
          sortableColumns: (td.columns || []).filter(c => c.sortable).map(c => c.text)
        });
      }
    }

    // Form structures with field inventories
    if (Array.isArray(meta.forms)) {
      for (const f of meta.forms) {
        if (Array.isArray(f.fields) && f.fields.length > 0) {
          components.formStructures.push({
            page: page.name,
            source: f.source || null,
            fieldCount: f.fields.length,
            requiredFields: f.fields.filter(fld => fld.required).map(fld => fld.name || fld.label),
            fields: f.fields.map(fld => ({
              name: fld.name || null,
              label: fld.label || null,
              type: fld.type || "text",
              required: fld.required || false,
              hasOptions: Array.isArray(fld.options) && fld.options.length > 0
            }))
          });
        }
        components.forms.push({
          ...f,
          page: page.name
        });
      }
    }
  }

  return components;
}

/**
 * Aggregate network request data across all pages.
 * Reads network.json files from dom/<page>/network.json.
 */
async function aggregateNetworkData(pages) {
  const networkSummary = {
    totalRequests: 0,
    byMethod: {},
    byStatus: {},
    apiEndpoints: [],
    mutations: []
  };

  const seenEndpoints = new Set();

  for (const page of pages) {
    const networkPath = path.join(DOM_DIR, page.name, "network.json");
    if (!await fs.pathExists(networkPath)) continue;

    let requests;
    try {
      requests = await fs.readJson(networkPath);
    } catch (e) {
      console.warn(`⚠️  Could not read network data for ${page.name}:`, e.message);
      continue;
    }

    // network.json has { requests: [...] } wrapper from generic crawler
    const reqList = Array.isArray(requests) ? requests : (requests.requests || []);
    if (!Array.isArray(reqList)) continue;

    for (const req of reqList) {
      networkSummary.totalRequests++;

      const method = (req.method || "GET").toUpperCase();
      networkSummary.byMethod[method] = (networkSummary.byMethod[method] || 0) + 1;

      const status = req.statusCode || req.status || "unknown";
      networkSummary.byStatus[status] = (networkSummary.byStatus[status] || 0) + 1;

      const url = req.url || "";
      try {
        const parsed = new URL(url);
        const endpoint = `${method} ${parsed.pathname}`;
        if (!seenEndpoints.has(endpoint)) {
          seenEndpoints.add(endpoint);
          networkSummary.apiEndpoints.push({
            method,
            path: parsed.pathname,
            page: page.name,
            status
          });
        }
      } catch {
        // Not a valid URL, skip
      }

      if (method !== "GET" && req.requestBody) {
        networkSummary.mutations.push({
          method,
          url: req.url,
          page: page.name,
          requestBodyShape: req.requestBody ? describeShapeShallow(req.requestBody) : null,
          status
        });
      }
    }
  }

  return networkSummary;
}

/**
 * Shallow shape description for network request bodies.
 */
function describeShapeShallow(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return typeof obj;
  if (Array.isArray(obj)) {
    return obj.length > 0 ? [`${typeof obj[0]}[]`] : ["empty[]"];
  }
  const shape = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null) shape[key] = "null";
    else if (Array.isArray(val)) shape[key] = `array(${val.length})`;
    else shape[key] = typeof val;
  }
  return shape;
}

/**
 * Build screenshots index
 */
function buildScreenshotsIndex(pages) {
  const screenshots = {};
  for (const page of pages) {
    if (page.hasScreenshot) {
      screenshots[page.name] = page.screenshotRelativePath;
    }
  }
  return screenshots;
}

/**
 * Load existing reports
 */
async function loadReports() {
  const reports = {};
  if (!await fs.pathExists(REPORTS_DIR)) return reports;

  const files = await fs.readdir(REPORTS_DIR);
  for (const file of files) {
    if (file.endsWith(".json")) {
      const filePath = path.join(REPORTS_DIR, file);
      try {
        reports[file.replace(".json", "")] = await fs.readJson(filePath);
      } catch (e) {
        console.warn(`⚠️  Could not read report ${file}:`, e.message);
      }
    }
  }
  return reports;
}

/**
 * Check for spec artifacts
 */
async function checkSpecArtifacts() {
  return {
    commands: await fs.pathExists(path.join(SPEC_DIR, "COMMANDS.md")),
    forms: await fs.pathExists(path.join(SPEC_DIR, "FORMS.md")),
    mutations: await fs.pathExists(path.join(SPEC_DIR, "MUTATIONS.md")),
    schema: await fs.pathExists(path.join(SPEC_DIR, "schema.sql"))
  };
}

/**
 * Main
 */
(async function run() {
  console.log(`📊 Generating crawl summary for module: ${PROCORE_MODULE}`);

  const [commands, systemActions, pages, reports, specArtifacts] = await Promise.all([
    loadCommands(),
    loadSystemActions(),
    scanPages(),
    loadReports(),
    checkSpecArtifacts()
  ]);

  const uiComponents = extractUIComponents(pages);
  const screenshots = buildScreenshotsIndex(pages);
  const networkData = await aggregateNetworkData(pages);

  const totalFormFields = uiComponents.formStructures.reduce(
    (sum, f) => sum + f.fieldCount, 0
  );
  const totalRequiredFields = uiComponents.formStructures.reduce(
    (sum, f) => sum + f.requiredFields.length, 0
  );
  const totalTableColumns = uiComponents.tableStructures.reduce(
    (sum, t) => sum + t.columnCount, 0
  );

  const summary = {
    module: PROCORE_MODULE,
    generatedAt: new Date().toISOString(),

    stats: {
      pagesCaptured: pages.length,
      pagesWithMetadata: pages.filter(p => p.hasMetadata).length,
      pagesWithScreenshots: pages.filter(p => p.hasScreenshot).length,
      systemActionsFound: systemActions.length,
      domainCommandsPromoted: commands.length,
      tablesFound: uiComponents.tableStructures.length,
      tableColumnsFound: totalTableColumns,
      formsFound: uiComponents.formStructures.length,
      formFieldsFound: totalFormFields,
      requiredFieldsFound: totalRequiredFields,
      networkRequestsCaptured: networkData.totalRequests,
      apiEndpointsDiscovered: networkData.apiEndpoints.length,
      mutationsCaptured: networkData.mutations.length,
      semanticHintDistribution: Object.keys(uiComponents.semanticHints).length > 0
        ? uiComponents.semanticHints
        : null
    },

    specArtifacts,

    commands: commands.map(c => ({
      key: c.command_key,
      label: c.label,
      description: c.description || ""
    })),

    systemActions: systemActions.slice(0, 50).map(a => ({
      label: a.label,
      type: a.trigger_type,
      page: a.page_name
    })),

    uiComponents: {
      forms: uiComponents.forms.slice(0, 20),
      dropdowns: uiComponents.dropdowns.slice(0, 30),
      buttons: uiComponents.buttons.slice(0, 30),
      modals: uiComponents.modals.slice(0, 20)
    },

    tableStructures: uiComponents.tableStructures,
    formStructures: uiComponents.formStructures,

    network: {
      totalRequests: networkData.totalRequests,
      byMethod: networkData.byMethod,
      byStatus: networkData.byStatus,
      apiEndpoints: networkData.apiEndpoints.slice(0, 100),
      mutations: networkData.mutations.slice(0, 50)
    },

    screenshots,

    pages: pages.map(p => ({
      name: p.name,
      url: p.metadata?.url || null,
      category: p.metadata?.category || null,
      capturedAt: p.metadata?.capturedAt || null,
      hasScreenshot: p.hasScreenshot,
      hasDom: p.hasDom,
      systemActionsCount: (p.metadata?.systemActions?.length || 0)
        + (p.metadata?.clickableDetails?.length || 0)
        + (p.metadata?.dropdownDetails?.length || 0)
        + (p.metadata?.tabDetails?.length || 0),
      formsCount: (p.metadata?.forms?.length || 0),
      tableDetailsCount: (p.metadata?.tableDetails?.length || 0),
      interactionUrls: p.metadata?.interactionUrls || null
    })),

    paths: {
      moduleDir: MODULE_DIR,
      screenshotsDir: SCREENSHOTS_DIR,
      domDir: DOM_DIR,
      reportsDir: REPORTS_DIR,
      specDir: SPEC_DIR
    }
  };

  const outputPath = path.join(MODULE_DIR, "crawl-summary.json");
  await fs.writeJson(outputPath, summary, { spaces: 2 });

  console.log(`\n✅ Crawl summary generated: ${outputPath}`);
  console.log(`\n📈 Summary Stats:`);
  console.log(`   - Pages captured: ${summary.stats.pagesCaptured}`);
  console.log(`   - System actions: ${summary.stats.systemActionsFound}`);
  console.log(`   - Domain commands: ${summary.stats.domainCommandsPromoted}`);
  console.log(`   - Screenshots: ${Object.keys(screenshots).length}`);
  if (summary.stats.tablesFound > 0) {
    console.log(`   - Tables found: ${summary.stats.tablesFound} (${summary.stats.tableColumnsFound} columns)`);
  }
  if (summary.stats.formsFound > 0) {
    console.log(`   - Forms found: ${summary.stats.formsFound} (${summary.stats.formFieldsFound} fields, ${summary.stats.requiredFieldsFound} required)`);
  }
  if (summary.stats.networkRequestsCaptured > 0) {
    console.log(`   - Network requests: ${summary.stats.networkRequestsCaptured} (${summary.stats.apiEndpointsDiscovered} unique endpoints)`);
    console.log(`   - Mutations captured: ${summary.stats.mutationsCaptured}`);
  }
  if (summary.stats.semanticHintDistribution) {
    const hints = summary.stats.semanticHintDistribution;
    const parts = Object.entries(hints).map(([k, v]) => `${k}:${v}`).join(", ");
    console.log(`   - Semantic hints: ${parts}`);
  }
  console.log(`\n📁 Spec artifacts available:`);
  console.log(`   - COMMANDS.md: ${specArtifacts.commands ? "✓" : "✗"}`);
  console.log(`   - FORMS.md: ${specArtifacts.forms ? "✓" : "✗"}`);
  console.log(`   - MUTATIONS.md: ${specArtifacts.mutations ? "✓" : "✗"}`);
  console.log(`   - schema.sql: ${specArtifacts.schema ? "✓" : "✗"}`);
})();
