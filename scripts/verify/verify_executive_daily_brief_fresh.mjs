#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const frontendRoot = path.join(repoRoot, "frontend");
const authState = path.join(frontendRoot, "tests", ".auth", "user.json");
const baseUrl =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000";
const timeoutMs = Number(process.env.EXECUTIVE_DAILY_BRIEF_VERIFY_TIMEOUT_MS ?? 180_000);
const windowDays = Number(process.env.EXECUTIVE_DAILY_BRIEF_VERIFY_DAYS ?? 3);
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(
  frontendRoot,
  "tests",
  "agent-browser-runs",
  `${runStamp}-executive-daily-brief-fresh`,
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function requiredArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
  return value;
}

function validatePacket(packet) {
  assert(packet && typeof packet === "object", "Daily brief response was not an object.");
  assert(packet.generatedAt, "Daily brief response is missing generatedAt.");
  assert(packet.sections && typeof packet.sections === "object", "Daily brief response is missing sections.");
  assert(packet.operatingBrief && typeof packet.operatingBrief === "object", "Daily brief response is missing operatingBrief.");

  const sections = packet.sections;
  requiredArray(sections.needsBrandon, "sections.needsBrandon");
  requiredArray(sections.waitingOnOthers, "sections.waitingOnOthers");
  requiredArray(sections.importantUpdates, "sections.importantUpdates");

  const brief = packet.operatingBrief;
  requiredArray(brief.startHere, "operatingBrief.startHere");
  requiredArray(brief.topExecutiveFocus, "operatingBrief.topExecutiveFocus");
  requiredArray(brief.projectRiskRadar, "operatingBrief.projectRiskRadar");
  requiredArray(brief.cashAndMarginWatch, "operatingBrief.cashAndMarginWatch");
  requiredArray(brief.peopleAndAccountability, "operatingBrief.peopleAndAccountability");
  requiredArray(brief.importantBusinessSignals, "operatingBrief.importantBusinessSignals");
  requiredArray(brief.recommendedMoves, "operatingBrief.recommendedMoves");
  assert(
    brief.additionalMaterialItems && typeof brief.additionalMaterialItems === "object",
    "operatingBrief.additionalMaterialItems must be an object.",
  );
  assert(
    brief.waitingOn && typeof brief.waitingOn === "object",
    "operatingBrief.waitingOn must be an object.",
  );
  requiredArray(brief.waitingOn.brandonWaitingOn, "operatingBrief.waitingOn.brandonWaitingOn");
  requiredArray(
    brief.waitingOn.othersWaitingOnBrandon,
    "operatingBrief.waitingOn.othersWaitingOnBrandon",
  );
  assert(
    brief.recommendedMoves.length > 0,
    "operatingBrief.recommendedMoves must contain at least one executable move.",
  );

  return {
    generatedAt: packet.generatedAt,
    counts: {
      needsBrandon: sections.needsBrandon.length,
      waitingOnOthers: sections.waitingOnOthers.length,
      importantUpdates: sections.importantUpdates.length,
      topExecutiveFocus: brief.topExecutiveFocus.length,
      additionalMaterialItems: Object.values(brief.additionalMaterialItems).reduce(
        (total, items) => total + (Array.isArray(items) ? items.length : 0),
        0,
      ),
      projectRiskRadar: brief.projectRiskRadar.length,
      cashAndMarginWatch: brief.cashAndMarginWatch.length,
      recommendedMoves: brief.recommendedMoves.length,
    },
  };
}

async function openAuthenticatedExecutivePage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authState });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.goto(`${baseUrl}/executive`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });

  return { browser, page };
}

async function verifyRenderedPage(page, summary) {
  const requiredText = [
    "Start Here",
    "Top Executive Focus",
    "Additional Material Items",
    "Project Risk Radar",
    "Cash and Margin Watch",
    "Waiting on Others / Others Waiting on Brandon",
    "People and Accountability",
    "Important Business Signals",
    "Recommended Moves",
  ];

  for (const text of requiredText) {
    await page.getByText(text, { exact: true }).first().waitFor({
      state: "visible",
      timeout: timeoutMs,
    });
  }

  await page.screenshot({
    path: path.join(runDir, "executive-page-after-fresh.png"),
    fullPage: true,
  });
  const pageText = await page.locator("body").innerText({ timeout: timeoutMs });
  writeFileSync(path.join(runDir, "executive-page-text-after-fresh.txt"), pageText);

  return {
    ...summary,
    renderedSections: requiredText,
  };
}

async function main() {
  if (!existsSync(authState)) {
    fail(
      `Missing auth state at ${authState}. Run: cd frontend && npx playwright test tests/auth.setup.ts`,
    );
  }

  mkdirSync(runDir, { recursive: true });

  const { browser, page } = await openAuthenticatedExecutivePage();

  const startedAt = Date.now();
  const response = await page.evaluate(
    async ({ days }) => {
      const res = await fetch(`/api/executive/daily-brief?days=${days}&fresh=true`, {
        headers: { accept: "application/json" },
      });
      return {
        ok: res.ok,
        status: res.status,
        text: await res.text(),
      };
    },
    { days: windowDays },
  );
  const durationMs = Date.now() - startedAt;
  const text = response.text;
  writeFileSync(path.join(runDir, "fresh-response.json"), text);

  assert(
    response.ok,
    `Fresh daily brief request failed with ${response.status} after ${durationMs}ms: ${text.slice(0, 1000)}`,
  );

  let packet;
  try {
    packet = JSON.parse(text);
  } catch (error) {
    fail(
      `Fresh daily brief response was not valid JSON after ${durationMs}ms: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const packetSummary = validatePacket(packet);
  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  const summary = await verifyRenderedPage(page, {
    ok: true,
    baseUrl,
    windowDays,
    durationMs,
    runDir,
    ...packetSummary,
  });
  await browser.close();

  writeFileSync(
    path.join(runDir, "VERIFICATION_SUMMARY.md"),
    [
      "# Executive Daily Brief Fresh Verification",
      "",
      `- Status: PASS`,
      `- Base URL: ${summary.baseUrl}`,
      `- Fresh endpoint duration: ${summary.durationMs}ms`,
      `- Generated at: ${summary.generatedAt}`,
      `- Window days: ${summary.windowDays}`,
      `- Counts: ${JSON.stringify(summary.counts)}`,
      `- Rendered sections: ${summary.renderedSections.join(", ")}`,
      `- Screenshot: executive-page-after-fresh.png`,
      `- Response: fresh-response.json`,
    ].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        durationMs: summary.durationMs,
        generatedAt: summary.generatedAt,
        counts: summary.counts,
        runDir: summary.runDir,
      },
      null,
      2,
    ),
  );
}

await main();
