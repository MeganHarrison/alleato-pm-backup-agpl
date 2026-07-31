// The flow-runner seam — the ONE boundary that executes a flow step against a
// Playwright page. Shared by the recorder (lib/record.mjs) and the headless
// preflight (lib/preflight.mjs) so both exercise identical step semantics: if
// preflight resolves a flow, the recorder can drive it.
//
// Why this exists (2026-07-29): the recorder intermittently "failed on the form
// step". The real fault was never the form. The flow targeted a project that had
// been deleted; the app renders the project shell optimistically for ~4.5s and
// THEN redirects to /access-denied?reason=no-project-access. Early steps passed
// inside that window and later steps failed against a guard page, so the run
// looked like a ~50% flake with a misleading selector timeout. Two guarantees
// fix that class of bug for good:
//
//   1. assertPageUsable() runs after every navigation and before every
//      interaction. A guard page (access-denied / login / not-found) aborts the
//      run immediately with the reason and the URL — never a selector timeout.
//   2. No step is silently skipped. Every skip is recorded and surfaced; a
//      strict run fails on the first one.

import fs from 'node:fs';
import path from 'node:path';

import { resolveFlowAssetPath } from './flow-validation.mjs';

// ---------------------------------------------------------------------------
// Guard pages — the app's "you cannot see this" destinations. Landing on one
// means the flow's premise is wrong (deleted project, lost session, bad route).
// Recording must stop, loudly, with the reason.
// ---------------------------------------------------------------------------
export const GUARD_PAGES = [
  {
    pattern: /\/access-denied/,
    reason:
      'the app redirected to /access-denied — the signed-in user cannot reach this project or route. '
      + 'The most common cause is a flow pointing at a project that was deleted or that this user is not a member of.',
  },
  {
    pattern: /\/auth\/login/,
    reason: 'the app redirected to /auth/login — the recording session is not authenticated (expired mid-run).',
  },
  {
    pattern: /\/(not-found|404)(\/|$|\?)/,
    reason: 'the app served a not-found route — the path in this flow does not exist.',
  },
];

export function detectGuardPage(url) {
  for (const guard of GUARD_PAGES) {
    if (guard.pattern.test(url)) return { url, reason: guard.reason };
  }
  return null;
}

export class FlowAbortError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'FlowAbortError';
    Object.assign(this, detail);
  }
}

/**
 * Fail fast when the page is a guard page. Called after every navigation and
 * before every interaction — this is the guardrail that turns a 4-minute
 * mystery recording into an instant, explicit error.
 */
export async function assertPageUsable(page, context) {
  const guard = detectGuardPage(page.url());
  if (!guard) return;
  throw new FlowAbortError(
    `training-video aborted at ${context}: ${guard.reason}\n  landed on: ${guard.url}`,
    { guardUrl: guard.url },
  );
}

// ---------------------------------------------------------------------------
// Overlay adapters. The recorder draws a synthetic cursor/captions via the
// injected window.__vid; the preflight has no overlay. Both drive the SAME
// runStep code path through this interface.
// ---------------------------------------------------------------------------
export function createOverlay(page) {
  const call = (fn, ...args) =>
    page.evaluate(
      ([name, callArgs]) => {
        const vid = window.__vid;
        if (!vid || typeof vid[name] !== 'function') return;
        vid[name](...callArgs);
      },
      [fn, args],
    ).catch(() => {});
  return {
    enabled: true,
    moveTo: (x, y, ms) => call('moveTo', x, y, ms),
    click: () => call('click'),
    caption: (text) => call('caption', text),
    captionHide: () => call('captionHide'),
    zoom: (x, y, scale) => call('zoom', x, y, scale),
    zoomOut: () => call('zoomOut'),
    card: (title, subtitle, hold) => call('card', title, subtitle, hold),
    cardHide: () => call('cardHide'),
  };
}

const NOOP = async () => {};
export const NULL_OVERLAY = {
  enabled: false,
  moveTo: NOOP,
  click: NOOP,
  caption: NOOP,
  captionHide: NOOP,
  zoom: NOOP,
  zoomOut: NOOP,
  card: NOOP,
  cardHide: NOOP,
};

// ---------------------------------------------------------------------------
// Waiting / locating
// ---------------------------------------------------------------------------
export async function settle(page, ms = 900) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  if (ms > 0) await page.waitForTimeout(ms);
}

