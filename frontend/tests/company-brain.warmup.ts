import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  COMPANY_BRAIN_HYDRATED_SELECTOR,
  companyBrainRoute,
} from "./helpers/company-brain";

/**
 * Runs once, before the Company Brain specs, as its own Playwright project.
 *
 * Two jobs:
 *  1. Pay Next's on-demand dev compile for /ai/company-brain here, so the first
 *     real assertion is not racing a compile that 404s the client chunks.
 *  2. Prove ?fixture= is actually honored. If the server was started without
 *     COMPANY_BRAIN_TEST_FIXTURES=1, every fixture URL silently falls through
 *     to the live Supabase loader — 120s page.goto timeouts across the suite,
 *     and an empty-state test that can never pass. That misconfiguration has
 *     already produced one false "suite is not green" result.
 */
test("company brain route compiles and fixtures are enabled", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const url = companyBrainRoute("empty");
  const failures: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { timeout: 45_000 });
      await page.waitForSelector(COMPANY_BRAIN_HYDRATED_SELECTOR, {
        state: "attached",
        timeout: 30_000,
      });
      // Only the fixture loader renders this. Live data never does.
      await expect(
        page.getByRole("heading", { name: "No knowledge sources yet" }),
      ).toBeVisible({ timeout: 15_000 });
      return;
    } catch (error) {
      failures.push(
        `attempt ${attempt}: ${(error as Error).message.split("\n")[0]}`,
      );
    }
  }

  throw new Error(
    [
      `Warm-up failed: ${url} did not render the fixture empty state.`,
      "",
      "Most likely cause: the server answering this URL was started without",
      "COMPANY_BRAIN_TEST_FIXTURES=1, so every ?fixture= URL falls through to the live",
      "Supabase loader (slow page loads, and an empty-state test that can never pass).",
      "config/playwright/playwright.config.company-brain.ts sets it in webServer.env, which",
      "only applies when Playwright starts the server itself. If you started `next dev` or",
      "`next start` by hand, export COMPANY_BRAIN_TEST_FIXTURES=1 before starting it.",
      "",
      ...failures,
    ].join("\n"),
  );
});

/**
 * Guardrail: keeps the hydration wait from silently regressing back to a raw
 * goto plus a negated-`disabled` assertion in a future edit.
 */
test("company brain specs route every navigation through the hydration helper", () => {
  const specs = [
    "e2e/company-brain.spec.ts",
    "company-brain-visual-regression.spec.ts",
  ];

  for (const spec of specs) {
    const source = readFileSync(path.join(__dirname, spec), "utf8");

    expect(
      source.includes("gotoCompanyBrain"),
      `${spec} must navigate via gotoCompanyBrain() from tests/helpers/company-brain.ts`,
    ).toBe(true);

    expect(
      /page\.goto\(\s*["'`][^"'`]*\/ai\/company-brain/.test(source),
      `${spec} has a raw page.goto() to /ai/company-brain — use gotoCompanyBrain() so the ` +
        "navigation retries when the dev server's client chunks 404.",
    ).toBe(false);

    expect(
      /getByTestId\(\s*["']brain-node-brain-core["']\s*\)\s*\)\s*\.toBeEnabled\(\)/.test(
        source,
      ),
      `${spec} waits on brain-core being enabled as a hydration proxy. That is a negated ` +
        "signal on one node; wait on data-hydrated via gotoCompanyBrain() instead.",
    ).toBe(false);
  }
});
