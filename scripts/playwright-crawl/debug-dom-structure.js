#!/usr/bin/env node
/**
 * debug-dom-structure.js
 * Dumps the actual DOM structure of Procore pages so we can fix the extractor selectors.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

dotenv.config({ path: join(PROJECT_ROOT, '.env') });

const PROCORE_EMAIL = process.env.PROCORE_USER;
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD;
const CHROME_PATH = '/Users/meganharrison/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function main() {
  const browser = await chromium.launch({ headless: true }).catch(() =>
    chromium.launch({ headless: true, executablePath: existsSync(CHROME_PATH) ? CHROME_PATH : undefined })
  );
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Auth
  await page.goto('https://login.procore.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForSelector('input[name="session[email]"], input[type="email"]', { timeout: 10000 });
    await page.fill('input[name="session[email]"], input[type="email"]', PROCORE_EMAIL);
    const nextBtn = page.locator('button:has-text("Next"), button[type="submit"]');
    if (await nextBtn.count() > 0) { await nextBtn.first().click(); await page.waitForTimeout(2000); }
    await page.fill('input[name="session[password]"], input[type="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
  } catch(e) { console.log('Auth skip:', e.message); }

  const BASE = 'https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools';

  // ── 1. LIST PAGE ──────────────────────────────────────────
  console.log('\n═══ LIST PAGE ═══');
  await page.goto(`${BASE}/change-events/events`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.ag-header-cell, th', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const listDom = await page.evaluate(() => {
    const result = {};

    // AG Grid header structure
    const agRoot = document.querySelector('.ag-root, .ag-root-wrapper');
    if (agRoot) {
      result.agGridFound = true;

      // All header rows
      const headerRows = agRoot.querySelectorAll('.ag-header-row');
      result.headerRowCount = headerRows.length;
      result.headerRowClasses = Array.from(headerRows).map(r => r.className);

      // Group cells
      const groupCells = agRoot.querySelectorAll('.ag-header-group-cell');
      result.groupCellCount = groupCells.length;
      result.groupCells = Array.from(groupCells).map(c => ({
        text: c.textContent.trim().slice(0, 80),
        className: c.className.slice(0, 120),
        ariaColspan: c.getAttribute('aria-colspan'),
        childCount: c.children.length,
        innerHTML: c.innerHTML.slice(0, 200),
      }));

      // Leaf header cells
      const leafCells = agRoot.querySelectorAll('.ag-header-cell');
      result.leafCellCount = leafCells.length;
      result.leafCells = Array.from(leafCells).slice(0, 20).map(c => ({
        text: c.textContent.trim().slice(0, 50),
        className: c.className.slice(0, 120),
        colId: c.getAttribute('col-id'),
      }));

      // Check for specific row classes
      result.hasColumnGroups = !!agRoot.querySelector('.ag-header-row-column-group');
      result.hasColumnGroupsDash = !!agRoot.querySelector('.ag-header-row--column-group');
      result.hasColumnGroupsPlural = !!agRoot.querySelector('.ag-header-row--column-groups');
      result.hasColumnRow = !!agRoot.querySelector('.ag-header-row-column');
      result.hasColumnRowDash = !!agRoot.querySelector('.ag-header-row--column');
      result.hasColumnRowDashPlural = !!agRoot.querySelector('.ag-header-row--columns');
    } else {
      result.agGridFound = false;
      // Check for regular tables
      const table = document.querySelector('table');
      result.tableFound = !!table;
      if (table) {
        result.tableHeaderRows = table.querySelectorAll('thead tr').length;
        result.tableHeaders = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim().slice(0, 50));
      }
    }

    return result;
  });

  console.log(JSON.stringify(listDom, null, 2));

  // ── 2. CREATE FORM ──────────────────────────────────────────
  console.log('\n═══ CREATE FORM ═══');
  // Look for create button
  const createClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, a, [role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent.trim();
      if (/create/i.test(text)) {
        btn.click();
        return 'Clicked: ' + text;
      }
    }
    return 'No create button found';
  });
  console.log('Create button:', createClicked);
  await page.waitForTimeout(3000);

  const formDom = await page.evaluate(() => {
    const result = {};

    // Find all forms
    const forms = document.querySelectorAll('form');
    result.formCount = forms.length;

    // Find ALL input-like elements on the page
    const inputs = document.querySelectorAll(
      'input, textarea, select, [role="combobox"], [role="listbox"], [role="switch"], ' +
      '[contenteditable="true"], [data-react-toolbox*="input"], [class*="input"], [class*="select"]'
    );
    result.inputCount = inputs.length;
    result.inputs = Array.from(inputs).slice(0, 30).map(el => ({
      tag: el.tagName,
      type: el.type || el.getAttribute('role') || '',
      name: el.name || '',
      id: el.id || '',
      className: el.className ? String(el.className).slice(0, 80) : '',
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.placeholder || '',
      parentTag: el.parentElement ? el.parentElement.tagName : '',
      parentClass: el.parentElement ? String(el.parentElement.className).slice(0, 60) : '',
    }));

    // Find labels
    const labels = document.querySelectorAll('label, [class*="label"], [class*="Label"]');
    result.labelCount = labels.length;
    result.labels = Array.from(labels).slice(0, 30).map(l => ({
      text: l.textContent.trim().slice(0, 50),
      htmlFor: l.getAttribute('for') || '',
      className: String(l.className).slice(0, 80),
    }));

    // Find sections/fieldsets
    const sections = document.querySelectorAll('fieldset, [class*="section"], [class*="Section"], [class*="group"], [class*="Group"]');
    result.sectionCount = sections.length;
    result.sections = Array.from(sections).slice(0, 10).map(s => ({
      tag: s.tagName,
      className: String(s.className).slice(0, 100),
      text: s.textContent.trim().slice(0, 80),
    }));

    return result;
  });

  console.log(JSON.stringify(formDom, null, 2));

  // ── 3. DETAIL PAGE ──────────────────────────────────────────
  console.log('\n═══ DETAIL PAGE ═══');
  // Go back to list and click first row
  await page.goto(`${BASE}/change-events/events`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.ag-row, tr', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Click first row
  const clicked = await page.evaluate(() => {
    const row = document.querySelector('.ag-row');
    if (row) { row.click(); return 'clicked ag-row'; }
    const link = document.querySelector('a[href*="events/"]');
    if (link) { link.click(); return 'clicked link'; }
    return 'nothing clicked';
  });
  console.log('Row click:', clicked);
  await page.waitForTimeout(3000);
  console.log('Detail URL:', page.url());

  const detailDom = await page.evaluate(() => {
    const result = {};

    // Find tab-like elements
    const tabSelectors = [
      '[role="tab"]',
      '[role="tablist"] *',
      'nav a',
      'nav button',
      '[class*="tab"]',
      '[class*="Tab"]',
      'a[class*="nav"]',
      'a[class*="Nav"]',
    ];

    for (const sel of tabSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        result['tabs_' + sel] = Array.from(els)
          .map(e => e.textContent.trim().slice(0, 60))
          .filter(t => t.length > 0 && t.length < 60);
      }
    }

    // Find any horizontal nav/menu near top of content area
    const topNavEls = document.querySelectorAll(
      '[class*="header"] a, [class*="header"] button, ' +
      '[class*="subnav"] a, [class*="Subnav"] a, ' +
      '[class*="menu"] a, [class*="Menu"] a'
    );
    result.topNavItems = Array.from(topNavEls)
      .map(e => e.textContent.trim())
      .filter(t => t.length > 0 && t.length < 60)
      .slice(0, 20);

    // Check for section headers
    const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="Heading"]');
    result.sectionHeaders = Array.from(headers)
      .map(h => ({ tag: h.tagName, text: h.textContent.trim().slice(0, 80) }))
      .slice(0, 15);

    // Find form fields on detail page
    const inputs = document.querySelectorAll('input, textarea, select, [role="combobox"]');
    result.detailInputCount = inputs.length;

    return result;
  });

  console.log(JSON.stringify(detailDom, null, 2));

  await browser.close();
  console.log('\n✅ Debug complete');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
