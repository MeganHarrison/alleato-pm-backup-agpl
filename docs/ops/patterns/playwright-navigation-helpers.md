# Pattern: Playwright Navigation Helpers

Last validated: 2026-04-14
Severity: Medium
Category: Testing ergonomics

## Problem

Copy-pasted navigation/wait logic drifts across tests and reintroduces flaky waits.

## Required Rule

- Centralize navigation waits in test helper utilities.
- Helpers must rely on `domcontentloaded` and explicit element waits.

## Baseline Helper Pattern

```ts
export async function safeNavigate(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
}

export async function navigateAndWaitFor(
  page: Page,
  url: string,
  selector: string
): Promise<void> {
  await safeNavigate(page, url);
  await page.locator(selector).waitFor({ state: "visible" });
}
```

## Failure Signals

- Repeated test-level custom waits with inconsistent behavior.
- New tests reintroducing `networkidle` waits.

## Evidence Source

- Legacy references: `docs/patterns/solutions/domcontentloaded-pattern.md`
