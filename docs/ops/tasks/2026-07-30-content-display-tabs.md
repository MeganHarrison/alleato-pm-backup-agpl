# Task: Content Display Tabs

Status: Complete
Owner: Codex S-content-display-tabs
Created: 2026-07-30
Task ID: AAI-1295
Linear Issue: https://linear.app/megankharrison/issue/AAI-1295/add-content-display-area-tabs-and-catalog-control
Delivery lane: High-risk
Verification contract: Required

## Objective

Add Training, Resources, SOPs, and Documentation tabs to Content Studio and a
governed display-area column that determines the catalog destination for each
content item without changing its underlying content type.

## Acceptance Contract

- [x] A separate display-area field distinguishes placement from content type.
- [x] Existing content is backfilled deterministically.
- [x] New content receives a correct default display area.
- [x] Content Studio tabs filter one canonical table implementation.
- [x] The Displayed in column is visible and editable for authorized creators.
- [x] Employee training-library queries include only Training and Resources.
- [x] Invalid or unauthorized mutations fail loudly.
- [x] Migration, ledger, generated types, browser journey, and screenshots pass.
- [x] Exact task-owned files are published to `origin/main`.

## Evidence

- Live migrations applied:
  - `20260731025204_add_knowledge_display_area.sql`
  - `20260731030157_allow_learning_admin_display_area_updates.sql`
  - `20260731030254_revoke_anonymous_display_area_rpc.sql`
- Remote migration ledger readback contains all three exact versions.
- Backfill distribution: Training 6, Resources 95, SOPs 4,
  Documentation 95.
- Mutation privileges: `anon_execute=false`,
  `authenticated_execute=true`; the function also requires
  `current_is_learning_admin()`.
- Training library readback: 71 published items, all in Training or Resources.
- Authenticated browser journey moved `Construction Cost Management` from
  Training to Resources, confirmed the row moved tabs, then restored it to
  Training. Final database readback confirmed `display_area=training`.
- Targeted checks:
  - content-studio ESLint: pass
  - content-studio Jest guard: 2 tests pass
  - `npm run check:routes`: pass
  - `npm --prefix frontend run typecheck:changed`: pass
  - `npm --prefix frontend run audit:tabs`: pass
  - Impeccable surface-complexity audit: pass
- Final-route proof:
  - `docs/ops/evidence/2026-07-30-content-display-tabs/content-studio-tabs-desktop-final.png`
  - `docs/ops/evidence/2026-07-30-content-display-tabs/content-studio-display-area-select-desktop-final.png`
  - `docs/ops/evidence/2026-07-30-content-display-tabs/content-studio-tabs-mobile-final.png`
- Exact files were published to `origin/main`; unrelated local merge conflicts
  were not staged or modified.

## Known Unrelated Repository Debt

- The repository-wide migration verifier is blocked by duplicate pre-existing
  local migration version `20260729190000`. Exact remote ledger verification
  for this task's three versions passed.
- Repository-wide `git diff --check` is blocked by pre-existing unresolved
  conflicts in Platform Kit files. Task-owned files pass the focused checks.

## Noise Gate

Pass. The implementation reuses `UnifiedTablePage`, its tab seam, and the
shared editable-select column. It adds no wrapper cards, duplicate actions,
dashboard metrics, or page-local table implementation. The remaining risk is
placement drift from future direct database writes; the insert trigger and
database enum are the guardrails.

## Failure-Loudly Contract

- Cause: server action returns the catalog row and surfaces specific validation,
  authorization, or database errors.
- Detection: SQL readback, generated types, targeted tests, and authenticated
  inline-edit browser proof.
- Recovery: retain the current placement when persistence fails and let the
  creator retry from the same table cell.
