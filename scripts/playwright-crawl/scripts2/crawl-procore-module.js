/**
 * @file crawl-procore-module.js
 * @description Generic Playwright crawler for any Procore module.
 *
 * Reads a module config file from module-configs/<module>.json, logs into
 * Procore, navigates to each configured page, captures screenshots, DOM HTML,
 * metadata (buttons, menus, tabs, dropdowns), and intercepts network requests
 * to record API contracts.
 *
 * For each page the crawler captures:
 *   screenshots/<page-name>.png      - Full-page screenshot
 *   dom/<page-name>/dom.html         - Raw page HTML
 *   dom/<page-name>/metadata.json    - Page metadata and discovered UI actions
 *   dom/<page-name>/network.json     - Intercepted API requests and responses
 *
 * Metadata includes:
 *   - Clickable elements (buttons, links) with semantic hints (create/update/delete)
 *   - Table structures (column headers, row counts, pagination)
 *   - Form structures (field names, types, required indicators, select options)
 *   - Dropdown/select option values (for enum inference)
 *   - Tab navigation elements
 *   - Interaction-discovered actions (context menus, modals) with form capture
 *   - URL changes from interactions (for route mapping)
 *
 * Interactions are driven by the module config, which can specify right-clicks,
 * double-clicks, clicks, and hover actions per page. This replaces the need
 * for per-tool hardcoded crawler scripts.
 *
 * Environment variables:
 *   PROCORE_EMAIL       - Procore login email
 *   PROCORE_PASSWORD    - Procore login password
 *   CRAWL_ROOT_DIR      - Root directory for crawl output (default: ./procore-crawls)
 *   PROCORE_MODULE      - Module name matching a config in module-configs/
 *
 * Usage:
 *   PROCORE_MODULE=scheduling node scripts/crawl-procore-module.js
 *   PROCORE_MODULE=submittals node scripts/crawl-procore-module.js
 */
import { chromium } from "playwright";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   ENV & CONFIG
========================================================= */

const {
  PROCORE_EMAIL,
  PROCORE_PASSWORD,
  PROCORE_MODULE,
  CRAWL_ROOT_DIR = "./procore-crawls"
} = process.env;

if (!PROCORE_EMAIL || !PROCORE_PASSWORD) {
  throw new Error("Missing PROCORE_EMAIL or PROCORE_PASSWORD in .env");
}
if (!PROCORE_MODULE) {
  throw new Error("Missing PROCORE_MODULE env var (e.g. scheduling)");
}

const CONFIG_DIR = path.resolve(__dirname, "..", "module-configs");
const CONFIG_PATH = path.join(CONFIG_DIR, `${PROCORE_MODULE}.json`);

if (!fs.existsSync(CONFIG_PATH)) {
  throw new Error(
    `No config found for module "${PROCORE_MODULE}" at ${CONFIG_PATH}\n` +
    `Create one in module-configs/${PROCORE_MODULE}.json`
  );
}

const config = fs.readJsonSync(CONFIG_PATH);
const MODULE_DIR = path.join(CRAWL_ROOT_DIR, config.module);
const SCREENSHOTS_DIR = path.join(MODULE_DIR, "screenshots");

fs.ensureDirSync(SCREENSHOTS_DIR);

/* =========================================================
   HELPERS
========================================================= */

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * Sanitize a string for use as a filename.
 */
function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 80);
}

/**
 * Collect all visible buttons, links, and interactive elements from the page.
 */
