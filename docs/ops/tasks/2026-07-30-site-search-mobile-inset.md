# Task: Add mobile side inset to shared modals

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: LOCAL-SITE-SEARCH-MOBILE-INSET
Linear Issue: Not required for bounded Standard work
Related Handoff: N/A

## Objective

Keep the site-wide search surface one rem away from each mobile viewport edge.

## Scope

- Shared `ModalContent` responsive width ownership and its focused contract test.
- Authenticated desktop and 390px site-wide search verification.
- Excludes search data, ranking, navigation, and API behavior.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/components/ui/unified-modal.tsx`
- Existing shared primitives/services: `ModalContent`
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Shared modals retain a one-rem side inset below the `sm` breakpoint.
- [x] Configured modal sizes remain owned by the shared size variants from `sm` upward.
- [x] The authenticated site-wide search shows the inset at 390px.
- [x] Desktop search geometry remains unchanged.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are N/A.

## Integration and Verification

- [x] Focused unit check passes.
- [x] Shared surface complexity audit passes.
- [x] Authenticated desktop and mobile screenshots prove the final search geometry.
- [x] Task-owned files are published to `origin/main` through the exact-file remote publisher.

## Failure-Loudly Contract

- Cause surfaced as: focused test failure when `ModalContent` loses the mobile inset class.
- Detection path: shared modal unit test plus 390px authenticated browser geometry readback.
- Recovery path: restore the shared mobile max-width contract instead of adding feature-local margins.

## Incident Learning

- Failure fingerprint: N/A, bounded visual defect rather than a significant or recurring incident.
- Root cause: the shared modal used `w-full` with size max-widths active on every viewport.
- Detection gap: no shared modal test asserted a mobile viewport inset.
- Prevention: shared class contract test and final 390px screenshot.
- Guardrail evidence: `pnpm exec jest src/components/ui/__tests__/unified-modal.test.tsx --runInBand` passed.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Browser computed geometry at 390px | Fail before fix | Dialog measured left 0, right 390, width 390, with 0px side padding. |
| Focused unit test | `pnpm exec jest src/components/ui/__tests__/unified-modal.test.tsx --runInBand` | Pass | One test passed without warnings. |
| Targeted lint | `pnpm exec eslint src/components/ui/unified-modal.tsx src/components/ui/__tests__/unified-modal.test.tsx` | Pass | No diagnostics. |
| Surface audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/components/ui/unified-modal.tsx` | Pass | Shared modal passed. |
| Mobile geometry | Browser computed geometry at 390px | Pass | Dialog measured left 16, right 374, width 358. |
| Mobile screenshot | `docs/ops/evidence/2026-07-30-site-search-mobile-inset/mobile.png` | Pass | Authenticated search with live company results. |
| Desktop geometry | Browser computed geometry at 1440px | Pass | Dialog retained its 576px `xl` width. |
| Desktop screenshot | `docs/ops/evidence/2026-07-30-site-search-mobile-inset/desktop.png` | Pass | Authenticated search with live company results. |
| Publication | Exact-file remote main publisher | Pass | Published without staging or modifying unrelated platform-kit conflicts. |

## Remaining Risk

- None identified at the changed responsive boundary.

## Final Status

- [x] All required checklist items are complete after publication.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
