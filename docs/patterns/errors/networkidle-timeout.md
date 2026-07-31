---
title: networkidle timeout
description: networkidle timeout documentation
---

# Pattern: NetworkIdle Timeout

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/playwright-navigation-wait-strategy.md`.

**Severity:** CRITICAL
**Triggers:** `playwright`, `test`, `waitForLoadState`, `networkidle`, `timeout`, `navigation`
**Category:** Testing

---

## The Mistake

Using `waitForLoadState('networkidle')` in Playwright tests causes timeouts because modern web applications have:

- Continuous polling (websockets, real-time updates)
- Background API calls that never fully settle
- Analytics and tracking that keep connections open

```typescript
// WRONG - Will timeout or be flaky
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');  // Hangs here
```diff
**Evidence:** 30+ test files in this codebase use `networkidle` and experience random timeouts.

---

## The Fix

Use `domcontentloaded` instead, which settles when the initial HTML is loaded:

```typescript
// CORRECT - Reliable and fast
await page.goto('/dashboard');
await page.waitForLoadState('domcontentloaded');

// If you need to wait for specific content, wait for that element:
await page.locator('[data-testid="dashboard-loaded"]').waitFor();
```typescript
**For navigation helpers, use:**

```typescript
// frontend/tests/helpers/navigation.ts
export async function safeNavigate(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}
```

---

## Detection

Signs this mistake is happening:

1. Tests timeout after 30-120 seconds
2. Tests pass sometimes, fail other times (flaky)
3. Error message includes "waiting for load state 'networkidle'"
4. Tests work locally but fail in CI

---

## References

- Fixed in: `frontend/tests/e2e/change-events*.spec.ts` (2026-01-10)
- Documentation: `.agents/docs/playwright/PLAYWRIGHT-PATTERNS.md`
- Related: auth-fixture-missing.md (often occurs together)
