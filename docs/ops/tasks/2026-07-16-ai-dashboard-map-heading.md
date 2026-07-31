# Task: Remove the Redundant Architecture Map Heading

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1132
Linear Issue: [AAI-1132](https://linear.app/megankharrison/issue/AAI-1132/remove-the-redundant-architecture-map-heading)
Related Handoff: `docs/ops/handoffs/2026-07-16-S174-ai-dashboard-map-heading.md`

## Objective

Remove the duplicate codebase-map eyebrow and heading while preserving the map, page introduction, later headings, and all interaction behavior.

## Scope

- Owner: the shared `WorkspaceSection` header option and the Architecture map invocation.
- Regression guard: the existing AI Dashboard workspace test suite.
- Exact visual proof: `/ai-dashboard/architecture` at desktop and mobile widths.
- Excluded: map content, path selection, page introduction copy, later sections, navigation, and sibling pages.

## Source of Truth

- Canonical UI owner: `frontend/src/app/(main)/ai-dashboard/workspace-primitives.tsx`.
- Architecture consumer: `frontend/src/app/(main)/ai-dashboard/architecture/architecture-assurance-preview.tsx`.
- Existing primitive: `WorkspaceSection`; no hidden duplicate markup or page-local display override is introduced.

Verification contract: Required

## Acceptance Criteria

- [x] Both duplicate text lines are absent from the rendered Architecture page.
- [x] The codebase map remains visible and interactive.
- [x] The page introduction and later section headings remain unchanged.
- [x] Headerless sections render no empty header wrapper and no header-to-content offset.
- [x] Desktop and mobile layouts remain overflow-safe.

## Implementation Checklist

- [x] AAI-1132 and S174 define the scope before implementation.
- [x] `WorkspaceSection` exposes a default-on header option.
- [x] Only the Architecture map disables its section header.
- [x] The focused test covers removed duplicate text and retained content.
- [x] Database, provider, authentication, permission, and delivery contracts remain unchanged.

## Integration and Verification

- [x] Focused AI Dashboard tests pass.
- [x] Targeted lint and diff checks pass.
- [x] Impeccable surface complexity audits pass.
- [x] Exact-route desktop and mobile screenshots are captured and visually reviewed.
- [x] Browser readback proves duplicate strings are absent and overflow remains safe.
- [x] Independent design review approves the implementation.
- [x] Verification manifest/result pair passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: either duplicate string renders, the map disappears, or a later section heading is removed.
- Detection path: focused workspace test, exact-route text readback, desktop/mobile screenshots, and independent review.
- Recovery path: correct the shared header option or Architecture invocation, then rerun the focused test and exact-route proof.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A; this is an explicit copy reduction.
- Detection gap: duplicate helper headings were not covered by the workspace regression contract.
- Prevention: focused assertions will reject both repeated strings while requiring the map and later heading.
- Guardrail evidence: focused Jest 7/7 and independent review approval.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1132 and S174 | Pass | Scope and done gate captured before implementation. |
| Focused regression | AI Dashboard Jest | Pass | 1 suite, 7 tests passed. |
| Targeted static checks | ESLint and `git diff --check` | Pass | No scoped failures. |
| Impeccable audit | `audit-surface-complexity.mjs` | Pass | Both changed UI files pass. |
| Desktop proof | `architecture-map-heading-removed-desktop.png` | Pass | Both strings absent, one direct child, `0px` content margin, no overflow. |
| Mobile proof | `architecture-map-heading-removed-mobile.png` | Pass | Both strings absent and no document overflow. |
| Independent review | `independent-review.md` | Approved | No scoped product defects. |
| Verification contract | `verification-manifest.json` and `verification-result.json` | Pass | Required evidence supports both claims. |
| Screenshot comment | AAI-1132 attachments `07099a6a-1519-443d-b2d2-d2bc6c8e953d` and `638819bd-13ee-4804-9a81-6f3d22406a53` | Pass | Desktop and mobile exact-route screenshots are viewable from the issue. |
| Publication | `npm run codex:finish` | Pass | Implementation and evidence published to `origin/main` at `9bb387c50c`; closeout-only metadata follows. |

## Remaining Risk

- None identified within the copy-removal scope.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A with a planned regression guard.
- [x] No deferred scoped work is planned.
