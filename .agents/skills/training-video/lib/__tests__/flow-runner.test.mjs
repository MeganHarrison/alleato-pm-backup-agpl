// Regression tests for the reliability class of bug that made the recorder
// "fail on the form step about half the time" (2026-07-29).
//
// Confirmed root cause: the flow targeted a deleted project. The app renders the
// project shell optimistically for ~4.5s and then redirects to
// /access-denied?reason=no-project-access. Early steps passed inside that window;
// later steps failed against a guard page and reported a misleading selector
// timeout. A second, independent break: the flow's upload fixture lived in a
// transient docs/ops/evidence folder that an unrelated cleanup commit deleted.
//
// These tests pin both guardrails.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FlowAbortError,
  NULL_OVERLAY,
  assertPageUsable,
  describeStep,
  detectGuardPage,
  runFlow,
  typedValueSatisfied,
} from '../flow-runner.mjs';
import { resolveFlowAssetPath, validateFlow } from '../flow-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '..', '..');
const FLOWS_DIR = path.join(SKILL_DIR, 'flows');

/** Minimal page double — no browser, fully deterministic. */
function fakePage(url = 'http://localhost:3000/67/directory') {
  const emptyLocator = {
    count: async () => 0,
    nth: () => ({ isVisible: async () => false }),
  };
  return {
    url: () => url,
    waitForTimeout: async () => {},
    waitForLoadState: async () => {},
    locator: () => emptyLocator,
    getByText: () => emptyLocator,
    getByRole: () => emptyLocator,
  };
}

const baseCtx = {
  base: 'http://localhost:3000',
  overlay: NULL_OVERLAY,
  flowPath: path.join(FLOWS_DIR, 'example-tour.json'),
  bareFootage: true,
  dryRun: true,
  log: { log() {}, warn() {}, error() {} },
};

test('detectGuardPage flags the app destinations that mean "you cannot see this"', () => {
  const denied = detectGuardPage('http://localhost:3000/access-denied?reason=no-project-access');
  assert.ok(denied, 'access-denied must be treated as a guard page');
  assert.match(denied.reason, /deleted or that this user is not a member of/);

  assert.ok(detectGuardPage('http://localhost:3000/auth/login'), 'login redirect is a guard page');
  assert.match(detectGuardPage('http://localhost:3000/auth/login').reason, /not authenticated/);
  assert.ok(detectGuardPage('http://localhost:3000/not-found'), 'not-found is a guard page');
});

test('detectGuardPage does not flag ordinary app routes', () => {
  for (const url of [
    'http://localhost:3000/67/directory',
    'http://localhost:3000/67/prime-contracts/new',
    'http://localhost:3000/tasks',
  ]) {
    assert.equal(detectGuardPage(url), null, `${url} must not be treated as a guard page`);
  }
});

test('assertPageUsable aborts with the reason AND the landed URL', async () => {
  const page = fakePage('http://localhost:3000/access-denied?reason=no-project-access');
  await assert.rejects(
    () => assertPageUsable(page, 'step 2'),
    (error) => {
      assert.ok(error instanceof FlowAbortError, 'must be a FlowAbortError, not a generic timeout');
      assert.match(error.message, /step 2/);
      assert.match(error.message, /access-denied\?reason=no-project-access/);
      return true;
    },
  );
});

test('a guard-page redirect aborts the run immediately — never a selector timeout', async () => {
  // This is the exact failure the recorder used to mis-report: the project shell
  // renders, then the access check redirects, and the NEXT step used to burn its
  // full timeout and blame the selector.
  const page = fakePage('http://localhost:3000/access-denied?reason=no-project-access');
  const flow = { steps: [{ click: 'button:has-text("440 West Inc.")', timeout: 100 }] };

  await assert.rejects(
    () => runFlow(page, flow, { ...baseCtx, strict: false }),
    (error) => {
      assert.ok(error instanceof FlowAbortError, 'guard pages abort even when strict is off');
      assert.match(error.message, /access-denied/);
      return true;
    },
  );
});

test('strict runs fail on the first unresolved step and name the offending selector', async () => {
  const page = fakePage();
  const flow = { steps: [{ pause: 1 }, { expectVisible: '[data-testid="sov-line-0"]', timeout: 100 }] };

  await assert.rejects(
    () => runFlow(page, flow, { ...baseCtx, strict: true }),
    (error) => {
      assert.match(error.message, /step 2\/2/);
      assert.match(error.message, /sov-line-0/, 'the offending selector must appear in the message');
      return true;
    },
  );
});

