// Authentication for the recorder and the preflight. Reuses .auth/state.json
// when it is still valid, otherwise UI-logs-in with TEST_USER_1/TEST_PASSWORD_1
// read from the repo .env / frontend/.env.local. No credential defaults in source.

import fs from 'node:fs';
import path from 'node:path';

import { detectGuardPage } from './flow-runner.mjs';

/**
 * Minimal .env reader (no dotenv dependency). Walks up ancestor dirs from the
 * skill so it finds the repo `.env` whether the skill lives in the main checkout
 * OR inside a git worktree (whose root has no .env — the creds live at the main
 * repo root, an ancestor).
 */
export function readEnvCreds(skillDir) {
  const out = {};
  const keys = ['TEST_USER_1', 'TEST_PASSWORD_1'];
  const readInto = (file) => {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    for (const key of keys) {
      if (out[key]) continue;
      const match = text.match(new RegExp('^' + key + '=\\s*"?([^"\\n\\r]*)', 'm'));
      if (match) out[key] = match[1];
    }
  };
  let dir = skillDir;
  for (let index = 0; index < 8; index += 1) {
    readInto(path.join(dir, '.env'));
    readInto(path.join(dir, 'frontend', '.env.local'));
    readInto(path.join(dir, 'frontend', '.env'));
    if (out.TEST_USER_1 && out.TEST_PASSWORD_1) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {
    email: process.env.TEST_USER_1 || out.TEST_USER_1,
    password: process.env.TEST_PASSWORD_1 || out.TEST_PASSWORD_1,
  };
}

/**
 * Seconds of life left in the saved session's Supabase access token, or null if
 * it cannot be determined.
 *
 * This matters because the access token has a **1-hour TTL** while the cookie
 * carrying it is valid for a year. Server-protected routes reject the expired
 * token and redirect to /auth/login before the client can refresh it — so a
 * recording that STARTS on a nearly-expired token bounces to the login page
 * partway through and produces a broken video. Observed 2026-07-29: token
 * iat 20:15:31, exp 21:15:31, and a run at 21:16 failed on step 4 of 6 while
 * steps 1–3 passed. That is one of the mechanisms behind "it works about half
 * the time".
 */
export function accessTokenSecondsRemaining(statePath) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const cookie = (state.cookies || []).find((entry) => /-auth-token$/.test(entry.name));
    if (!cookie) return null;
    let raw = decodeURIComponent(cookie.value);
    if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice(7), 'base64').toString('utf8');
    const session = JSON.parse(raw);
    const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64').toString('utf8'));
    if (!payload.exp) return null;
    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}

async function stateIsValid({ browser, statePath, base, viewport, minTokenSeconds = 600, log = console }) {
  if (!fs.existsSync(statePath)) return false;

  // Reject a token that would die mid-recording. A record+encode is a couple of
  // minutes; 10 minutes of headroom makes an expiry-crossing run impossible.
  const remaining = accessTokenSecondsRemaining(statePath);
  if (remaining !== null && remaining < minTokenSeconds) {
    log.log(
      `saved session expires in ${remaining}s (< ${minTokenSeconds}s headroom) — re-authenticating so the token cannot die mid-run`,
    );
    return false;
  }
  const ctx = await browser.newContext({ storageState: statePath, viewport });
  const page = await ctx.newPage();
  let ok = false;
  try {
    await page.goto(base + '/tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const apiStatus = await page.evaluate(async () => {
      const response = await fetch('/api/projects?limit=1', { cache: 'no-store' });
      return response.status;
    }).catch(() => 401);
    ok = !page.url().includes('/auth/login') && apiStatus !== 401 && apiStatus !== 403;
  } catch {
    ok = false;
  }
  await ctx.close();
  return ok;
}

async function login({ browser, statePath, base, viewport, email, password, log = console }) {
  if (!email || !password) {
    throw new Error('No valid saved session and TEST_USER_1/TEST_PASSWORD_1 are not configured.');
  }
  log.log(`authenticating as ${email} ...`);
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto(base + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    const mounted = await page.waitForSelector('#email', { state: 'visible', timeout: 30000 })
      .then(() => true).catch(() => false);
    if (!mounted) {
      if (!page.url().includes('/auth/login')) break; // already redirected = authed
      continue;
    }
    await page.waitForTimeout(3000); // React 19 hydration before handlers attach
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click().catch(() => {});
    let ok = await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 20000 })
      .then(() => true).catch(() => false);
    if (!ok) { // fallback: submit via Enter
      await page.locator('#password').press('Enter').catch(() => {});
      ok = await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15000 })
        .then(() => true).catch(() => false);
    }
    if (ok) {
      await ctx.storageState({ path: statePath });
      await ctx.close();
      log.log('authenticated; session saved');
      return;
    }
    if (attempt < maxAttempts) await page.waitForTimeout(2000);
  }
  await ctx.close();
  throw new Error(`login failed for ${email} after ${maxAttempts} attempts — check TEST_USER_1/TEST_PASSWORD_1 in .env`);
}

export async function ensureSession(options) {
  if (!(await stateIsValid(options))) await login(options);
  return options.statePath;
}

/**
 * Precondition check — the cheapest possible version of the bug that broke the
 * recorder. Before warming routes or opening a recording context, confirm the
 * flow's own entry point is actually reachable for this user. A deleted or
 * unshared project fails here in seconds with a plain-English reason instead of
 * mid-recording as a mystery selector timeout.
 *
 * The app renders the project shell optimistically for several seconds before
 * the access check resolves, so this must WATCH for the redirect rather than
 * sample the URL once.
 */
export async function assertFlowEntryReachable({
  browser, statePath, base, viewport, startPath, settleMs = 8000, log = console,
}) {
  const ctx = await browser.newContext({ storageState: statePath, viewport });
  const page = await ctx.newPage();
  try {
    await page.goto(base + startPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const deadline = Date.now() + settleMs;
    while (Date.now() < deadline) {
      const guard = detectGuardPage(page.url());
      if (guard) {
        throw new Error(
          `flow entry point ${startPath} is not reachable for the recording user: ${guard.reason}\n`
          + `  landed on: ${guard.url}\n`
          + '  Fix the flow\'s project/route (or grant the test user access) before recording.',
        );
      }
      await page.waitForTimeout(500);
    }
    log.log(`entry point ${startPath} reachable`);
  } finally {
    await ctx.close();
  }
}