async function collectClickableDetails(page) {
  return page.evaluate(() => {
    const items = [];
    const selectors = [
      "button",
      'a[href]',
      '[role="button"]',
      '[role="tab"]',
      '[role="menuitem"]',
      'input[type="submit"]',
      'input[type="button"]'
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const text = el.textContent?.trim();
          if (text && text.length > 0 && text.length < 100) {
            items.push({
              text,
              type: el.tagName.toLowerCase() === "a" ? "link" : (el.getAttribute("role") || "button"),
              tag: el.tagName.toLowerCase(),
              ariaLabel: el.getAttribute("aria-label") || null
            });
          }
        }
      });
    }

    // Deduplicate by text+type
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.text}::${item.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

/**
 * Collect dropdown/select elements and their options.
 * Captures both native <select> and custom dropdown menus (listbox, combobox).
 */
async function collectDropdownDetails(page) {
  return page.evaluate(() => {
    const items = [];

    // Native <select> elements
    document.querySelectorAll("select").forEach(sel => {
      const options = Array.from(sel.options).map(opt => ({
        value: opt.value,
        text: opt.textContent?.trim()
      }));
      items.push({
        name: sel.name || sel.id || null,
        text: sel.getAttribute("aria-label") || sel.name || "select",
        type: "dropdown",
        options
      });
    });

    // Custom dropdown menus (listbox pattern)
    document.querySelectorAll('[role="listbox"]').forEach(lb => {
      const options = [];
      lb.querySelectorAll('[role="option"]').forEach(opt => {
        const rect = opt.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          options.push({
            value: opt.getAttribute("data-value") || opt.textContent?.trim(),
            text: opt.textContent?.trim(),
            selected: opt.getAttribute("aria-selected") === "true"
          });
        }
      });
      if (options.length > 0) {
        items.push({
          name: lb.getAttribute("aria-label") || lb.id || null,
          text: lb.getAttribute("aria-label") || "listbox",
          type: "listbox",
          options
        });
      }
    });

    // Combobox inputs (often paired with a hidden listbox)
    document.querySelectorAll('[role="combobox"]').forEach(cb => {
      const listId = cb.getAttribute("aria-controls") || cb.getAttribute("aria-owns");
      const list = listId ? document.getElementById(listId) : null;
      const options = [];
      if (list) {
        list.querySelectorAll('[role="option"]').forEach(opt => {
          options.push({
            value: opt.getAttribute("data-value") || opt.textContent?.trim(),
            text: opt.textContent?.trim()
          });
        });
      }
      items.push({
        name: cb.getAttribute("aria-label") || cb.getAttribute("name") || null,
        text: cb.getAttribute("aria-label") || cb.getAttribute("placeholder") || "combobox",
        type: "combobox",
        options
      });
    });

    return items;
  });
}

/**
 * Collect table structures: column headers, row count, pagination indicators.
 */
async function collectTableDetails(page) {
  return page.evaluate(() => {
    const tables = [];

    document.querySelectorAll("table, [role='grid'], [role='table']").forEach(table => {
      const rect = table.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Extract column headers
      const columns = [];
      const headerRow = table.querySelector("thead tr, [role='row']:first-child");
      if (headerRow) {
        headerRow.querySelectorAll("th, [role='columnheader']").forEach(th => {
          const text = th.textContent?.trim();
          if (text) {
            columns.push({
              text,
              sortable: th.getAttribute("aria-sort") !== null ||
                        th.querySelector("[data-sort], .sortable, button") !== null,
              currentSort: th.getAttribute("aria-sort") || null
            });
          }
        });
      }

      // Count data rows
      const bodyRows = table.querySelectorAll(
        "tbody tr, [role='rowgroup'] [role='row'], [role='row']:not(:first-child)"
      );
      const rowCount = bodyRows.length;

      // Check for pagination
      const tableParent = table.closest("section, div, main") || document.body;
      const paginationEl = tableParent.querySelector(
        '[aria-label*="pagination"], [class*="pagination"], [class*="pager"], nav[aria-label*="page"]'
      );
      const hasPagination = paginationEl !== null;

      // Try to detect page size from pagination text
      let pageInfo = null;
      if (paginationEl) {
        const text = paginationEl.textContent?.trim();
        pageInfo = text?.substring(0, 100) || null;
      }

      tables.push({
        id: table.id || null,
        ariaLabel: table.getAttribute("aria-label") || null,
        columns,
        rowCount,
        hasPagination,
        pageInfo
      });
    });

    return tables;
  });
}

/**
 * Collect form structures: fields, types, required indicators, labels, options.
 */
