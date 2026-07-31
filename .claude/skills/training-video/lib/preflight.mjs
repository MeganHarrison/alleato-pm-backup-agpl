// Headless preflight — validate a flow against a running target WITHOUT
// rendering a video. Same flow-runner seam the recorder uses, so a green
// preflight means the recorder can drive the flow.
//
// Usage:
//   node lib/preflight.mjs flows/<flow>.json [--base http://localhost:3000] [--headed]
//
// Exit 0 = every step resolved. Exit 1 = a step failed, with the offending
// selector and the reason. Seconds instead of a multi-minute record.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateFlow } from './flow-validation.mjs';
import { FlowAbortError, NULL_OVERLAY, describeStep, runFlow } from './flow-runner.mjs';
import { assertFlowEntryReachable, ensureSession, readEnvCreds } from './session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
const STATE = path.join(SKILL_DIR, '.auth', 'state.json');

const args = process.argv.slice(2);
const flowArg = args.find((arg) => !arg.startsWith('--'));
if (!flowArg) {
  console.error('usage: node lib/preflight.mjs flows/<flow>.json [--base URL] [--headed]');
  process.exit(1);
}
const baseIndex = args.indexOf('--base');
const flowPath = path.resolve(flowArg);
const flow = validateFlow(JSON.parse(fs.readFileSync(flowPath, 'utf8')), flowPath);
const base = (baseIndex >= 0 ? args[baseIndex + 1] : undefined) || flow.base || 'http://localhost:3000';
const viewport = flow.viewport || { width: 1440, height: 900 };
const headed = args.includes('--headed');

fs.mkdirSync(path.dirname(STATE), { recursive: true });

async function main() {
  console.log(`preflight: ${flow.name || path.basename(flowPath)} → ${base}`);
  const browser = await chromium.launch({ headless: !headed });
  try {
    const { email, password } = readEnvCreds(SKILL_DIR);
    await ensureSession({ browser, statePath: STATE, base, viewport, email, password });
    await assertFlowEntryReachable({
      browser, statePath: STATE, base, viewport, startPath: flow.startPath || '/',
    });

    const ctx = await browser.newContext({ storageState: STATE, viewport });
    ctx.setDefaultNavigationTimeout(60000);
    const page = await ctx.newPage();
    await page.goto(base + (flow.startPath || '/'), { waitUntil: 'domcontentloaded' });

    const report = await runFlow(page, flow, {
      base,
      overlay: NULL_OVERLAY,
      flowPath,
      bareFootage: true,
      dryRun: true,
      strict: false, // collect EVERY unresolved step, don't stop at the first
    });

    for (const entry of report.results) {
      const mark = entry.status === 'ok' ? '✓' : '✗';
      console.log(`  ${mark} ${entry.index + 1}. ${describeStep(entry.step)}`);
      if (entry.error) console.log(`      ${entry.error}`);
    }

    await ctx.close();

    if (!report.ok) {
      console.error(`\n✖ preflight failed: ${report.skipped.length}/${flow.steps.length} step(s) did not resolve.`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n✅ preflight passed: all ${flow.steps.length} steps resolved against ${base}.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  if (error instanceof FlowAbortError) {
    console.error(`\n✖ ${error.message}`);
  } else {
    console.error(`\n✖ preflight error: ${error.message}`);
  }
  process.exit(1);
});
