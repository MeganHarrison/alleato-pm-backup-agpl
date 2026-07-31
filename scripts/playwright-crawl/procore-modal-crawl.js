#!/usr/bin/env node
/**
 * procore-modal-crawl.js
 *
 * For each page in a tool, discovers every clickable cell/button/link and,
 * when clicking it opens a modal/sheet/drawer, captures:
 *   - screenshot (full page + modal-only crop if detectable)
 *   - DOM snapshot of the modal
 *   - structured field list (label, type, options, required, help text)
 *   - action buttons
 *   - title
 *
 * Output:
 *   .claude/procore-manifests/<tool>/modals/<page-id>/<modal-id>.png
 *   .claude/procore-manifests/<tool>/modals/<page-id>/<modal-id>.html
 *   .claude/procore-manifests/<tool>/modals.json        (merged summary)
 *
 * Usage:
 *   node procore-modal-crawl.js budget
 *   node procore-modal-crawl.js budget commitments rfis change-events invoicing
 *   node procore-modal-crawl.js --all
 *
 * Env: PROCORE_USER, PROCORE_PASSWORD required (loaded from ../../.env)
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';
import { MODAL_CONFIGS, ALL_TOOLS } from './lib/modal-configs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
dotenv.config({ path: join(PROJECT_ROOT, '.env') });

const PROCORE_EMAIL = process.env.PROCORE_USER;
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD;
if (!PROCORE_EMAIL || !PROCORE_PASSWORD) {
  console.error('❌ Missing PROCORE_USER or PROCORE_PASSWORD in .env');
  process.exit(1);
}

// ─── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let tools = [];
if (argv.includes('--all')) {
  tools = ALL_TOOLS;
} else if (argv.length === 0) {
  console.error('Usage: node procore-modal-crawl.js <tool> [tool...] | --all');
  console.error('Available tools: ' + ALL_TOOLS.join(', '));
  process.exit(1);
} else {
  tools = argv.filter((a) => !a.startsWith('--'));
  for (const t of tools) {
    if (!MODAL_CONFIGS[t]) {
      console.error(`❌ Unknown tool: ${t}. Available: ${ALL_TOOLS.join(', ')}`);
      process.exit(1);
    }
  }
}

// ─── auth ────────────────────────────────────────────────────────────────────
async function authenticate(page) {
  console.log('🔐 Authenticating with Procore...');
  await page.goto('https://login.procore.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (page.url().includes('login.procore.com') || page.url().includes('/login')) {
    try {
      await page.waitForSelector(
        'input[name="session[email]"], input[type="email"], input[name="email"]',
        { timeout: 10000 }
      );
      await page.fill(
        'input[name="session[email]"], input[type="email"], input[name="email"]',
        PROCORE_EMAIL
      );
      const nextBtn = page.locator(
        'button:has-text("Next"), button[type="submit"]:has-text("Continue")'
      );
      if ((await nextBtn.count()) > 0) {
        await nextBtn.first().click();
        await page.waitForTimeout(2000);
      }
      await page.fill(
        'input[name="session[password]"], input[type="password"], input[name="password"]',
        PROCORE_PASSWORD
      );
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      await page
        .waitForFunction(() => !window.location.href.includes('login.procore.com'), {
          timeout: 15000,
        })
        .catch(() => {});
    } catch (e) {
      console.warn('⚠️  Login form handling:', e.message);
    }
  }
  console.log(`✅ Auth complete: ${page.url()}`);
}

// ─── modal detection ─────────────────────────────────────────────────────────
// Procore's actual side-panel: div.StyledSplitViewCardAside-...  (confirmed via debug-budget-click.js)
// Also their top-level dialogs use StyledPanel-* classes.
const MODAL_SELECTORS = [
  // Procore primary patterns (confirmed)
  '[class*="SplitViewCardAside" i]',
  '[class*="StyledPanel"]:not([aria-hidden="true"])',
  '[class*="SplitView" i][class*="Aside" i]',
  // Generic fallbacks
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[data-state="open"][role="dialog"]',
  '.MuiDialog-root:not([aria-hidden="true"])',
  '.MuiDrawer-root:not([aria-hidden="true"])',
  '[class*="Modal__root"]:not([aria-hidden="true"])',
  '[class*="sidepanel" i]:not([aria-hidden="true"])',
  '[class*="sideSheet" i]',
  '[class*="drawer" i][class*="open" i]',
  '[data-qa*="modal"]',
  '[data-qa*="drawer"]',
  '[data-qa*="side-panel"]',
];

// Snapshot panels currently visible — used to diff against post-click state
async function snapshotPanelKeys(page) {
  const result = await page.evaluate((selectors) => {
    const keys = [];
    const seen = new Set();
    for (const sel of selectors) {
      let nodes;
      try { nodes = document.querySelectorAll(sel); } catch { continue; }
      nodes.forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        if (r.width < 300 || r.height < 200) return;
        if (r.x < 50 && r.width > 1300) return;
        const cls = (typeof el.className === 'string' ? el.className : '').slice(0, 60);
        keys.push(`${el.tagName}|${Math.round(r.x)}|${Math.round(r.y)}|${Math.round(r.width)}|${Math.round(r.height)}|${cls}`);
      });
    }
    return keys;
  }, MODAL_SELECTORS);
  return new Set(result);
}

async function findNewModal(page, baselineKeys) {
  for (const sel of MODAL_SELECTORS) {
    const handles = await page.$$(sel);
    for (const h of handles) {
      const visible = await h.isVisible().catch(() => false);
      if (!visible) continue;
      const box = await h.boundingBox().catch(() => null);
      if (!box) continue;
      if (box.width < 300 || box.height < 200) continue;
      if (box.x < 50 && box.width > 1300) continue;
      const cls = (await h.evaluate((el) => (typeof el.className === 'string' ? el.className : '').slice(0, 60))).toString();
      const key = `${(await h.evaluate((el) => el.tagName))}|${Math.round(box.x)}|${Math.round(box.y)}|${Math.round(box.width)}|${Math.round(box.height)}|${cls}`;
      if (baselineKeys.has(key)) continue; // pre-existing panel; not a new modal
      return { handle: h, selector: sel, box, key };
    }
  }
  return null;
}

async function closeModal(page, baselineKeys) {
  // Strategy: try multiple close mechanisms in sequence and keep going
  // until findNewModal returns null. Procore side-panels close via:
  //   1. The X button in the panel header (StyledIconButton with X icon)
  //   2. Escape key
  //   3. Click outside the panel area
  for (let attempt = 0; attempt < 4; attempt++) {
    const open = await findNewModal(page, baselineKeys);
    if (!open) return true;

    // Try X close button INSIDE the modal first
    const closed = await open.handle.evaluate((root) => {
      const candidates = [
        ...root.querySelectorAll('button[aria-label*="lose" i]'),
        ...root.querySelectorAll('button[data-qa*="close" i]'),
        ...root.querySelectorAll('button[title*="lose" i]'),
      ];
      // Also: Procore uses StyledIconButton with an X svg, no aria-label.
      // Find buttons in the top-right of the panel that contain only an SVG.
      const r = root.getBoundingClientRect();
      root.querySelectorAll('button').forEach((b) => {
        const br = b.getBoundingClientRect();
        // top-right area of panel
        if (br.x > r.x + r.width - 80 && br.y < r.y + 80 && br.width < 60 && br.height < 60) {
          if (b.querySelector('svg') && (b.textContent || '').trim().length === 0) {
            candidates.push(b);
          }
        }
      });
      for (const c of candidates) {
        try { c.click(); return true; } catch {}
      }
      return false;
    }).catch(() => false);

    if (closed) {
      await page.waitForTimeout(500);
      continue;
    }

    // Fallback: Escape
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    const stillOpen = await findNewModal(page, baselineKeys);
    if (!stillOpen) return true;

    // Last resort: click far left of viewport
    await page.mouse.click(5, 400).catch(() => {});
    await page.waitForTimeout(400);
  }
  return false;
}

// ─── candidate discovery (runs in browser) ──────────────────────────────────
// Strategy: prioritize the proven trigger types (anchor inside ag-cell, top
// toolbar buttons), then dedupe smartly so we don't click "$ 0.00" 60 times
// when one click per (column × row-type) is enough.
function discoverTriggers() {
  const results = [];
  const seen = new Set();

  function push(el, kind, opts = {}) {
    if (!el || seen.has(el)) return;
    seen.add(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const label = (el.textContent || '').trim().slice(0, 80);
    const ariaLabel = el.getAttribute('aria-label') || '';
    const tag = el.tagName.toLowerCase();
    const id = el.getAttribute('id') || '';
    const classes = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 120);
    const role = el.getAttribute('role') || '';
    const qa = el.getAttribute('data-qa') || el.getAttribute('data-testid') || '';
    const cell = el.closest('[col-id]');
    const colId = cell?.getAttribute('col-id') || el.getAttribute('col-id') || '';
    const rowEl = el.closest('[row-index]');
    const rowIndex = rowEl?.getAttribute('row-index') || '';
    results.push({
      kind, label, ariaLabel, tag, id, classes, role, qa, colId, rowIndex,
      priority: opts.priority || 5,
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
    });
  }

  // ── PRIORITY 1: Anchor links inside ag-cells (the proven Procore trigger pattern)
  document.querySelectorAll('.ag-cell a[href], .ag-cell [role="link"]').forEach((a) => {
    push(a, 'cell-link', { priority: 1 });
  });

  // ── PRIORITY 2: Top action buttons (toolbar / page header)
  document.querySelectorAll('button').forEach((b) => {
    if (b.disabled) return;
    const r = b.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    // Top toolbar = y < 200px, real page area
    if (r.y > 200) return;
    const text = (b.textContent || '').trim();
    const aria = b.getAttribute('aria-label') || '';
    if (!text && !aria) return;
    // Skip nav chrome
    if (/^(sign in|sign out|log out|profile|notifications)$/i.test(text)) return;
    if (/PicketTrigger|tool-picker|nav-bar/i.test(b.id || '')) return;
    push(b, 'toolbar-button', { priority: 2 });
  });

  // ── PRIORITY 3: Row-level action menus (kebab/ellipsis)
  document.querySelectorAll('button[aria-label*="action" i], button[aria-label*="more" i], [data-qa*="kebab"]').forEach((b) => {
    push(b, 'row-action', { priority: 3 });
  });

  // ── PRIORITY 4: Other clickable ag-cells (cursor:pointer, no anchor child)
  document.querySelectorAll('.ag-cell').forEach((cell) => {
    if (cell.querySelector('a[href]')) return; // already captured at priority 1
    const cs = getComputedStyle(cell);
    if (cs.cursor !== 'pointer') return;
    const text = (cell.textContent || '').trim();
    if (!text) return;
    push(cell, 'ag-cell-clickable', { priority: 4 });
  });

  // ── PRIORITY 5: Tabs and headers
  document.querySelectorAll('[role="tab"], .ag-header-cell[col-id]').forEach((el) => {
    push(el, 'header-or-tab', { priority: 5 });
  });

  return results;
}

// ─── trigger dedup (runs in node) ────────────────────────────────────────────
// Goal: capture each *kind of modal* once, not every cell that opens the same
// kind of panel. Dedup key = (priority, kind, colId, label-shape).
// label-shape collapses "$ 1,234", "$ 0.00", "($ 5)" → "$NUM" so all money
// cells in the same column dedupe to one.
function dedupeTriggers(triggers) {
  const labelShape = (s) => {
    if (!s) return '';
    if (/^\(?\$\s?[\d,.()]+\)?$/.test(s)) return '$NUM';
    if (/^\d+([.,]\d+)?$/.test(s)) return 'NUM';
    return s.slice(0, 60).toLowerCase().replace(/\s+/g, ' ').trim();
  };
  const out = [];
  const seenKeys = new Set();
  for (const t of triggers.sort((a, b) => a.priority - b.priority)) {
    const key = [
      t.priority,
      t.kind,
      t.colId || '',
      labelShape(t.label || t.ariaLabel),
    ].join('|');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    out.push(t);
  }
  return out;
}

// ─── modal extraction (runs in browser, scoped to the modal element) ───────
function extractModalDataFromEl(root) {
  function textOf(el) {
    if (!el) return '';
    return (el.textContent || '').trim().replace(/\s+/g, ' ');
  }
  const title =
    textOf(root.querySelector('[role="heading"], h1, h2, h3, [class*="title" i], [class*="Title" i]')) ||
    textOf(root.querySelector('header')) ||
    '';

  // fields
  const fields = [];
  const pushField = (obj) => fields.push(obj);
  root
    .querySelectorAll('label, [class*="Label"], [class*="label"]')
    .forEach((lbl) => {
      const text = textOf(lbl);
      if (!text || text.length > 120) return;
      // Try to find associated input
      const forId = lbl.getAttribute('for');
      let input = null;
      if (forId) input = root.querySelector(`#${CSS.escape(forId)}`);
      if (!input) input = lbl.querySelector('input, textarea, select');
      if (!input) {
        // Find next sibling input within parent
        const parent = lbl.closest('div, section, fieldset') || lbl.parentElement;
        if (parent) input = parent.querySelector('input, textarea, select');
      }
      const type = input?.tagName.toLowerCase() === 'select'
        ? 'select'
        : input?.tagName.toLowerCase() === 'textarea'
        ? 'textarea'
        : input?.type || 'unknown';
      const required = !!(input?.required || lbl.querySelector('.required, [class*="required" i]'));
      const value = input?.value || input?.textContent?.trim() || '';
      const options = [];
      if (input?.tagName.toLowerCase() === 'select') {
        input.querySelectorAll('option').forEach((o) =>
          options.push({ value: o.value, label: o.textContent.trim() })
        );
      }
      pushField({ label: text, type, required, value, options });
    });

  // also capture read-only display rows (e.g. "Line Item: Metals")
  const readOnlyRows = [];
  root
    .querySelectorAll('[class*="Row"], [class*="row"], dl > *, [class*="Field" i]')
    .forEach((el) => {
      const text = textOf(el);
      if (text.length < 2 || text.length > 250) return;
      // skip if it contains an input (handled above)
      if (el.querySelector('input, textarea, select')) return;
      readOnlyRows.push(text);
    });

  // action buttons (bottom of modal)
  const actions = [];
  root.querySelectorAll('button').forEach((b) => {
    if (b.disabled) return;
    const label = textOf(b);
    const aria = b.getAttribute('aria-label') || '';
    if (!label && !aria) return;
    actions.push({
      label: label || aria,
      variant: b.className.includes('primary')
        ? 'primary'
        : b.className.includes('destructive') || b.className.includes('danger')
        ? 'destructive'
        : 'secondary',
    });
  });

  // tabs inside modal
  const tabs = [];
  root.querySelectorAll('[role="tab"]').forEach((t) => {
    tabs.push({
      label: textOf(t),
      active: t.getAttribute('aria-selected') === 'true',
    });
  });

  return { title, fields, readOnlyRows: readOnlyRows.slice(0, 20), actions, tabs };
}

// ─── main capture loop ──────────────────────────────────────────────────────
async function captureModalForTrigger(page, trigger, outDir, idx, baselineKeys) {
  const modalId = `${idx.toString().padStart(3, '0')}-${sanitize(
    trigger.label || trigger.ariaLabel || trigger.kind
  )}`.slice(0, 80);

  try {
    // Click trigger by coordinates (most reliable across shadow-DOM and AG Grid)
    await page.mouse.click(trigger.x, trigger.y);
    // Wait for modal to appear (Procore animations are ~300ms)
    await page.waitForTimeout(900);
    const modal = await findNewModal(page, baselineKeys);
    if (!modal) {
      return { modalId, opened: false, trigger, note: 'no new panel opened' };
    }

    // Extract data from the modal element
    const data = await modal.handle.evaluate(extractModalDataFromEl);

    // Save DOM
    const html = await modal.handle.evaluate((el) => el.outerHTML);
    writeFileSync(join(outDir, `${modalId}.html`), html);

    // Screenshot — full page (context) + modal-only clip
    await page.screenshot({
      path: join(outDir, `${modalId}-full.png`),
      fullPage: false,
    });
    try {
      await modal.handle.screenshot({ path: join(outDir, `${modalId}.png`) });
    } catch {}

    const closed = await closeModal(page, baselineKeys);

    return {
      modalId,
      opened: true,
      trigger,
      detectedSelector: modal.selector,
      panelKey: modal.key,
      title: data.title,
      fields: data.fields,
      readOnlyRows: data.readOnlyRows,
      actions: data.actions,
      tabs: data.tabs,
      screenshot: `${modalId}.png`,
      fullScreenshot: `${modalId}-full.png`,
      dom: `${modalId}.html`,
      closeOk: closed,
    };
  } catch (err) {
    await closeModal(page, baselineKeys).catch(() => {});
    return { modalId, opened: false, trigger, note: `error: ${err.message}` };
  }
}

function sanitize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'unnamed';
}

async function crawlPage(page, pageCfg, pageDir, manifest, toolOutDir) {
  try {
    await page.goto(pageCfg.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    console.log(`  ⚠ navigation failed: ${e.message.slice(0, 100)}`);
    manifest.pages.push({ id: pageCfg.id, url: pageCfg.url, error: e.message, modals: [] });
    return;
  }
  if (page.url().includes('login.procore.com')) {
    await authenticate(page);
    await page.goto(pageCfg.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  }
  // Wait for any of: AG grid, table, form, or generic content
  await page
    .waitForSelector('.ag-root, table, form, [role="main"], [class*="content" i]', { timeout: 20000 })
    .catch(() => {});
  // Network idle for slow loads
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Screenshot the page once so we have context
  await page.screenshot({ path: join(pageDir, '_page.png'), fullPage: true }).catch(() => {});

  // Snapshot baseline panels so we can detect NEW panels post-click
  const baselineKeys = await snapshotPanelKeys(page);

  // Discover candidate triggers on this page
  const triggers = await page.evaluate(discoverTriggers);
  console.log(`  discovered ${triggers.length} candidate triggers`);

  // Smart dedupe by (priority, kind, colId, label-shape)
  const deduped = dedupeTriggers(triggers);
  console.log(`  → ${deduped.length} unique after dedup`);

  // Cap per page
  const cap = pageCfg.triggerCap || 60;
  const toTry = deduped.slice(0, cap);
  console.log(`  will attempt ${toTry.length}`);

  writeFileSync(
    join(pageDir, '_discovered-triggers.json'),
    JSON.stringify({
      total: triggers.length,
      unique: deduped.length,
      baselinePanels: baselineKeys.size,
      triggers: toTry,
    }, null, 2)
  );

  const modals = [];
  let idx = 0;
  const seenPanelKeys = new Set();
  for (const trigger of toTry) {
    idx++;
    process.stdout.write(
      `  [${idx}/${toTry.length}] p${trigger.priority} ${trigger.kind} ` +
      `"${(trigger.label || trigger.ariaLabel || '').slice(0, 36)}" col=${trigger.colId || '-'} ...`
    );
    const result = await captureModalForTrigger(page, trigger, pageDir, idx, baselineKeys);
    if (result.opened) {
      if (seenPanelKeys.has(result.panelKey)) {
        process.stdout.write(` ↻ duplicate panel\n`);
        result.duplicate = true;
      } else {
        seenPanelKeys.add(result.panelKey);
        process.stdout.write(
          ` ✓ "${result.title || '(no title)'}" (${result.fields.length}f, ${result.actions.length}a)\n`
        );
      }
    } else {
      process.stdout.write(` —\n`);
    }
    modals.push(result);

    if (idx % 25 === 0) {
      await page.goto(pageCfg.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }

  const openedModals = modals.filter((m) => m.opened);
  const uniqueModals = openedModals.filter((m) => !m.duplicate);
  console.log(`  → ${uniqueModals.length} unique modals (${openedModals.length} total opens) on ${pageCfg.id}`);
  manifest.pages.push({
    id: pageCfg.id,
    url: pageCfg.url,
    pageScreenshot: `modals/${pageCfg.id}/_page.png`,
    attemptedTriggers: toTry.length,
    uniqueModalsCaptured: uniqueModals.length,
    modals,
  });

  // Persist manifest after every page so a later crash doesn't lose work
  const manifestPath = join(toolOutDir, 'modals.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function crawlTool(context, tool) {
  const config = MODAL_CONFIGS[tool];
  const toolOutDir = join(PROJECT_ROOT, '.claude/procore-manifests', tool);
  const modalsRootDir = join(toolOutDir, 'modals');
  mkdirSync(modalsRootDir, { recursive: true });

  console.log(`\n\n═══ ${tool.toUpperCase()} ═══`);
  const manifest = { tool, capturedAt: new Date().toISOString(), pages: [] };

  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const pageCfg of config.pages) {
    console.log(`\n→ Page: ${pageCfg.id} — ${pageCfg.url}`);
    const pageDir = join(modalsRootDir, pageCfg.id);
    mkdirSync(pageDir, { recursive: true });
    try {
      await crawlPage(page, pageCfg, pageDir, manifest, toolOutDir);
    } catch (err) {
      console.error(`  ❌ page error: ${err.message}`);
      manifest.pages.push({ id: pageCfg.id, url: pageCfg.url, error: err.message, modals: [] });
      try { await page.goto('about:blank', { timeout: 5000 }); } catch {}
    }
  }

  const manifestPath = join(toolOutDir, 'modals.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ ${tool}: manifest → ${manifestPath}`);
  await page.close();
  return manifest;
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🚀 Procore Modal Crawl — tools: ${tools.join(', ')}`);

  const CHROME_FOR_TESTING =
    '/Users/meganharrison/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  // Prefer Chrome for Testing if installed (Playwright's headless_shell is often missing).
  const launchOpts = { headless: true };
  if (existsSync(CHROME_FOR_TESTING)) launchOpts.executablePath = CHROME_FOR_TESTING;
  const browser = await chromium.launch(launchOpts);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // auth once
  const authPage = await context.newPage();
  await authenticate(authPage);
  await authPage.close();

  const summaries = [];
  for (const tool of tools) {
    try {
      const m = await crawlTool(context, tool);
      const total = m.pages.reduce((n, p) => n + p.modals.filter((x) => x.opened).length, 0);
      summaries.push({ tool, pages: m.pages.length, modalsCaptured: total });
    } catch (err) {
      console.error(`❌ ${tool}:`, err.message);
      summaries.push({ tool, error: err.message });
    }
  }

  await browser.close();

  console.log('\n\n═══════ SUMMARY ═══════');
  summaries.forEach((s) => {
    if (s.error) console.log(`❌ ${s.tool}: ${s.error}`);
    else console.log(`✅ ${s.tool}: ${s.modalsCaptured} modals across ${s.pages} pages`);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