async function collectFormDetails(page) {
  return page.evaluate(() => {
    const forms = [];

    // Find forms: explicit <form> elements and modal/dialog content areas
    const formContainers = [
      ...document.querySelectorAll("form"),
      ...document.querySelectorAll('[role="dialog"] [class*="form"], [role="dialog"] [class*="content"]'),
      ...document.querySelectorAll('[class*="modal"] [class*="form"], [class*="modal"] [class*="body"]')
    ];

    // Deduplicate: skip containers that are inside another container already found
    const seen = new Set();
    const uniqueContainers = formContainers.filter(el => {
      if (seen.has(el)) return false;
      // Skip if this element is a child of one we already have
      for (const s of seen) {
        if (s.contains(el)) return false;
      }
      seen.add(el);
      return true;
    });

    for (const container of uniqueContainers) {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const fields = [];

      // All input-like elements
      container.querySelectorAll(
        "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], [role='spinbutton']"
      ).forEach(input => {
        const inputRect = input.getBoundingClientRect();
        if (inputRect.width === 0 || inputRect.height === 0) return;

        const field = {
          name: input.name || input.id || null,
          type: input.type || input.tagName.toLowerCase(),
          required: input.required ||
                    input.getAttribute("aria-required") === "true" ||
                    false,
          placeholder: input.placeholder || null,
          pattern: input.pattern || null,
          maxLength: input.maxLength > 0 ? input.maxLength : null,
          minLength: input.minLength > 0 ? input.minLength : null,
          label: null,
          options: null,
          accept: input.accept || null  // For file inputs
        };

        // Find associated label
        const id = input.id;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) {
            field.label = label.textContent?.trim();
            // Check for required indicator in label (asterisk)
            if (!field.required && label.textContent?.includes("*")) {
              field.required = true;
            }
          }
        }
        // Fallback: check parent label or aria-label
        if (!field.label) {
          const parentLabel = input.closest("label");
          if (parentLabel) {
            // Get label text without the input's own text
            const clone = parentLabel.cloneNode(true);
            clone.querySelectorAll("input, select, textarea").forEach(el => el.remove());
            field.label = clone.textContent?.trim() || null;
          }
        }
        if (!field.label) {
          field.label = input.getAttribute("aria-label") || null;
        }

        // Check for required indicator via sibling/parent asterisk
        if (!field.required) {
          const parent = input.closest(".form-group, .field, [class*='field'], [class*='input']");
          if (parent && (parent.querySelector(".required, [class*='required']") ||
                         parent.textContent?.includes("*"))) {
            field.required = true;
          }
        }

        // For select elements, capture options
        if (input.tagName.toLowerCase() === "select") {
          field.options = Array.from(input.options).map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim(),
            selected: opt.selected
          }));
        }

        fields.push(field);
      });

      if (fields.length > 0) {
        // Try to identify the form title
        let title = container.getAttribute("aria-label") || null;
        if (!title) {
          const dialog = container.closest('[role="dialog"], [class*="modal"]');
          if (dialog) {
            const heading = dialog.querySelector(
              '[class*="title"], [class*="header"] h1, [class*="header"] h2, h1, h2, h3'
            );
            title = heading?.textContent?.trim() || null;
          }
        }

        forms.push({
          id: container.id || null,
          title,
          action: container.action || null,
          method: container.method || null,
          fieldCount: fields.length,
          fields
        });
      }
    }

    return forms;
  });
}

/**
 * Collect tab elements.
 */
async function collectTabDetails(page) {
  return page.evaluate(() => {
    const items = [];
    document.querySelectorAll('[role="tab"]').forEach(tab => {
      const rect = tab.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({
          text: tab.textContent?.trim(),
          type: "tab",
          selected: tab.getAttribute("aria-selected") === "true"
        });
      }
    });
    return items;
  });
}

/**
 * Classify an action label into a semantic hint.
 * Returns: create, update, delete, read, navigate, or null (ambiguous).
 */
