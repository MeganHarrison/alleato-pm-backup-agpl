#!/usr/bin/env node
/**
 * Debug: find Procore's actual side-panel selector by clicking different
 * trigger types and inspecting what overlay opens.
 *
 * Strategy:
 *   1. Find every <a> link inside ag-cells (these are the underlined blue numbers)
 *   2. Click each one in turn, after each click look for any large fixed/absolute
 *      element that wasn't there before; capture its tag/role/class
 *   3. Close (Escape) and continue
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
dotenv.config({ path: join(PROJECT_ROOT, '.env') });

const PROCORE_EMAIL = process.env.PROCORE_USER;
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD;
const CHROME_FOR_TESTING = '/Users/meganharrison/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUT_DIR = join(PROJECT_ROOT, '.claude/procore-manifests/budget/_debug');

async function authenticate(page) {
  await page.goto('https://login.procore.com', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('login.procore.com')) {
    await page.waitForSelector('input[type="email"], input[name="session[email]"]', { timeout: 10000 });
    await page.fill('input[type="email"], input[name="session[email]"]', PROCORE_EMAIL);
    const next = page.locator('button:has-text("Next"), button[type="submit"]:has-text("Continue")');
    if ((await next.count()) > 0) { await next.first().click(); await page.waitForTimeout(1500); }
    await page.fill('input[type="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
  }
}

// Snapshot fixed/absolute elements > 250×300 in the right half of viewport
async function snapshotPanels(page) {
  return page.evaluate(() => {
    const matches = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cls = typeof el.className === 'string' ? el.className : '';
      if (r.width > 250 && r.height > 300 && r.x > 400 && r.x < 1500 && r.y < 200) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
          matches.push({
            tag: el.tagName,
            id: el.id,
            cls: cls.slice(0, 200),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            x: Math.round(r.x), y: Math.round(r.y),
            w: Math.round(r.width), h: Math.round(r.height),
            position: style.position,
            zIndex: style.zIndex,
          });
        }
      }
    });
    // Dedupe — keep the largest at each (x,y)
    const seen = new Map();
    for (const m of matches) {
      const k = `${m.x},${m.y}`;
      if (!seen.has(k) || seen.get(k).w * seen.get(k).h < m.w * m.h) seen.set(k, m);
    }
    return [...seen.values()].sort((a, b) => b.w * b.h - a.w * a.h);
  });
}

(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_FOR_TESTING });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await authenticate(page);

  await page.goto('https://us02.procore.com/562949954728542/project/budgeting', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ag-root', { timeout: 15000 });
  await page.waitForTimeout(4000);

  const baseline = await snapshotPanels(page);
  console.log(`Baseline panels (right half, fixed/absolute, >250×300): ${baseline.length}`);
  baseline.forEach(p => console.log(' ·', p.tag, `${p.w}×${p.h}@(${p.x},${p.y})`, `z=${p.zIndex}`, p.cls.slice(0, 80)));
  const baseKeys = new Set(baseline.map(p => `${p.tag}|${p.x}|${p.y}|${p.w}|${p.h}`));

  // === Strategy A: click every <a> tag inside .ag-cell ===
  const anchors = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.ag-cell a').forEach((a) => {
      const r = a.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        out.push({
          text: (a.textContent || '').trim().slice(0, 30),
          href: a.getAttribute('href') || '',
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
        });
      }
    });
    return out.slice(0, 12);
  });
  console.log(`\n=== Strategy A: <a> inside .ag-cell — found ${anchors.length} ===`);

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    console.log(`\n[A${i}] click anchor "${a.text}" @ (${a.x},${a.y})`);
    await page.mouse.click(a.x, a.y);
    await page.waitForTimeout(2000);
    const panels = await snapshotPanels(page);
    const newPanels = panels.filter(p => !baseKeys.has(`${p.tag}|${p.x}|${p.y}|${p.w}|${p.h}`));
    if (newPanels.length > 0) {
      console.log(`  ★ ${newPanels.length} NEW panel(s):`);
      newPanels.forEach(p => console.log(`     - ${p.tag} ${p.w}×${p.h}@(${p.x},${p.y}) role=${p.role || '-'} aria="${p.ariaLabel || ''}" cls="${p.cls.slice(0, 120)}"`));
      await page.screenshot({ path: join(OUT_DIR, `A${i}-after.png`), fullPage: false });
      writeFileSync(join(OUT_DIR, `A${i}-panels.json`), JSON.stringify({ trigger: a, newPanels }, null, 2));
      // Try to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      // If closing fails, navigate back to budget
      const stillThere = await snapshotPanels(page);
      const stillNew = stillThere.filter(p => !baseKeys.has(`${p.tag}|${p.x}|${p.y}|${p.w}|${p.h}`));
      if (stillNew.length > 0) {
        await page.goto('https://us02.procore.com/562949954728542/project/budgeting', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.ag-root', { timeout: 15000 });
        await page.waitForTimeout(3000);
      }
      // Stop after first hit so we have a clean signature
      if (i >= 2) break;
    } else {
      console.log('  (no new panel)');
      // If URL changed, navigate back
      if (!page.url().includes('/budgeting')) {
        await page.goto('https://us02.procore.com/562949954728542/project/budgeting', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.ag-root', { timeout: 15000 });
        await page.waitForTimeout(3000);
      }
    }
  }

  // === Strategy B: click first column header ("Original Budget Amount") ===
  console.log('\n=== Strategy B: click column header "Original Budget Amount" ===');
  const header = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('.ag-header-cell'));
    for (const h of headers) {
      const t = (h.textContent || '').trim();
      if (/Original Budget/i.test(t)) {
        const r = h.getBoundingClientRect();
        return { text: t, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
    }
    return null;
  });
  console.log('Header found:', header);
  if (header) {
    await page.mouse.click(header.x, header.y);
    await page.waitForTimeout(2500);
    const panels = await snapshotPanels(page);
    const newPanels = panels.filter(p => !baseKeys.has(`${p.tag}|${p.x}|${p.y}|${p.w}|${p.h}`));
    console.log(`  → ${newPanels.length} new panel(s)`);
    newPanels.forEach(p => console.log(`     - ${p.tag} ${p.w}×${p.h}@(${p.x},${p.y}) role=${p.role || '-'} aria="${p.ariaLabel || ''}" cls="${p.cls.slice(0, 120)}"`));
    await page.screenshot({ path: join(OUT_DIR, 'B-header-click.png'), fullPage: false });
    if (newPanels.length > 0) writeFileSync(join(OUT_DIR, 'B-header-panels.json'), JSON.stringify({ trigger: header, newPanels }, null, 2));
  }

  await browser.close();
  console.log(`\nDebug output at: ${OUT_DIR}`);
})();
