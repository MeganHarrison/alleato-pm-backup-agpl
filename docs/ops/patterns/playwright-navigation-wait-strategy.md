# Pattern: Playwright Navigation Wait Strategy

Last validated: 2026-04-14
Severity: High
Category: Testing stability

## Problem

`waitForLoadState('networkidle')` is flaky in modern apps with ongoing background traffic.

## Required Rule

- Prefer `waitForLoadState('domcontentloaded')` after navigation.
- Wait for explicit UI elements when asserting readiness.

Example:

```ts
await page.goto(url);
await page.waitForLoadState("domcontentloaded");
await page.getByRole("heading", { name: /.../i }).waitFor();
```

## Failure Signals

- Intermittent navigation timeouts.
- CI-only test failures tied to idle-state waits.

## Evidence Source

- Legacy references: `docs/patterns/errors/networkidle-timeout.md`
- Guardrails reference: `AGENTS.md`