function inferSemanticHint(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // CREATE patterns
  if (/^(create|add|new|upload|import|submit|insert|clone|copy|duplicate)(\s|$)/.test(lower)) return "create";
  if (/\b(create|add new|upload|import)\b/.test(lower)) return "create";

  // DELETE patterns
  if (/^(delete|remove|trash|archive|discard|destroy)(\s|$)/.test(lower)) return "delete";
  if (/\b(delete|remove all|bulk delete)\b/.test(lower)) return "delete";

  // UPDATE patterns
  if (/^(edit|update|modify|change|rename|set|assign|move|reorder|bulk edit|mark as)(\s|$)/.test(lower)) return "update";
  if (/^(save|apply|confirm|approve|reject|close|reopen|send|forward|return|recall)(\s|$)/.test(lower)) return "update";

  // READ patterns
  if (/^(view|show|open|preview|print|download|export|details|expand|see)(\s|$)/.test(lower)) return "read";
  if (/^(search|filter|sort|find|browse|list|refresh)(\s|$)/.test(lower)) return "read";

  // NAVIGATE patterns
  if (/^(go to|back|next|previous|home|settings|help|log ?out)(\s|$)/.test(lower)) return "navigate";

  return null;
}

/**
 * Apply semantic hints to an array of action objects.
 * Adds `semanticHint` field to each action that has a text label.
 */
function tagSemanticHints(actions) {
  return actions.map(action => ({
    ...action,
    semanticHint: inferSemanticHint(action.text) || inferSemanticHint(action.label)
  }));
}

/**
 * Execute a configured interaction and capture resulting UI elements.
 * Takes a screenshot of the resulting state for each interaction.
 * Returns { actions, forms, urlAfter } with enriched data.
 */
async function executeInteraction(page, interaction, screenshotsDir, pageName) {
  const actions = [];
  let forms = [];
  const urlBefore = page.url();
  const el = await page.$(interaction.selector);

  if (!el) {
    console.warn(`  ⚠️  Selector not found: ${interaction.selector}`);
    return { actions, forms, urlAfter: urlBefore };
  }

  console.log(`  🖱️  ${interaction.description || interaction.type}`);

  const screenshotLabel = sanitizeFilename(
    interaction.description || `${interaction.type}_${Date.now()}`
  );

  switch (interaction.type) {
    case "right-click": {
      await el.click({ button: "right" });
      await sleep(1200);

      // Screenshot the open context menu
      await page.screenshot({
        path: path.join(screenshotsDir, `${pageName}-${screenshotLabel}.png`),
        fullPage: true
      });
      console.log(`     📸 Screenshot: ${pageName}-${screenshotLabel}.png`);

      if (interaction.captureMenuItems) {
        const menuItems = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('[role="menuitem"], [role="option"]').forEach(mi => {
            const rect = mi.getBoundingClientRect();
            if (rect.width && rect.height) {
              items.push({
                text: mi.textContent?.trim(),
                type: "context_menu"
              });
            }
          });
          return items;
        });
        actions.push(...menuItems);
      }

      await page.keyboard.press("Escape");
      await sleep(500);
      break;
    }

    case "double-click": {
      await el.dblclick();
      await sleep(2000);

      // Screenshot the opened modal/detail view
      await page.screenshot({
        path: path.join(screenshotsDir, `${pageName}-${screenshotLabel}.png`),
        fullPage: true
      });
      console.log(`     📸 Screenshot: ${pageName}-${screenshotLabel}.png`);

      if (interaction.captureModalButtons) {
        const modalButtons = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('button, [role="button"]').forEach(btn => {
            const rect = btn.getBoundingClientRect();
            if (rect.width && rect.height) {
              items.push({
                text: btn.textContent?.trim(),
                type: "modal_action"
              });
            }
          });
          return items;
        });
        actions.push(...modalButtons);
      }

      // Capture form structure from the opened modal
      if (interaction.captureModalButtons || interaction.captureForms !== false) {
        forms = await collectFormDetails(page);
        if (forms.length > 0) {
          console.log(`     📋 Captured ${forms.length} form(s) with ${forms.reduce((s, f) => s + f.fieldCount, 0)} fields`);
        }
      }

      await page.keyboard.press("Escape");
      await sleep(800);
      break;
    }

    case "click": {
      await el.click();
      await sleep(interaction.waitMs || 1500);

      // Screenshot the resulting state (form, menu, new page)
      await page.screenshot({
        path: path.join(screenshotsDir, `${pageName}-${screenshotLabel}.png`),
        fullPage: true
      });
      console.log(`     📸 Screenshot: ${pageName}-${screenshotLabel}.png`);

      if (interaction.captureAfterClick) {
        const clickResults = await collectClickableDetails(page);
        actions.push(...clickResults);
      }

      // Capture forms if a dialog/modal appeared or page changed
      if (interaction.captureForms !== false) {
        const clickForms = await collectFormDetails(page);
        if (clickForms.length > 0) {
          forms = clickForms;
          console.log(`     📋 Captured ${forms.length} form(s) with ${forms.reduce((s, f) => s + f.fieldCount, 0)} fields`);
        }
      }

      if (interaction.goBack) {
        await page.goBack();
        await sleep(1500);
      }
      break;
    }

    case "hover": {
      await el.hover();
      await sleep(interaction.waitMs || 1000);

      // Screenshot the hover state (tooltip, dropdown preview)
      await page.screenshot({
        path: path.join(screenshotsDir, `${pageName}-${screenshotLabel}.png`),
        fullPage: true
      });
      console.log(`     📸 Screenshot: ${pageName}-${screenshotLabel}.png`);

      if (interaction.captureTooltip) {
        const tooltips = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('[role="tooltip"], .tooltip, [data-tooltip]').forEach(tt => {
            items.push({
              text: tt.textContent?.trim(),
              type: "tooltip"
            });
          });
          return items;
        });
        actions.push(...tooltips);
      }
      break;
    }

    default:
      console.warn(`  ⚠️  Unknown interaction type: ${interaction.type}`);
  }

  const urlAfter = page.url();
  return { actions, forms, urlAfter };
}

