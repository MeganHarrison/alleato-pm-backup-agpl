import {
  expect,
  test,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

export const COMPANY_BRAIN_HYDRATED_SELECTOR =
  '[data-testid="company-brain-experience"][data-hydrated="true"]';

export const companyBrainRoute = (state = "ready") =>
  `/ai/company-brain?fixture=${state}`;

const HYDRATION_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

/**
 * Navigate to Company Brain and wait for React to actually hydrate.
 *
 * Next's dev server compiles this route on demand. A navigation that lands while
 * a compile/recompile is in flight gets HTML whose client chunks 404 — React
 * never hydrates and that page load is dead forever. Raising the timeout does
 * not help (verified: 45s fails identically). The only recovery is a fresh
 * navigation, so a failed hydration retries instead of waiting longer.
 *
 * The wait is on a positive signal (`data-hydrated="true"`, set from the same
 * mount state that enables the brain-core button) rather than a negated
 * `disabled` attribute on one node, so it also works for the empty, error, and
 * permission-limited states where that node does not exist.
 */
export async function gotoCompanyBrain(page: Page, state = "ready") {
  const url = companyBrainRoute(state);
  const deadAssets: string[] = [];

  const onResponse = (response: Response) => {
    if (response.status() === 404 && response.url().includes("/_next/")) {
      deadAssets.push(`404 ${response.url()}`);
    }
  };
  const onRequestFailed = (request: Request) => {
    if (request.url().includes("/_next/")) {
      deadAssets.push(
        `${request.failure()?.errorText ?? "failed"} ${request.url()}`,
      );
    }
  };

  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      deadAssets.length = 0;
      await page.goto(url);
      await expect(page).not.toHaveURL(/\/auth\/login/);

      const hydrated = await page
        .waitForSelector(COMPANY_BRAIN_HYDRATED_SELECTOR, {
          state: "attached",
          timeout: HYDRATION_TIMEOUT_MS,
        })
        .then(
          () => true,
          () => false,
        );

      if (hydrated) {
        if (attempt > 1) {
          // Surface the retry in the report so a rising retry rate stays
          // visible instead of being silently absorbed.
          test.info().annotations.push({
            type: "company-brain-hydration-retry",
            description: `${url} hydrated on attempt ${attempt}/${MAX_ATTEMPTS}: ${
              deadAssets.length
                ? deadAssets.join(", ")
                : "no asset failures observed"
            }`,
          });
        }
        return;
      }

      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          [
            `Company Brain never hydrated at ${url} after ${MAX_ATTEMPTS} navigations ` +
              `(${HYDRATION_TIMEOUT_MS}ms each).`,
            deadAssets.length
              ? `Client assets that failed on the last attempt:\n  ${deadAssets.join("\n  ")}\n` +
                "That is the dev-server compile race — the page was served before its chunks existed."
              : "No /_next/ asset failures were observed, so this is a real hydration failure in " +
                "the page itself (check the browser console in the trace), not a compile race.",
            "Do NOT 'fix' this by raising the timeout: a page whose client bundle 404ed never " +
              "hydrates at all, so waiting longer cannot help.",
          ].join("\n"),
        );
      }
    }
  } finally {
    page.off("response", onResponse);
    page.off("requestfailed", onRequestFailed);
  }
}
