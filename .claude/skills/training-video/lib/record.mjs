// Training-video recorder — drives the REAL app with a polished synthetic
// cursor, click ripples, captions, zoom, and title/outro cards, frames it in a
// premium gradient backdrop, and outputs an MP4. Self-authenticating.
//
// Usage:
//   node lib/record.mjs flows/<flow>.json [--headed] [--base http://localhost:3000]
//
// Requires: local `playwright`, `ffmpeg-static`, and `ffprobe-static` packages.
// Auth: reuses .auth/state.json if valid; otherwise UI-logs-in with
//   TEST_USER_1 / TEST_PASSWORD_1 (read from repo .env / frontend/.env.local).
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveFlowAssetPath, validateFlow } from './flow-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
const OVERLAY = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8');
const STATE = path.join(SKILL_DIR, '.auth', 'state.json');

// ---- args ----
const args = process.argv.slice(2);
const flowPath = args.find((a) => !a.startsWith('--'));
if (!flowPath) { console.error('usage: node lib/record.mjs flows/<flow>.json [--headed]'); process.exit(1); }
const headed = args.includes('--headed');
const baseIdx = args.indexOf('--base');
const baseArg = baseIdx >= 0 ? args[baseIdx + 1] : undefined;
const absoluteFlowPath = path.resolve(flowPath);
const flow = validateFlow(
  JSON.parse(fs.readFileSync(absoluteFlowPath, 'utf8')),
  absoluteFlowPath,
);
const base = baseArg || flow.base || 'http://localhost:3000';
const viewport = flow.viewport || { width: 1440, height: 900 };
const ffmpegCommand = ffmpegPath || 'ffmpeg';
const outDir = path.join(SKILL_DIR, 'output');
const rawDir = path.join(outDir, 'raw');
const outputName = flow.name || 'training-video';
const finalMp4 = path.join(outDir, `${outputName}.mp4`);
const workingMp4 = path.join(outDir, `.${outputName}.${process.pid}.working.mp4`);
const rawWorkingMp4 = path.join(outDir, `.${outputName}.${process.pid}.raw.mp4`);
fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(path.dirname(STATE), { recursive: true });

// ---- minimal .env reader (no dotenv dependency) ----
// Walks up ancestor dirs from the skill so it finds the repo `.env` whether the
// skill lives in the main checkout OR inside a git worktree (whose root has no
// .env — the creds live at the main repo root, an ancestor).
function readEnvCreds() {
  const out = {};
  const keys = ['TEST_USER_1', 'TEST_PASSWORD_1'];
  const readInto = (f) => {
    if (!fs.existsSync(f)) return;
    const t = fs.readFileSync(f, 'utf8');
    for (const key of keys) {
      if (out[key]) continue;
      const m = t.match(new RegExp('^' + key + '=\\s*"?([^"\\n\\r]*)', 'm'));
      if (m) out[key] = m[1];
    }
  };
  let dir = SKILL_DIR;
  for (let i = 0; i < 8; i++) {
    readInto(path.join(dir, '.env'));
    readInto(path.join(dir, 'frontend', '.env.local'));
    readInto(path.join(dir, 'frontend', '.env'));
    if (out.TEST_USER_1 && out.TEST_PASSWORD_1) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}
const envCreds = readEnvCreds();
const EMAIL = process.env.TEST_USER_1 || envCreds.TEST_USER_1;
const PASS = process.env.TEST_PASSWORD_1 || envCreds.TEST_PASSWORD_1;

async function stateIsValid(browser) {
  if (!fs.existsSync(STATE)) return false;
  const ctx = await browser.newContext({ storageState: STATE, viewport });
  const p = await ctx.newPage();
  let ok = false;
  try {
    await p.goto(base + '/tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(1500);
    const apiStatus = await p.evaluate(async () => {
      const response = await fetch('/api/projects?limit=1', { cache: 'no-store' });
      return response.status;
    }).catch(() => 401);
    ok = !p.url().includes('/auth/login') && apiStatus !== 401 && apiStatus !== 403;
  } catch { ok = false; }
  await ctx.close();
  return ok;
}

async function login(browser) {
  if (!EMAIL || !PASS) {
    throw new Error(
      'No valid saved session and TEST_USER_1/TEST_PASSWORD_1 are not configured.',
    );
  }
  console.log(`authenticating as ${EMAIL} ...`);
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await p.goto(base + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    const mounted = await p.waitForSelector('#email', { state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!mounted) {
      if (!p.url().includes('/auth/login')) break; // already redirected = authed
      continue;
    }
    await p.waitForTimeout(3000); // React 19 hydration before handlers attach
    await p.locator('#email').fill(EMAIL);
    await p.locator('#password').fill(PASS);
    await p.getByRole('button', { name: /sign in/i }).click().catch(() => {});
    let ok = await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 20000 }).then(() => true).catch(() => false);
    if (!ok) { // fallback: submit via Enter
      await p.locator('#password').press('Enter').catch(() => {});
      ok = await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 15000 }).then(() => true).catch(() => false);
    }
    if (ok) {
      await ctx.storageState({ path: STATE });
      await ctx.close();
      console.log('authenticated; session saved');
      return;
    }
    if (attempt < maxAttempts) await p.waitForTimeout(2000);
  }
  await ctx.close();
  throw new Error(`login failed for ${EMAIL} after ${maxAttempts} attempts — check TEST_USER_1/TEST_PASSWORD_1 in .env`);
}