/**
 * Automatically click each tab on the page, capture a screenshot and
 * collect UI inventory for the tab's content.
 * Returns an array of { tabName, screenshot, clickables, tables, forms, dropdowns }.
 */
async function captureAllTabs(page, tabDetails, screenshotsDir, pageName) {
  const tabResults = [];

  if (!tabDetails || tabDetails.length === 0) return tabResults;

  console.log(`   🗂️  Auto-capturing ${tabDetails.length} tab(s)...`);

  for (const tab of tabDetails) {
    const tabText = tab.text;
    if (!tabText || tab.selected) continue; // Skip the already-selected tab

    try {
      // Click the tab
      const tabEl = await page.$(`[role="tab"]:has-text("${tabText}")`);
      if (!tabEl) {
        console.log(`     ⚠️  Tab element not found: "${tabText}"`);
        continue;
      }

      await tabEl.click();
      await sleep(2000);

      const tabLabel = sanitizeFilename(tabText);

      // Screenshot
      const ssPath = path.join(screenshotsDir, `${pageName}-tab-${tabLabel}.png`);
      await page.screenshot({ path: ssPath, fullPage: true });
      console.log(`     📸 Tab screenshot: ${pageName}-tab-${tabLabel}.png`);

      // Collect UI inventory for this tab
      const clickables = await collectClickableDetails(page);
      const tables = await collectTableDetails(page);
      const forms = await collectFormDetails(page);
      const dropdowns = await collectDropdownDetails(page);

      tabResults.push({
        tabName: tabText,
        screenshot: `${pageName}-tab-${tabLabel}.png`,
        clickables: clickables.length,
        tables,
        forms,
        dropdowns: dropdowns.length
      });

      console.log(`     🗂️  Tab "${tabText}": ${clickables.length} clickables, ${tables.length} tables, ${forms.length} forms`);
    } catch (err) {
      console.warn(`     ⚠️  Error capturing tab "${tabText}": ${err.message}`);
    }
  }

  // Click back to the first tab to restore original state
  if (tabDetails.length > 0 && tabDetails[0].text) {
    try {
      const firstTab = await page.$(`[role="tab"]:has-text("${tabDetails[0].text}")`);
      if (firstTab) {
        await firstTab.click();
        await sleep(1000);
      }
    } catch { /* ignore */ }
  }

  return tabResults;
}

/* =========================================================
   NETWORK INTERCEPTION
========================================================= */