async function waitForVisibleMatch(page, candidates, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let el;
  while (Date.now() < deadline && !el) {
    // A guard-page redirect mid-wait must abort now, not burn the full timeout
    // and report a misleading "selector not found".
    await assertPageUsable(page, `waiting for ${description}`);
    const count = Math.min(await candidates.count().catch(() => 0), 100);
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

/**
 * Ready assertion with bounded retry: after a navigation or a submit, wait for
 * the page to be genuinely interactive — network settled AND (when the step
 * declares one) the target selector/text actually present — before the next
 * step touches the DOM. This is what stops a slow route load from silently
 * dropping the step that follows it.
 */
export async function waitForReady(page, { selector, text, timeout = 20000, attempts = 3, label }) {
  const perAttempt = Math.max(2000, Math.floor(timeout / attempts));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await assertPageUsable(page, label ? `ready check for ${label}` : 'ready check');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: Math.min(8000, perAttempt) }).catch(() => {});
      if (selector) {
        await waitForVisibleMatch(page, page.locator(selector), selector, perAttempt);
      }
      if (text) {
        await waitForVisibleMatch(
          page,
          page.getByText(text, { exact: false }),
          `text ${JSON.stringify(text)}`,
          perAttempt,
        );
      }
      return;
    } catch (error) {
      if (error instanceof FlowAbortError) throw error;
      lastError = error;
      await page.waitForTimeout(500);
    }
  }
  throw new Error(
    `page never became ready${label ? ` for ${label}` : ''} after ${attempts} attempts: ${lastError?.message}`,
  );
}

// ---------------------------------------------------------------------------
// Date picker
// ---------------------------------------------------------------------------
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
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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

async function selectDate(page, spec, overlay) {
  const date = new Date(`${spec.value}T12:00:00`);
  const trigger = page.getByRole('button', { name: spec.label }).first();
  await trigger.waitFor({ state: 'visible', timeout: 15000 });
  await trigger.scrollIntoViewIfNeeded();
  const triggerBox = await trigger.boundingBox();
  if (!triggerBox) throw new Error(`no date trigger box for ${spec.label}`);
  await overlay.moveTo(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2, 700);
  await overlay.click();
  await trigger.click({ timeout: 8000 });

  const dayName = formatCalendarButtonName(date);
  const day = page.getByRole('button', { name: dayName, exact: true }).last();
  const targetMonth = date.getFullYear() * 12 + date.getMonth();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await day.isVisible({ timeout: 500 }).catch(() => false)) {
      const dayBox = await day.boundingBox();
      if (dayBox) {
        await overlay.moveTo(dayBox.x + dayBox.width / 2, dayBox.y + dayBox.height / 2, 500);
        await overlay.click();
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
    await page.getByRole('button', { name: `Go to the ${direction} Month` }).last().click({ timeout: 3000 });
  }
  throw new Error(`date ${spec.value} was not available for ${spec.label} after navigating 24 months`);
}

// ---------------------------------------------------------------------------
// Step execution — the seam
// ---------------------------------------------------------------------------
/**
 * Does the value a field reflects back satisfy what we typed?
 *
 * Formatted/masked inputs re-render the typed text: a retainage field turns
 * "10" into "10.00", a currency field into "$1,250.00", a phone mask into
 * "(317) 555-0100". A raw substring check would spuriously abort the recording
 * on those. So we accept either an exact substring match OR an alphanumerics-only
 * match — which tolerates inserted punctuation/currency symbols and trailing
 * zero-padding while still failing loudly when a field genuinely stayed empty or
 * holds the wrong value (never a silent skip).
 */
export function typedValueSatisfied(actual, expected) {
  if (actual.includes(expected)) return true;
  const canonical = (value) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const expectedCanonical = canonical(expected);
  if (!expectedCanonical) return true; // nothing meaningful to assert (e.g. typed punctuation only)
  return canonical(actual).includes(expectedCanonical);
}

/**
 * Execute one flow step. `ctx` carries { base, overlay, flowPath, bareFootage,
 * dryRun }. In dryRun the step resolves its selectors and asserts readiness but
 * skips holds/pauses and never uploads — so a preflight is seconds, not minutes.
 */