async function waitForVisibleMatch(page, candidates, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let el;
  while (Date.now() < deadline && !el) {
    const count = Math.min(await candidates.count(), 100);
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        el = candidate;
        break;
      }
    }
    if (!el) await page.waitForTimeout(250);
  }
  if (!el) throw new Error(`no visible match for ${description}`);
  return el;
}

async function locateCenter(page, selector, timeout = 15000) {
  const el = await waitForVisibleMatch(page, page.locator(selector), selector, timeout);
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { el, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function settle(page, ms = 900) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function ordinal(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  if (day % 10 === 1) return 'st';
  if (day % 10 === 2) return 'nd';
  if (day % 10 === 3) return 'rd';
  return 'th';
}

function formatCalendarButtonName(date) {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  return `${weekday}, ${month} ${date.getDate()}${ordinal(date.getDate())}, ${date.getFullYear()}`;
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function normalizeDisplayDate(value) {
  return value.replace(/(\d+)(st|nd|rd|th)(?=,)/g, '$1');
}

function calendarMonthIndex(captionText) {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const match = captionText.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? months.indexOf(match[1].toLowerCase()) : -1;
  if (!match || month < 0) {
    throw new Error(`could not determine the visible calendar month from "${captionText}"`);
  }
  return Number(match[2]) * 12 + month;
}

async function selectDate(page, spec) {
  const date = new Date(`${spec.value}T12:00:00`);
  const trigger = page.getByRole('button', { name: spec.label }).first();
  await trigger.waitFor({ state: 'visible', timeout: 15000 });
  await trigger.scrollIntoViewIfNeeded();
  const triggerBox = await trigger.boundingBox();
  if (!triggerBox) throw new Error(`no date trigger box for ${spec.label}`);
  await page.evaluate(
    ([x, y]) => window.__vid.moveTo(x, y, 700),
    [triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2],
  );
  await page.evaluate(() => window.__vid.click());
  await trigger.click({ timeout: 8000 });

  const dayName = formatCalendarButtonName(date);
  const day = page.getByRole('button', { name: dayName, exact: true }).last();
  const targetMonth = date.getFullYear() * 12 + date.getMonth();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await day.isVisible({ timeout: 500 }).catch(() => false)) {
      const dayBox = await day.boundingBox();
      if (dayBox) {
        await page.evaluate(
          ([x, y]) => window.__vid.moveTo(x, y, 500),
          [dayBox.x + dayBox.width / 2, dayBox.y + dayBox.height / 2],
        );
        await page.evaluate(() => window.__vid.click());
      }
      await day.click({ timeout: 8000 });
      const selectedText = (await trigger.textContent()) || '';
      if (!normalizeDisplayDate(selectedText).includes(formatDisplayDate(date))) {
        throw new Error(
          `date assertion failed for ${spec.label}: expected ${formatDisplayDate(date)}, received ${selectedText || '<empty>'}`,
        );
      }
      return;
    }
    const captionText = (await page.locator('.rdp-month_caption').last().textContent({ timeout: 3000 })) || '';
    const visibleMonth = calendarMonthIndex(captionText);
    const direction = targetMonth < visibleMonth ? 'Previous' : 'Next';
    const navigation = page.getByRole('button', { name: `Go to the ${direction} Month` }).last();
    await navigation.click({ timeout: 3000 });
  }
  throw new Error(`date ${spec.value} was not available for ${spec.label} after navigating 24 months`);
}

function frameVideo(webm, mp4) {
  const even = (n) => 2 * Math.round(n / 2);
  const W = viewport.width, H = viewport.height;
  const inW = even(W * 1.055), inH = even(inW * H / W);
  const canvasW = even(inW + 400), canvasH = even(inH + 260);
  const radius = 28;
  const mask = path.join(outDir, `_mask_${inW}x${inH}.png`);
  if (!fs.existsSync(mask)) {
    const mr = spawnSync(ffmpegCommand, ['-y', '-f', 'lavfi', '-i', `color=white:s=${inW}x${inH}:d=1`,
      '-vf', `format=gray,geq=lum='if(gt(pow(max(0\\,${radius}-min(X\\,W-1-X))\\,2)+pow(max(0\\,${radius}-min(Y\\,H-1-Y))\\,2)\\,${radius}*${radius})\\,0\\,255)'`,
      '-frames:v', '1', mask], { stdio: 'ignore' });
    if (mr.status !== 0) throw new Error('mask generation failed');
  }
  const fg =
    `[1:v]scale=${inW}:${inH},setsar=1[sc];` +
    `[sc][2:v]alphamerge[inner];` +
    `[inner]split[i1][i2];` +
    `[i2]colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0:aa=0.5,boxblur=24:1[sh];` +
    `[0:v][sh]overlay=(W-w)/2:(H-h)/2+22:shortest=1[b1];` +
    `[b1][i1]overlay=(W-w)/2:(H-h)/2[out]`;
  const r = spawnSync(ffmpegCommand, [
    '-y',
    '-f', 'lavfi', '-i', `gradients=s=${canvasW}x${canvasH}:c0=0x0e0e16:c1=0x20202f:x0=${Math.round(canvasW * 0.1)}:y0=0:x1=${Math.round(canvasW * 0.9)}:y1=${canvasH}:d=999`,
    '-i', webm, '-i', mask,
    '-filter_complex', fg, '-map', '[out]',
    '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', mp4,
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('framing ffmpeg failed');
}

function plainTranscode(webm, mp4) {
  const r = spawnSync(ffmpegCommand, ['-y', '-i', webm,
    '-vf', `scale=${viewport.width}:${viewport.height}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', '-r', '30', mp4],
    { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg transcode failed');
}

async function run() {
  for (const outputPath of [finalMp4, workingMp4, rawWorkingMp4]) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-features=IsolateOrigins'],
  });

  if (!(await stateIsValid(browser))) await login(browser);
  const storageState = STATE;

  // Pre-warm routes (dev-server cold compiles can exceed 30s) in an unrecorded
  // context. Includes goto targets plus any `flow.warm` hints — use the latter to
  // warm routes reached via clicks (create forms, detail pages via a dummy id;
  // Next compiles per-route, not per-param).
  const warmPaths = [...new Set([flow.startPath || '/',
    ...flow.steps.filter((s) => s.goto).map((s) => s.goto),
    ...(flow.warm || [])])];
  console.log(`warming ${warmPaths.length} routes...`);
  const warmCtx = await browser.newContext({ storageState, viewport });
  warmCtx.setDefaultNavigationTimeout(90000);
  const warmPage = await warmCtx.newPage();
  for (const p of warmPaths) {
    await warmPage.goto(base + p, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await warmPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  }
  await warmCtx.close();
  console.log('routes warm; recording...');

  const ctx = await browser.newContext({
    storageState, viewport, deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: viewport },
  });
  ctx.setDefaultNavigationTimeout(60000);
  await ctx.addInitScript(OVERLAY);

  const HIDE = ['#__next-build-watcher', 'nextjs-portal', '#agentation-root',
    '[data-agentation-toolbar]', '[data-nextjs-toast]', ...(flow.hideSelectors || [])];
  await ctx.addInitScript((sels) => {
    const css = sels.join(',') + '{display:none !important;visibility:hidden !important;}';
    const inject = () => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
    inject(); document.addEventListener('DOMContentLoaded', inject);
  }, HIDE);

  const page = await ctx.newPage();

  // Land + title card. Paint the title the instant navigation COMMITS (not after
  // the page finishes loading) so there is no blank dead-time lead-in; the page
  // loads behind the card during the hold.
  const showTitle = flow.title && !flow.bareFootage;
  await page.goto(base + (flow.startPath || '/'), { waitUntil: showTitle ? 'commit' : 'domcontentloaded' });
  if (showTitle) {
    await page.waitForFunction(() => window.__vid, null, { timeout: 10000 }).catch(() => {});
    await page.evaluate((t) => window.__vid.card(t.title, t.subtitle, 0), flow.title).catch(() => {});
    await settle(page, flow.title.hold || 1900);
    await page.evaluate(() => window.__vid.cardHide());
    await page.waitForTimeout(200);
  } else {
    await settle(page, 1200);
  }

  for (const [stepIndex, step] of flow.steps.entries()) {
    try {
      if (step.goto) {
        await page.evaluate(() => window.__vid.zoomOut()).catch(() => {});
        await page.evaluate(() => window.__vid.captionHide());
        await page.goto(base + step.goto, { waitUntil: 'domcontentloaded' });
        await settle(page, 1000);
      }
      if (step.caption && !step.click && !flow.bareFootage) await page.evaluate((c) => window.__vid.caption(c), step.caption);

      if (step.click) {
        // A lingering zoom transform shifts hit-testing and can drop the click —
        // always return to 1x before interacting.
        await page.evaluate(() => window.__vid.zoomOut()).catch(() => {});
        // Show the caption BEFORE the interaction so it describes the action and
        // stays visible through a slow submit's navigation wait.
        if (step.caption && !flow.bareFootage) await page.evaluate((c) => window.__vid.caption(c), step.caption);
        try {
          const c = await locateCenter(page, step.click, step.timeout || 15000);
          const urlBefore = page.url();
          await page.evaluate(([x, y]) => window.__vid.moveTo(x, y, 780), [c.x, c.y]);
          await page.evaluate(() => window.__vid.click());
          if (step.required) await c.el.click({ timeout: 8000 });
          else await c.el.click({ timeout: 8000 }).catch(() => {});
          if (step.waitForNav) {
            if (step.required) {
              await page.waitForURL((u) => u.toString() !== urlBefore, { timeout: 90000 });
            } else {
              await page.waitForURL((u) => u.toString() !== urlBefore, { timeout: 90000 }).catch(() => {});
            }
          }
          await settle(page, 1000);
        } catch (e) {
          const href = (step.click.match(/href="([^"]+)"/) || [])[1];
          if (href && !step.required) { await page.goto(base + href, { waitUntil: 'domcontentloaded' }); await settle(page, 1000); }
          else throw e;
        }
      }

      if (step.type) {
        await page.evaluate(() => window.__vid.zoomOut()).catch(() => {});
        const c = await locateCenter(page, step.type.selector, step.timeout || 15000);
        await page.evaluate(([x, y]) => window.__vid.moveTo(x, y, 700), [c.x, c.y]);
        await page.evaluate(() => window.__vid.click());
        if (step.required) await c.el.click({ timeout: 5000 });
        else await c.el.click({ timeout: 5000 }).catch(() => {});
        if (step.required) await c.el.fill('');
        else await c.el.fill('').catch(() => {});
        await page.keyboard.type(step.type.text, { delay: 90 });
        if (step.required) {
          const isContentEditable = await c.el.getAttribute('contenteditable');
          const actual = isContentEditable === 'true'
            ? (await c.el.textContent()) || ''
            : await c.el.inputValue();
          if (!actual.includes(step.type.text)) {
            throw new Error(`typed value assertion failed for ${step.type.selector}`);
          }
        }
        await page.waitForTimeout(500);
      }

      if (step.date) {
        await page.evaluate(() => window.__vid.zoomOut()).catch(() => {});
        await selectDate(page, step.date);
        await page.waitForTimeout(500);
      }

      if (step.upload) {
        const assetPath = resolveFlowAssetPath(absoluteFlowPath, step.upload.path);
        const input = page.locator(step.upload.selector).first();
        await input.waitFor({ state: 'attached', timeout: step.timeout || 15000 });
        await input.setInputFiles(assetPath);
        await settle(page, step.upload.settle || 1500);
      }

      if (step.zoom) {
        const c = await locateCenter(page, step.zoom, step.timeout || 15000);
        await page.evaluate(([x, y]) => window.__vid.moveTo(x, y, 600), [c.x, c.y]);
        await page.evaluate(([x, y, s]) => window.__vid.zoom(x, y, s || 1.5), [c.x, c.y, step.scale]);
      }

      if (step.expectVisible) {
        await waitForVisibleMatch(
          page,
          page.locator(step.expectVisible),
          step.expectVisible,
          step.timeout || 15000,
        );
      }
      if (step.expectText) {
        await waitForVisibleMatch(
          page,
          page.getByText(step.expectText, { exact: false }),
          `text ${JSON.stringify(step.expectText)}`,
          20000,
        );
      }
      if (step.expectTexts) {
        for (const expectedText of step.expectTexts) {
          await waitForVisibleMatch(
            page,
            page.getByText(expectedText, { exact: false }),
            `text ${JSON.stringify(expectedText)}`,
            step.timeout || 20000,
          );
        }
      }

      if (step.hold) await page.waitForTimeout(step.hold);
      if (step.pause) await page.waitForTimeout(step.pause);
    } catch (e) {
      const message = `training-video step ${stepIndex + 1} failed (${JSON.stringify(step).slice(0, 100)}): ${e.message}`;
      if (step.required) throw new Error(message, { cause: e });
      console.warn(`step skipped: ${message}`);
    }
  }

  await page.evaluate(() => window.__vid.zoomOut()).catch(() => {});
  await page.evaluate(() => window.__vid.captionHide());
  if (flow.outro && !flow.bareFootage) await page.evaluate((t) => window.__vid.card(t.title, t.subtitle, t.hold || 2000), flow.outro);
  await page.waitForTimeout(400);

  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  await browser.close();

  if (flow.frame === false) plainTranscode(webm, workingMp4);
  else frameVideo(webm, workingMp4);

  // Auto-tighten: cap every static dwell (loading spinners, long holds) so the
  // real app's dead-time doesn't bloat the video. Keeps cursor motion full-speed.
  if (flow.tighten) {
    const opts = typeof flow.tighten === 'object' ? flow.tighten : {};
    fs.renameSync(workingMp4, rawWorkingMp4);
    const tr = spawnSync('node', [path.join(__dirname, 'tighten.mjs'), rawWorkingMp4, workingMp4, String(opts.maxDwell || 1.3), String(opts.minFreeze || 1.2)], { stdio: 'inherit' });
    if (tr.status !== 0) {
      if (fs.existsSync(workingMp4)) fs.unlinkSync(workingMp4);
      throw new Error(`tighten failed; untightened diagnostic retained at ${rawWorkingMp4}`);
    }
    fs.unlinkSync(rawWorkingMp4);
  }

  fs.renameSync(workingMp4, finalMp4);
  const kb = Math.round(fs.statSync(finalMp4).size / 1024);
  console.log(`\n✅ ${finalMp4} (${kb} KB)${flow.frame === false ? '' : ' [framed]'}${flow.tighten ? ' [tightened]' : ''}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