/**
 * Set up network request interception on a page.
 * Returns a function to retrieve all captured requests.
 */
function setupNetworkCapture(page) {
  const captured = [];

  // Only capture API-like requests (JSON responses, XHR/fetch)
  page.on("response", async response => {
    const request = response.request();
    const url = request.url();
    const resourceType = request.resourceType();

    // Skip static assets
    if (["image", "stylesheet", "font", "media", "manifest"].includes(resourceType)) {
      return;
    }

    // Skip non-API URLs (static files, analytics, etc.)
    const skipPatterns = [
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?|$)/,
      /google-analytics/,
      /googleapis\.com\/css/,
      /fonts\.googleapis/,
      /segment\.io/,
      /sentry\.io/,
      /hotjar/,
      /intercom/,
      /pendo/,
      /datadog/,
      /launchdarkly/
    ];

    if (skipPatterns.some(p => p.test(url))) {
      return;
    }

    try {
      const status = response.status();
      const headers = response.headers();
      const contentType = headers["content-type"] || "";

      // Focus on JSON API responses
      const isJson = contentType.includes("application/json");
      const isApi = url.includes("/api/") || url.includes("/rest/") || url.includes("/v1/") || url.includes("/v2/");
      const isXhr = resourceType === "xhr" || resourceType === "fetch";

      if (!isJson && !isApi && !isXhr) {
        return;
      }

      const entry = {
        url,
        method: request.method(),
        status,
        contentType,
        resourceType,
        timestamp: new Date().toISOString()
      };

      // Capture request body for mutations (POST, PUT, PATCH, DELETE)
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
        try {
          entry.requestBody = request.postData() || null;
        } catch {
          entry.requestBody = null;
        }
      }

      // Capture response body for JSON responses (with size limit)
      if (isJson && status >= 200 && status < 400) {
        try {
          const body = await response.text();
          if (body.length < 50000) {
            // Parse to extract structure without storing full data
            const parsed = JSON.parse(body);
            entry.responseShape = describeShape(parsed);
            entry.responseSize = body.length;
          } else {
            entry.responseSize = body.length;
            entry.responseShape = "too_large";
          }
        } catch {
          entry.responseShape = "parse_error";
        }
      }

      captured.push(entry);
    } catch {
      // Silently skip failed captures
    }
  });

  return () => captured;
}

/**
 * Describe the shape of a JSON value for API contract inference.
 * Returns a structural description without actual data values.
 */
function describeShape(value, depth = 0) {
  if (depth > 4) return "...";

  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const type = typeof value;
  if (type === "string") return "string";
  if (type === "number") return Number.isInteger(value) ? "integer" : "number";
  if (type === "boolean") return "boolean";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    // Describe shape of first element as representative
    return [describeShape(value[0], depth + 1)];
  }

  if (type === "object") {
    const shape = {};
    for (const [key, val] of Object.entries(value)) {
      shape[key] = describeShape(val, depth + 1);
    }
    return shape;
  }

  return type;
}

/* =========================================================
   MAIN CRAWLER
========================================================= */

