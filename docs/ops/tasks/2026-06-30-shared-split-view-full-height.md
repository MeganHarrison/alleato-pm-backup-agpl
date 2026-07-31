# Shared Split View Full Height

## Metadata
- Linear: AAI-769 https://linear.app/megankharrison/issue/AAI-769/fix-shared-split-view-pages-to-use-full-available-viewport-height
- Priority: High
- Status: Complete
- Owner: Codex

## Problem
`https://projects.alleatogroup.com/emails` is cut off mid-screen. The same split-view layout is reused by multiple surfaces, so the fix must live in the shared split-view owner instead of the email page.

## Root Cause
- Evidence gathered: after the first split-view patch, the authenticated `/emails` screenshot still showed the list/detail split ending above the viewport. The table shell still rendered a footer below route content, and the split root still used hard-coded `calc(100dvh - ...)` height subtraction.
- Cause: footer-bearing app shells and fixed viewport subtraction were both competing with the actual shell height. Once the footer was suppressed, the `100dvh` subtraction became the remaining cutoff source.
- Detection gap: the existing unit guardrails covered header/mobile toolbar behavior, but not shell footer suppression or the split-view flex-fill contract.
- Prevention step: add shell-level guardrails for footerless full-height workspaces and assert shared split roots use parent-owned `h-full min-h-0 flex-1` instead of viewport subtraction.

## Scope
- [x] Patch `UnifiedTablePage` so all `views.split` consumers inherit a full-height split container.
- [x] Patch the dedicated email inbox split root used by `/emails?tab=...` and `/outlook-draft-feedback`.
- [x] Suppress shell footers where split workspaces must own the full remaining app height.
- [x] Preserve existing email, tasks, and insights split-view renderers.
- [x] Add targeted unit guardrails for shell footer suppression and shared split-view height contracts.
- [x] Run targeted test/lint verification.
- [x] Record evidence and remaining risk.

## Out Of Scope
- No email data/API changes.
- No page-local `/emails` styling override.
- No unrelated table inline-edit changes from the dirty source checkout.

## Evidence
- Changed `frontend/src/app/(tables)/layout.tsx` to remove the table-shell footer and keep the route content on the full remaining app height.
- Changed `frontend/src/app/(main)/layout.tsx` and `frontend/src/app/(admin)/layout.tsx` to suppress footers on full-height split workspaces outside the table route group.
- Changed `frontend/src/components/tables/unified/unified-table-page.tsx` to export and use shared split-view classes that fill parent shell height without `100dvh` subtraction.
- Changed `frontend/src/features/emails/inbox/email-inbox-client.tsx` to use the same flex-fill split contract for the dedicated `/emails?tab=...` inbox surface.
- Added `frontend/src/components/layout/__tests__/site-footer-shell.test.ts` assertions for footerless full-height shells.
- Added `frontend/src/components/tables/unified/__tests__/unified-table-page.test.ts` assertions for split container height, min-height, flex growth, overflow containment, bottom padding removal, and no viewport subtraction.
- Added `frontend/src/features/emails/inbox/__tests__/email-inbox-client.test.ts` assertions for the inbox split root height contract and no viewport subtraction.
- Passed: `cd frontend && npm run test:unit -- --runTestsByPath src/components/layout/__tests__/site-footer-shell.test.ts src/components/tables/unified/__tests__/unified-table-page.test.ts src/features/emails/inbox/__tests__/email-inbox-client.test.ts`.
- Passed: `cd frontend && npx eslint 'src/app/(tables)/layout.tsx' 'src/app/(main)/layout.tsx' 'src/app/(admin)/layout.tsx' src/components/layout/__tests__/site-footer-shell.test.ts src/components/tables/unified/unified-table-page.tsx src/components/tables/unified/__tests__/unified-table-page.test.ts src/features/emails/inbox/email-inbox-client.tsx src/features/emails/inbox/__tests__/email-inbox-client.test.ts`.
- Passed: `git diff --check -- frontend/src/app/(tables)/layout.tsx frontend/src/app/(main)/layout.tsx frontend/src/app/(admin)/layout.tsx frontend/src/components/layout/__tests__/site-footer-shell.test.ts frontend/src/components/tables/unified/unified-table-page.tsx frontend/src/components/tables/unified/__tests__/unified-table-page.test.ts frontend/src/features/emails/inbox/email-inbox-client.tsx frontend/src/features/emails/inbox/__tests__/email-inbox-client.test.ts docs/ops/tasks/2026-06-30-shared-split-view-full-height.md`.
- Browser auth proof attempted in the source checkout: `agent-browser` redirected to `/auth/login?callbackUrl=%2Femails%3Ftab%3Dbrandon-queue`; saved `alleato-test` auth profile did not sign in. Authenticated screenshot proof remains blocked by local auth/session state.

## Noise Gate
- Primary user: Brandon/admin email reviewer.
- Primary job: scan messages and inspect a selected thread without losing context.
- Primary decision: which message needs attention and what action to take.
- Tier 1: split list and detail pane filling the available workspace.
- Tier 2: selected state, row content, reading pane.
- Tier 3: tabs, filters, secondary actions.
- Hide until requested: advanced/secondary metadata.
- Remove: clipped split wrapper behavior, footer competition, viewport-subtraction sizing, and blank unused screen area.
- Primary action: select a row and act from the reading pane.
- Failure-loudly behavior: unit guardrails check full-height shells suppress footers and shared split wrappers fill parent height without viewport subtraction.

## Verification
- [x] `cd frontend && npm run test:unit -- --runTestsByPath src/components/layout/__tests__/site-footer-shell.test.ts src/components/tables/unified/__tests__/unified-table-page.test.ts src/features/emails/inbox/__tests__/email-inbox-client.test.ts`
- [x] `cd frontend && npx eslint 'src/app/(tables)/layout.tsx' 'src/app/(main)/layout.tsx' 'src/app/(admin)/layout.tsx' src/components/layout/__tests__/site-footer-shell.test.ts src/components/tables/unified/unified-table-page.tsx src/components/tables/unified/__tests__/unified-table-page.test.ts src/features/emails/inbox/email-inbox-client.tsx src/features/emails/inbox/__tests__/email-inbox-client.test.ts`
- [x] Targeted file inspection confirms the split fix is shared, not page-local, and no split root uses viewport subtraction.
