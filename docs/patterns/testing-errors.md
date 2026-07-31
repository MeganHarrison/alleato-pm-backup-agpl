# Testing Errors — Known Patterns & Solutions

> Append new entries at the bottom. Each entry must include Context, Error, Root Cause, Fix, and Prevention.

---

### Strict Mode Violation — Multiple Elements Match — 2026-01-31

**Context:** Direct costs E2E test asserting seeded data appears in table
**Error:** `Error: strict mode violation: getByText("Concrete delivery for foundations") resolved to 2 elements`
**Root Cause:** The description text appeared in both a summary `<p>` element and a table `<td>` cell. Playwright's strict mode requires exactly one match.
**Fix:** Changed `page.getByText("...")` to `page.getByRole("cell", { name: "..." })` to scope to table cells only.
**Prevention:** Never use `getByText()` for content that appears in tables — always use `getByRole("cell", { name: "..." })`. For other duplicates, use `.first()` or scope to a parent.

---

### networkidle Timeout — 2026-01-28

**Context:** Any Playwright test using `page.waitForLoadState('networkidle')`
**Error:** Test hangs and times out after 30-60 seconds
**Root Cause:** Modern apps with WebSocket/SSE connections (Supabase Realtime) never reach "network idle" state.
**Fix:** Replace `'networkidle'` with `'domcontentloaded'` everywhere.
**Prevention:** NEVER use `networkidle`. Use `domcontentloaded` or wait for specific elements. See `frontend/tests/helpers/navigation.ts`.

---

### Data Not Visible After Seeding — 2026-01-31

**Context:** E2E tests seed data via Supabase admin client then navigate to page
**Error:** Page loads but shows empty state or "Unable to load data" despite data existing in DB
**Root Cause:** Race condition — page loads before the Supabase INSERT commits, or React Query cache serves stale data.
**Fix:** Add reload fallback pattern:

```typescript
const visible = await page.getByRole("cell", { name: "..." })
  .isVisible({ timeout: 5000 }).catch(() => false);
if (!visible) {
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}
```

**Prevention:** Always include the reload fallback pattern when asserting seeded data visibility.

---

### Action Menu Strict Mode — Multiple Delete Items — 2026-01-31

**Context:** Commitments E2E test clicking delete from row action menu
**Error:** `getByRole("menuitem", { name: /delete/i })` resolved to 2 elements (header menu + row action)
**Fix:** Use `page.locator("[data-testid^='row-action-delete']").first()` or `page.getByRole("menuitem", { name: /delete/i }).first()`
**Prevention:** When targeting menu items, always use `.first()` or scope via data-testid to avoid matching header-level menus.

---

### Auth Session Expired Mid-Suite — 2026-01-31

**Context:** Running full financial test suite (3 suites, 23 tests, ~2.5 min)
**Error:** Test redirected to `/auth/login` unexpectedly mid-run
**Root Cause:** Auth cookie expired during long test runs
**Fix:** Delete `tests/.auth/user.json` and re-run (forces fresh login). Or run shorter suites individually.
**Prevention:** Check cookie expiry in auth setup. Consider refreshing auth mid-suite for very long runs.