async function run() {
  console.log(`🚀 Crawling Procore module: ${config.module}`);
  console.log(`📄 Config: ${CONFIG_PATH}`);
  console.log(`📁 Output: ${MODULE_DIR}`);

  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  /* ================= LOGIN ================= */

  console.log("\n🔐 Logging in...");
  await page.goto("https://login.procore.com/");
  await page.fill('input[type="email"]', PROCORE_EMAIL);
  await page.click('button[type="submit"]');
  await sleep(1500);

  await page.fill('input[type="password"]', PROCORE_PASSWORD);
  await page.click('button[type="submit"]');
  await sleep(6000);

  console.log("✅ Logged in\n");

  /* ================= CRAWL PAGES ================= */

  const allPageResults = [];

  for (const pageConfig of config.pages) {
    const pageName = pageConfig.name;
    let pageUrl = pageConfig.url || config.startUrl;
    const DOM_PAGE_DIR = path.join(MODULE_DIR, "dom", pageName);

    fs.ensureDirSync(DOM_PAGE_DIR);

    console.log(`\n📄 Page: ${pageConfig.label || pageName}`);

    // Set up network capture before navigating
    const getNetworkCapture = setupNetworkCapture(page);

    // Handle special navigation patterns
    if (pageUrl === "__click_first_row__" || pageUrl === "__click_link__") {
      const clickSelector = pageConfig.clickSelector ||
        "tr:has(td), [role='row']:has([role='gridcell']), [data-testid*='row']";
      console.log(`   🖱️  Navigating by clicking: ${clickSelector}`);

      // Always navigate to start URL first so tabs/links are available
      await page.goto(config.startUrl, { waitUntil: "networkidle" });
      await sleep(3000);

      const targetEl = await page.$(clickSelector);
      if (!targetEl) {
        console.warn(`   ⚠️  Selector not found: ${clickSelector} — skipping page`);
        continue;
      }
      await targetEl.click();
      await sleep(3000);
      pageUrl = page.url();
      console.log(`   URL: ${pageUrl}`);
    } else {
      console.log(`   URL: ${pageUrl}`);
      // Navigate
      await page.goto(pageUrl, { waitUntil: "networkidle" });
      await sleep(3000);
    }

    // Screenshot
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${pageName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   📸 Screenshot saved`);

    // DOM
    const dom = await page.content();
    await fs.writeFile(path.join(DOM_PAGE_DIR, "dom.html"), dom);
    console.log(`   📝 DOM saved`);

    // Collect UI inventory
    const clickableDetails = await collectClickableDetails(page);
    const dropdownDetails = await collectDropdownDetails(page);
    const tabDetails = await collectTabDetails(page);
    const tableDetails = await collectTableDetails(page);
    const pageFormDetails = await collectFormDetails(page);

    console.log(`   🔘 Found: ${clickableDetails.length} clickables, ${dropdownDetails.length} dropdowns, ${tabDetails.length} tabs`);
    console.log(`   📊 Found: ${tableDetails.length} table(s), ${pageFormDetails.length} form(s)`);
    if (tableDetails.length > 0) {
      for (const t of tableDetails) {
        console.log(`      Table: ${t.columns.length} columns, ${t.rowCount} rows${t.hasPagination ? " (paginated)" : ""}`);
      }
    }

    // Execute configured interactions
    const interactionActions = [];
    const interactionForms = [];
    const interactionUrls = [];
    if (pageConfig.interactions) {
      console.log(`   🎯 Running ${pageConfig.interactions.length} interaction(s)...`);
      for (const interaction of pageConfig.interactions) {
        try {
          const { actions, forms, urlAfter } = await executeInteraction(
            page, interaction, SCREENSHOTS_DIR, pageName
          );
          interactionActions.push(...actions);
          if (forms.length > 0) {
            interactionForms.push(...forms);
          }
          // Track URL changes from interactions
          if (urlAfter !== pageUrl) {
            interactionUrls.push({
              interaction: interaction.description || interaction.type,
              urlBefore: pageUrl,
              urlAfter
            });
          }
        } catch (err) {
          console.warn(`   ⚠️  Interaction failed: ${interaction.description || interaction.type} — ${err.message}`);
          // Try to recover by pressing Escape and waiting
          try {
            await page.keyboard.press("Escape");
            await sleep(500);
          } catch { /* ignore recovery failure */ }
        }
      }
      console.log(`   ✅ Captured ${interactionActions.length} actions, ${interactionForms.length} forms from interactions`);
      if (interactionUrls.length > 0) {
        console.log(`   🔗 URL changes: ${interactionUrls.length}`);
      }
    }

    // Auto-capture all tabs (screenshot + UI inventory per tab)
    const tabCaptures = await captureAllTabs(
      page, tabDetails, SCREENSHOTS_DIR, pageName
    );

    // Merge page-level forms with interaction-discovered forms (deduplicate by id/title)
    const allForms = [...pageFormDetails];
    for (const form of interactionForms) {
      const isDuplicate = allForms.some(f =>
        (f.id && f.id === form.id) ||
        (f.title && f.title === form.title && f.fieldCount === form.fieldCount)
      );
      if (!isDuplicate) {
        allForms.push(form);
      }
    }

    // Apply semantic hints to all discovered actions
    const taggedClickables = tagSemanticHints(clickableDetails);
    const taggedActions = tagSemanticHints(interactionActions);

    // Build metadata
    const metadata = {
      pageName: pageConfig.label || pageName,
      category: pageConfig.category || config.module,
      url: pageUrl,
      pageId: pageName,
      capturedAt: new Date().toISOString(),
      interactionDriven: (pageConfig.interactions || []).length > 0,
      clickableDetails: taggedClickables,
      dropdownDetails,
      tabDetails,
      tableDetails,
      forms: allForms,
      systemActions: taggedActions,
      interactionUrls: interactionUrls.length > 0 ? interactionUrls : undefined,
      tabCaptures: tabCaptures.length > 0 ? tabCaptures : undefined
    };

    await fs.writeJson(
      path.join(DOM_PAGE_DIR, "metadata.json"),
      metadata,
      { spaces: 2 }
    );

    // Save network capture
    const networkRequests = getNetworkCapture();
    if (networkRequests.length > 0) {
      await fs.writeJson(
        path.join(DOM_PAGE_DIR, "network.json"),
        {
          capturedAt: new Date().toISOString(),
          pageUrl,
          totalRequests: networkRequests.length,
          apiRequests: networkRequests.filter(r =>
            r.contentType?.includes("json") || r.url.includes("/api/")
          ).length,
          mutations: networkRequests.filter(r =>
            ["POST", "PUT", "PATCH", "DELETE"].includes(r.method)
          ).length,
          requests: networkRequests
        },
        { spaces: 2 }
      );
      console.log(`   🌐 Network: ${networkRequests.length} requests captured (${networkRequests.filter(r => ["POST", "PUT", "PATCH", "DELETE"].includes(r.method)).length} mutations)`);
    } else {
      console.log(`   🌐 Network: no API requests captured`);
    }

    allPageResults.push({
      name: pageName,
      label: pageConfig.label || pageName,
      clickables: taggedClickables.length,
      dropdowns: dropdownDetails.length,
      tabs: tabDetails.length,
      tables: tableDetails.length,
      forms: allForms.length,
      formFields: allForms.reduce((s, f) => s + f.fieldCount, 0),
      interactions: taggedActions.length,
      urlChanges: interactionUrls.length,
      networkRequests: networkRequests.length
    });
  }

  /* ================= SUMMARY ================= */

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Crawl Summary: ${config.module}`);
  console.log("=".repeat(50));

  for (const result of allPageResults) {
    console.log(`\n  ${result.label}:`);
    console.log(`    Clickables: ${result.clickables}`);
    console.log(`    Dropdowns: ${result.dropdowns}`);
    console.log(`    Tabs: ${result.tabs}`);
    console.log(`    Tables: ${result.tables}`);
    console.log(`    Forms: ${result.forms} (${result.formFields} fields)`);
    console.log(`    Interaction actions: ${result.interactions}`);
    if (result.urlChanges > 0) {
      console.log(`    URL changes: ${result.urlChanges}`);
    }
    console.log(`    Network requests: ${result.networkRequests}`);
  }

  const totalActions = allPageResults.reduce((sum, r) =>
    sum + r.clickables + r.dropdowns + r.tabs + r.interactions, 0
  );
  const totalTables = allPageResults.reduce((sum, r) => sum + r.tables, 0);
  const totalForms = allPageResults.reduce((sum, r) => sum + r.forms, 0);
  const totalFields = allPageResults.reduce((sum, r) => sum + r.formFields, 0);
  const totalNetwork = allPageResults.reduce((sum, r) => sum + r.networkRequests, 0);

  console.log(`\n  Total: ${allPageResults.length} pages, ${totalActions} UI elements`);
  console.log(`         ${totalTables} tables, ${totalForms} forms (${totalFields} fields)`);
  console.log(`         ${totalNetwork} network requests`);
  console.log("🎉 Crawl complete\n");

  await browser.close();
}

run().catch(err => {
  console.error("🔥 Crawl failed:", err);
  process.exit(1);
});
