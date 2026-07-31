// Training-video recorder — drives the REAL app with a polished synthetic
// cursor, click ripples, captions, zoom, and title/outro cards, frames it in a
// premium gradient backdrop, and outputs an MP4. Self-authenticating.
//
// Usage:
//   node lib/record.mjs flows/<flow>.json [--headed] [--base http://localhost:3000] [--allow-skips]
//
// Step execution lives in lib/flow-runner.mjs (the seam shared with
// lib/preflight.mjs) so a green preflight means this recorder can drive the flow.
// Requires: local `playwright`, `ffmpeg-static`, and `ffprobe-static` packages.
// Auth: reuses .auth/state.json if valid; otherwise UI-logs-in with
//   TEST_USER_1 / TEST_PASSWORD_1 (read from repo .env / frontend/.env.local).
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateFlow } from './flow-validation.mjs';
import { FlowAbortError, createOverlay, runFlow, settle } from './flow-runner.mjs';
import { assertFlowEntryReachable, ensureSession, readEnvCreds } from './session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
const OVERLAY = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8');
const STATE = path.join(SKILL_DIR, '.auth', 'state.json');

// ---- args ----
const args = process.argv.slice(2);
const flowPath = args.find((a) => !a.startsWith('--'));
if (!flowPath) {
  console.error('usage: node lib/record.mjs flows/<flow>.json [--headed] [--base URL] [--allow-skips]');
  process.exit(1);
}
const headed = args.includes('--headed');
// Default is strict: a skipped step fails the run rather than silently shipping
// a video with a missing beat. --allow-skips is the deliberate escape hatch.
const strict = !args.includes('--allow-skips');
const baseIdx = args.indexOf('--base');
const baseArg = baseIdx >= 0 ? args[baseIdx + 1] : undefined;
const absoluteFlowPath = path.resolve(flowPath);
const flow = validateFlow(JSON.parse(fs.readFileSync(absoluteFlowPath, 'utf8')), absoluteFlowPath);
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

  const { email, password } = readEnvCreds(SKILL_DIR);
  await ensureSession({ browser, statePath: STATE, base, viewport, email, password });
  const storageState = STATE;

  // Cheap precondition: is the flow's own entry point even reachable for this
  // user? A deleted or unshared project fails here in seconds instead of
  // mid-recording as a mystery selector timeout.
  await assertFlowEntryReachable({
    browser, statePath: storageState, base, viewport, startPath: flow.startPath || '/',
  });

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
  const overlay = createOverlay(page);

  // Land + title card. Paint the title the instant navigation COMMITS (not after
  // the page finishes loading) so there is no blank dead-time lead-in; the page
  // loads behind the card during the hold.
  const showTitle = flow.title && !flow.bareFootage;
  await page.goto(base + (flow.startPath || '/'), { waitUntil: showTitle ? 'commit' : 'domcontentloaded' });
  if (showTitle) {
    await page.waitForFunction(() => window.__vid, null, { timeout: 10000 }).catch(() => {});
    await overlay.card(flow.title.title, flow.title.subtitle, 0);
    await settle(page, flow.title.hold || 1900);
    await overlay.cardHide();
    await page.waitForTimeout(200);
  } else {
    await settle(page, 1200);
  }

  let report;
  let recordingError;
  try {
    report = await runFlow(page, flow, {
      base,
      overlay,
      flowPath: absoluteFlowPath,
      bareFootage: Boolean(flow.bareFootage),
      dryRun: false,
      strict,
    });
  } catch (error) {
    recordingError = error;
  }

  if (!recordingError) {
    await overlay.zoomOut();
    await overlay.captionHide();
    if (flow.outro && !flow.bareFootage) {
      await overlay.card(flow.outro.title, flow.outro.subtitle, flow.outro.hold || 2000);
    }
    await page.waitForTimeout(400);
  }

  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  await browser.close();

  // A failed run must not leave a plausible-looking MP4 behind — the raw footage
  // is retained for diagnosis instead.
  if (recordingError) {
    console.error(`\n✖ recording aborted; raw footage retained at ${webm}`);
    throw recordingError;
  }

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
  const skippedNote = report.skipped.length ? ` [${report.skipped.length} step(s) skipped]` : '';
  console.log(`\n✅ ${finalMp4} (${kb} KB)${flow.frame === false ? '' : ' [framed]'}${flow.tighten ? ' [tightened]' : ''}${skippedNote}`);
  if (report.skipped.length) {
    console.warn('\n⚠ skipped steps (video has missing beats):');
    for (const entry of report.skipped) console.warn(`  - ${entry.error}`);
  }
}

run().catch((e) => {
  if (e instanceof FlowAbortError) console.error(`\n${e.message}`);
  else console.error(e);
  process.exit(1);
});
