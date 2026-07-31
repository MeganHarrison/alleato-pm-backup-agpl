#!/usr/bin/env node
/**
 * procore-deep-crawl.js
 * Systematically crawls a Procore feature through every page state and produces
 * a structured manifest.json that agents can check field-by-field.
 *
 * Usage:
 *   node procore-deep-crawl.js <feature>
 *   node procore-deep-crawl.js change-events
 *   node procore-deep-crawl.js prime-contracts
 *
 * Output:
 *   .claude/procore-manifests/<feature>/manifest.json
 *   .claude/procore-manifests/<feature>/screenshots/<state-id>.png
 *
 * Credentials: loaded automatically from .env (PROCORE_USER, PROCORE_PASSWORD)
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import dotenv from 'dotenv';
import { getFeature } from './lib/feature-registry.js';
import { extractPageData } from './lib/extract-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

// Load credentials
dotenv.config({ path: join(PROJECT_ROOT, '.env') });

const PROCORE_EMAIL = process.env.PROCORE_USER;
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD;

if (!PROCORE_EMAIL || !PROCORE_PASSWORD) {
  console.error('❌ Missing PROCORE_USER or PROCORE_PASSWORD in .env');
  process.exit(1);
}

const featureName = process.argv[2];
if (!featureName) {
  console.error('Usage: node procore-deep-crawl.js <feature>');
  console.error('Available features: change-events, prime-contracts, commitments, budget, direct-costs, invoicing, meetings, rfis, drawings, specifications, punch-list');
  process.exit(1);
}

let feature;
try {
  feature = getFeature(featureName);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}

const OUTPUT_DIR = join(PROJECT_ROOT, '.claude/procore-manifests', featureName);
const SCREENSHOTS_DIR = join(OUTPUT_DIR, 'screenshots');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────

async function authenticate(page) {
  console.log('🔐 Authenticating with Procore...');

  await page.goto('https://login.procore.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Handle login form
  if (page.url().includes('login.procore.com') || page.url().includes('/login')) {
    try {
      await page.waitForSelector('input[name="session[email]"], input[type="email"], input[name="email"]', { timeout: 10000 });

      await page.fill(
        'input[name="session[email]"], input[type="email"], input[name="email"]',
        PROCORE_EMAIL
      );

      // Some Procore login flows have a "Next" button before password
      const nextBtn = page.locator('button:has-text("Next"), button[type="submit"]:has-text("Continue")');
      if (await nextBtn.count() > 0) {
        await nextBtn.first().click();
        await page.waitForTimeout(2000);
      }

      await page.fill(
        'input[name="session[password]"], input[type="password"], input[name="password"]',
        PROCORE_PASSWORD
      );

      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);

      // Wait for redirect to the app
      await page.waitForFunction(
        () => !window.location.href.includes('login.procore.com'),
        { timeout: 15000 }
      ).catch(() => {
        console.warn('⚠️  Auth may still be in progress — continuing anyway');
      });
    } catch (e) {
      console.warn('⚠️  Login form not found or already authenticated:', e.message);
    }
  }

  console.log(`✅ Auth complete. Current URL: ${page.url()}`);
}

async function navigateToUrl(page, url) {
  let lastUrl = page.url();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Handle possible login redirect
  if (page.url().includes('login.procore.com')) {
    await authenticate(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  await page.waitForTimeout(2000); // Let JS render
}

async function captureState(page, state, detailPage = null) {
  console.log(`\n📸 Capturing state: ${state.id} — ${state.description}`);

  const result = {
    id: state.id,
    description: state.description,
    url: '',
    columnGroups: [],
    columns: [],
    toolbarActions: [],
    filters: [],
    rowActions: [],
    autoRows: [],
    formSections: [],
    tabs: [],
    headerFields: [],
    screenshot: `screenshots/${state.id}.png`,
    _capture_note: '',
  };

  try {
    if (state.type === 'list') {
      // Direct navigation
      await navigateToUrl(page, state.url);
      if (state.waitFor) {
        await page.waitForSelector(state.waitFor, { timeout: 15000 }).catch(() => {
          result._capture_note = `waitFor selector not found: ${state.waitFor}`;
        });
      }
      // Wait for AG Grid rows OR table rows to appear (indicates data loaded)
      await page.waitForSelector(
        '.ag-row, .ag-header-cell, tr[role="row"], tbody tr',
        { timeout: 10000 }
      ).catch(() => {});
      await page.waitForTimeout(2000); // Extra time for all columns to render

    } else if (state.type === 'create-form') {
      // Navigate to list first, then click create button
      await navigateToUrl(page, state.url);
      await page.waitForSelector('.ag-row, tr[role="row"], tbody tr', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Try registry selectors first
      const selectors = state.selector.split(', ');
      let clicked = false;
      for (const sel of selectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.count() > 0) {
            await btn.click();
            clicked = true;
            break;
          }
        } catch {}
      }

      // Fallback: find any primary "Create" button by text
      if (!clicked) {
        clicked = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button, [role="button"], a[href*="new"]');
          for (const btn of buttons) {
            const text = btn.textContent.trim();
            if (/^create\b/i.test(text) || /^new\b/i.test(text) || /^add\b/i.test(text)) {
              btn.click();
              return true;
            }
          }
          return false;
        });
      }

      if (!clicked) {
        result._capture_note = `Create button not found. Tried: ${state.selector}`;
        console.warn(`  ⚠️  ${result._capture_note}`);
      } else {
        if (state.waitFor) {
          await page.waitForSelector(state.waitFor, { timeout: 10000 }).catch(() => {});
        }
        await page.waitForTimeout(1500);
      }

    } else if (state.type === 'detail') {
      // Navigate to list, then click first record's link to open detail
      await navigateToUrl(page, state.url);
      await page.waitForSelector('.ag-row, tr[role="row"], tbody tr', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(3000);

      // Strategy: find a clickable link or title cell in the first data row
      let clicked = false;

      // Try clicking a link inside the first AG Grid row
      const linkInRow = page.locator('.ag-row:first-child a[href]').first();
      if (await linkInRow.count() > 0) {
        await linkInRow.click();
        clicked = true;
      }

      // Fallback: try the first cell with a link-like behavior
      if (!clicked) {
        clicked = await page.evaluate(() => {
          // Find links in AG Grid rows
          var links = document.querySelectorAll('.ag-row a[href], .ag-row [class*="link"], .ag-row [data-clickable]');
          if (links.length > 0) { links[0].click(); return true; }
          // Try clicking the title/name cell (usually second cell, first is checkbox)
          var cells = document.querySelectorAll('.ag-row:first-child .ag-cell');
          for (var i = 0; i < cells.length; i++) {
            var text = cells[i].textContent.trim();
            // Skip cells that look like checkboxes or numbers
            if (text.length > 3 && !/^\d+$/.test(text) && !/^[$]/.test(text)) {
              cells[i].click();
              return true;
            }
          }
          return false;
        });
      }

      // Fallback: try registry selectors
      if (!clicked) {
        const selectors = state.selector.split(', ');
        for (const sel of selectors) {
          try {
            const row = page.locator(sel).first();
            if (await row.count() > 0) {
              await row.click();
              clicked = true;
              break;
            }
          } catch {}
        }
      }

      if (!clicked) {
        result._capture_note = `No detail row found. The list may be empty or the selector didn't match. Tried: ${state.selector}`;
        console.warn(`  ⚠️  ${result._capture_note}`);
      } else {
        if (state.waitFor) {
          await page.waitForSelector(state.waitFor, { timeout: 10000 }).catch(() => {});
        }
        await page.waitForTimeout(2000);
        // Save the detail page URL for tab states to reuse
        return { page, capturedUrl: page.url(), result };
      }

    } else if (state.type === 'detail-tab') {
      // We should already be on the detail page (passed as detailPage URL)
      if (detailPage) {
        if (page.url() !== detailPage) {
          await navigateToUrl(page, detailPage);
          await page.waitForTimeout(2000);
        }
      }

      // Find the tab by text content — try multiple selector approaches
      const tabText = state.description.split('— ').pop().trim(); // e.g. "Line Items tab" → "Line Items"
      const tabLabel = tabText.replace(' tab', '');

      // Debug: list all tab-like elements to help tune selectors
      const foundTabs = await page.evaluate((label) => {
        const candidates = document.querySelectorAll(
          '[role="tab"], [role="tablist"] *, nav a, nav button, ' +
          '[class*="tab"] a, [class*="tab"] button, [class*="Tab"] a, [class*="Tab"] button'
        );
        return Array.from(candidates)
          .map(el => el.textContent.trim())
          .filter(t => t.length > 0 && t.length < 50);
      }, tabLabel);

      if (foundTabs.length > 0) {
        console.log(`  📑 Found tab candidates: ${foundTabs.slice(0, 10).join(', ')}`);
      }

      // Try clicking by exact tab label text
      const tabClicked = await page.evaluate((label) => {
        const candidates = document.querySelectorAll(
          '[role="tab"], [role="tablist"] *, nav a, nav button, ' +
          '[class*="tab"] a, [class*="tab"] button, [class*="Tab"] a, [class*="Tab"] button'
        );
        for (const el of candidates) {
          if (el.textContent.trim() === label || el.textContent.trim().startsWith(label)) {
            el.click();
            return true;
          }
        }
        return false;
      }, tabLabel);

      let clicked = tabClicked;

      // Fallback: try playwright selectors
      if (!clicked) {
        const selectors = state.selector.split(', ');
        for (const sel of selectors) {
          try {
            const tab = page.locator(sel).first();
            if (await tab.count() > 0) {
              await tab.click();
              clicked = true;
              break;
            }
          } catch {}
        }
      }

      if (!clicked) {
        result._capture_note = `Tab "${tabLabel}" not found. Available tabs: ${foundTabs.slice(0,8).join(', ')}`;
        console.warn(`  ⚠️  ${result._capture_note}`);
      } else {
        if (state.waitFor) {
          await page.waitForSelector(state.waitFor, { timeout: 8000 }).catch(() => {});
        }
        await page.waitForTimeout(1500);
      }
    }

    // ── SAVE RAW DOM HTML (always, before extraction) ────────────────────────
    const domDir = join(OUTPUT_DIR, 'dom');
    mkdirSync(domDir, { recursive: true });
    const rawHtml = await page.content();
    writeFileSync(join(domDir, `${state.id}.html`), rawHtml);
    console.log(`  💾 Saved DOM: dom/${state.id}.html (${Math.round(rawHtml.length / 1024)}KB)`);

    // Extract structured data from DOM
    const extracted = await page.evaluate(extractPageData, {
      id: state.id,
      description: state.description,
    });

    // Merge extracted data into result
    Object.assign(result, extracted);
    result.screenshot = `screenshots/${state.id}.png`;
    result.domFile = `dom/${state.id}.html`;

    // Take screenshot
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `${state.id}.png`),
      fullPage: true,
    });

    console.log(`  ✅ Columns: ${result.columns.length}, Forms: ${result.formSections.length}, Actions: ${result.toolbarActions.length}`);

  } catch (error) {
    result._capture_note = `Error during capture: ${error.message}`;
    console.error(`  ❌ Capture error: ${error.message}`);

    // Still take a screenshot for debugging
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `${state.id}-error.png`),
      fullPage: true,
    }).catch(() => {});
    result.screenshot = `screenshots/${state.id}-error.png`;
  }

  return { page, capturedUrl: page.url(), result };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Procore Deep Crawl — ${feature.name}`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   States to capture: ${feature.states.length}\n`);

  // Try default playwright chromium first, fall back to the locally installed Chrome for Testing
  const CHROME_FOR_TESTING = '/Users/meganharrison/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const { existsSync: _existsSync } = await import('fs');
  const browser = await chromium.launch({ headless: true }).catch(() =>
    chromium.launch({
      headless: true,
      executablePath: _existsSync(CHROME_FOR_TESTING) ? CHROME_FOR_TESTING : undefined,
    })
  );
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const manifest = {
    feature: featureName,
    featureName: feature.name,
    capturedAt: new Date().toISOString(),
    states: {},
  };

  let detailPageUrl = null; // URL of opened detail page, for tab states

  try {
    // Initial authentication
    await authenticate(page);

    for (const state of feature.states) {
      const detailUrl = state.type === 'detail-tab' ? detailPageUrl : null;
      const { capturedUrl, result } = await captureState(page, state, detailUrl);

      // If this was a detail state, save its URL for subsequent tab states
      if (state.type === 'detail' && !result._capture_note) {
        detailPageUrl = capturedUrl;
        console.log(`  📌 Detail page URL saved: ${detailPageUrl}`);
      }

      manifest.states[state.id] = result;
    }

  } finally {
    await browser.close();
  }

  // Write manifest
  const manifestPath = join(OUTPUT_DIR, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✅ Manifest written to: ${manifestPath}`);

  // Print summary
  console.log('\n── SUMMARY ──────────────────────────────────────────────────');
  for (const [stateId, stateData] of Object.entries(manifest.states)) {
    const status = stateData._capture_note ? '⚠️ ' : '✅';
    console.log(`${status} ${stateId}`);
    if (stateData.columns.length) console.log(`   Columns: ${stateData.columns.map(c => c.label).join(', ')}`);
    if (stateData.formSections.length) {
      const fieldCount = stateData.formSections.reduce((n, s) => n + s.fields.length, 0);
      console.log(`   Form fields: ${fieldCount}`);
    }
    if (stateData.toolbarActions.length) console.log(`   Actions: ${stateData.toolbarActions.map(a => a.label).join(', ')}`);
    if (stateData.autoRows.length) console.log(`   Auto-rows: ${stateData.autoRows.map(r => r.label).join(', ')}`);
    if (stateData._capture_note) console.log(`   NOTE: ${stateData._capture_note}`);
  }

  console.log('\n📋 Next steps:');
  console.log(`   Review screenshots in: ${SCREENSHOTS_DIR}`);
  console.log(`   Check manifest.json for any states with _capture_note`);
  console.log(`   Run: /procore-gap-audit ${featureName}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