test('non-strict runs collect every unresolved step and report ok=false', async () => {
  const page = fakePage();
  const flow = {
    steps: [
      { pause: 1 },
      { expectVisible: '#missing-a', timeout: 100 },
      { expectVisible: '#missing-b', timeout: 100 },
    ],
  };

  const report = await runFlow(page, flow, { ...baseCtx, strict: false });
  assert.equal(report.ok, false, 'a run with skipped steps is never ok');
  assert.equal(report.skipped.length, 2, 'every unresolved step is collected, not just the first');
  assert.match(report.skipped[0].error, /#missing-a/);
  assert.match(report.skipped[1].error, /#missing-b/);
});

test('a fully resolving flow reports ok with zero skips', async () => {
  const report = await runFlow(fakePage(), { steps: [{ pause: 1 }, { pause: 1 }] }, { ...baseCtx, strict: true });
  assert.equal(report.ok, true);
  assert.equal(report.skipped.length, 0);
});

test('describeStep surfaces the selector for every step shape', () => {
  assert.match(describeStep({ click: 'button:has-text("Import")' }), /button:has-text\(\\?"Import/);
  assert.match(describeStep({ type: { selector: 'input[name="number"]', text: 'x' } }), /input\[name=/);
  assert.match(describeStep({ date: { label: 'Start Date', value: '2026-08-03' } }), /Start Date/);
  assert.match(describeStep({ upload: { selector: 'input[type="file"]', path: 'a.xlsx' } }), /input\[type=/);
  assert.match(describeStep({ goto: '/67/prime-contracts/new' }), /prime-contracts\/new/);
});

// --- Guardrail for #193: typed-value readback on formatted/masked inputs ------
// The recorder types into a field, then reads the value back to prove the text
// landed. Formatted inputs reflect the typed text back reformatted, and a raw
// substring check aborted the whole recording on those (the retainage field
// turns "10" into "10.00"). typedValueSatisfied tolerates reformatting while
// still failing loudly on a genuinely empty or wrong field.
test('typedValueSatisfied accepts reformatted values but still rejects wrong ones (#193)', () => {
  // Reformatted reflections that must PASS:
  assert.ok(typedValueSatisfied('10.00', '10'), 'retainage "10" -> "10.00"');
  assert.ok(typedValueSatisfied('$1,250.00', '1250'), 'currency thousands + cents');
  assert.ok(typedValueSatisfied('$1,250.00', '1,250.00'), 'currency with a typed comma');
  assert.ok(typedValueSatisfied('(317) 555-0100', '3175550100'), 'phone mask around raw digits');
  assert.ok(typedValueSatisfied('(317) 555-0100', '(317) 555-0100'), 'phone typed already-masked');
  assert.ok(typedValueSatisfied('PC-001', 'PC-001'), 'exact match still passes');
  assert.ok(typedValueSatisfied('  Acme Corp  ', 'Acme Corp'), 'surrounding whitespace tolerated');

  // Genuine failures that must STILL abort:
  assert.ok(!typedValueSatisfied('', '10'), 'an empty field never satisfies typed text');
  assert.ok(!typedValueSatisfied('20.00', '10'), 'a different value must fail loudly');
  assert.ok(!typedValueSatisfied('$400.00', '1250'), 'wrong currency amount must fail');
});

// --- Guardrail for the second, independent break -----------------------------
// The upload fixture used to live in docs/ops/evidence/<dated-folder>/, which an
// unrelated "eradicate obsolete artifacts" commit deleted — silently breaking
// the recorder. Fixtures must be owned by the skill.
test('every flow upload fixture exists and is owned by the skill directory', () => {
  const flowFiles = fs.readdirSync(FLOWS_DIR).filter((file) => file.endsWith('.json'));
  assert.ok(flowFiles.length > 0, 'expected at least one flow file');

  for (const file of flowFiles) {
    const flowPath = path.join(FLOWS_DIR, file);
    const flow = validateFlow(JSON.parse(fs.readFileSync(flowPath, 'utf8')), flowPath);
    for (const step of flow.steps) {
      if (!step.upload) continue;
      const assetPath = resolveFlowAssetPath(flowPath, step.upload.path);
      assert.ok(fs.existsSync(assetPath), `${file}: upload fixture is missing: ${assetPath}`);
      assert.ok(
        path.relative(SKILL_DIR, assetPath).startsWith('assets' + path.sep),
        `${file}: upload fixture must live in the skill's assets/ directory so an unrelated `
        + `cleanup cannot delete it (got ${assetPath})`,
      );
    }
  }
});