export async function runStep(page, step, ctx) {
  const { base, overlay, flowPath, bareFootage, dryRun } = ctx;
  const hold = (ms) => (dryRun || !ms ? Promise.resolve() : page.waitForTimeout(ms));

  if (step.goto) {
    await overlay.zoomOut();
    await overlay.captionHide();
    await page.goto(base + step.goto, { waitUntil: 'domcontentloaded' });
    // The critical guard: a project-shell redirect lands here, not 20 steps later.
    await waitForReady(page, {
      selector: step.expectVisible,
      text: step.expectText,
      timeout: step.timeout || 20000,
      label: `goto ${step.goto}`,
    });
    await settle(page, dryRun ? 0 : 1000);
  }

  await assertPageUsable(page, `step ${JSON.stringify(step).slice(0, 80)}`);

  if (step.caption && !step.click && !bareFootage) await overlay.caption(step.caption);

  if (step.click) {
    // A lingering zoom transform shifts hit-testing and can drop the click —
    // always return to 1x before interacting.
    await overlay.zoomOut();
    // Caption goes up BEFORE the interaction so it describes the action and
    // stays visible through a slow submit's navigation wait.
    if (step.caption && !bareFootage) await overlay.caption(step.caption);
    const target = await locateCenter(page, step.click, step.timeout || 15000);
    const urlBefore = page.url();
    await overlay.moveTo(target.x, target.y, 780);
    await overlay.click();
    await target.el.click({ timeout: 8000 });
    if (step.waitForNav) {
      await page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 90000 });
      await assertPageUsable(page, `navigation after clicking ${step.click}`);
    }
    await waitForReady(page, {
      selector: step.expectVisible,
      text: step.expectText,
      timeout: step.timeout || 20000,
      label: `click ${step.click}`,
    });
    await settle(page, dryRun ? 0 : 1000);
  }

  if (step.type) {
    await overlay.zoomOut();
    const target = await locateCenter(page, step.type.selector, step.timeout || 15000);
    await overlay.moveTo(target.x, target.y, 700);
    await overlay.click();
    await target.el.click({ timeout: 5000 });
    await target.el.fill('');
    if (dryRun) {
      // Resolve + focus proves the field is reachable; don't dirty real records.
      await target.el.fill('').catch(() => {});
    } else {
      await page.keyboard.type(step.type.text, { delay: 90 });
      const isContentEditable = await target.el.getAttribute('contenteditable');
      const actual = isContentEditable === 'true'
        ? (await target.el.textContent()) || ''
        : await target.el.inputValue();
      if (!typedValueSatisfied(actual, step.type.text)) {
        throw new Error(
          `typed value assertion failed for ${step.type.selector}: field holds ${JSON.stringify(actual.slice(0, 60))}`,
        );
      }
      await page.waitForTimeout(500);
    }
  }

  if (step.date) {
    await overlay.zoomOut();
    if (dryRun) {
      await waitForVisibleMatch(
        page,
        page.getByRole('button', { name: step.date.label }),
        `date trigger ${JSON.stringify(step.date.label)}`,
        step.timeout || 15000,
      );
    } else {
      await selectDate(page, step.date, overlay);
      await page.waitForTimeout(500);
    }
  }

  if (step.upload) {
    const input = page.locator(step.upload.selector).first();
    await input.waitFor({ state: 'attached', timeout: step.timeout || 15000 });
    if (!dryRun) {
      const assetPath = resolveFlowAssetPath(flowPath, step.upload.path);
      if (!fs.existsSync(assetPath)) {
        throw new Error(`upload fixture is missing: ${assetPath}`);
      }
      await input.setInputFiles(assetPath);
      await settle(page, step.upload.settle || 1500);
    }
  }

  if (step.zoom) {
    const target = await locateCenter(page, step.zoom, step.timeout || 15000);
    await overlay.moveTo(target.x, target.y, 600);
    await overlay.zoom(target.x, target.y, step.scale || 1.5);
  }

  if (step.expectVisible) {
    await waitForVisibleMatch(page, page.locator(step.expectVisible), step.expectVisible, step.timeout || 15000);
  }
  if (step.expectText) {
    await waitForVisibleMatch(
      page,
      page.getByText(step.expectText, { exact: false }),
      `text ${JSON.stringify(step.expectText)}`,
      step.timeout || 20000,
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

  await hold(step.hold);
  await hold(step.pause);
}

/**
 * Describe a step compactly for logs — the offending selector must always be
 * visible in a failure/skip message.
 */
export function describeStep(step) {
  for (const key of ['goto', 'click', 'zoom', 'expectVisible', 'expectText']) {
    if (step[key]) return `${key}=${JSON.stringify(step[key])}`;
  }
  if (step.type) return `type=${JSON.stringify(step.type.selector)}`;
  if (step.date) return `date=${JSON.stringify(step.date.label)}`;
  if (step.upload) return `upload=${JSON.stringify(step.upload.selector)}`;
  if (step.expectTexts) return `expectTexts=${JSON.stringify(step.expectTexts.slice(0, 2))}`;
  if (step.caption) return `caption=${JSON.stringify(step.caption.slice(0, 40))}`;
  return 'pause';
}

/**
 * Run every step of a flow through the seam and return a report.
 *
 * `strict` (the default) makes a skipped step fail the run: a silently skipped
 * step is how a broken video reached the docs site before. A guard page always
 * aborts, strict or not — continuing past it can only record garbage.
 */
export async function runFlow(page, flow, ctx) {
  const { strict = true, log = console } = ctx;
  const results = [];

  for (const [index, step] of flow.steps.entries()) {
    const label = `step ${index + 1}/${flow.steps.length} (${describeStep(step)})`;
    try {
      await runStep(page, step, ctx);
      results.push({ index, step, status: 'ok' });
    } catch (error) {
      if (error instanceof FlowAbortError) {
        log.error(`\n✖ ${label} — ${error.message}`);
        throw error;
      }
      const message = `${label} failed: ${error.message}`;
      results.push({ index, step, status: 'skipped', error: message });
      if (strict) {
        throw new Error(`training-video ${message}`, { cause: error });
      }
      log.warn(`⚠ skipped ${message}`);
    }
  }

  const skipped = results.filter((entry) => entry.status === 'skipped');
  return { results, skipped, ok: skipped.length === 0 };
}
