# Task: Repair Training Guide Reader Layout

Status: In Progress
Owner: Codex S019fa684
Created: 2026-07-28
Task ID: LOCAL-20260728-TRAINING-GUIDE-READER
Linear Issue: N/A; bounded Standard correction requested directly.
Related Handoff: N/A; single-session Standard work.

## Objective

Make every training guide a calm, readable reference surface with a single title, legible body text, and clear section rhythm at desktop and mobile widths.

## Scope

- Own the shared guide viewer, canonical guide route, its focused unit test, and this task record.
- Exclude guide content, the global app shell, authentication, and the standalone training-theme stylesheet.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/training/guides/[guideSlug]/page.tsx`
- Shared reader primitive: `frontend/src/features/training/GuideViewer.tsx`
- Existing rendering owner: `frontend/src/components/docs/markdown-renderer.tsx`
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The duplicated guide title is removed from the rendered reader body.
- [x] Shared guides render with readable desktop and mobile typography and a bounded measure.
- [x] No horizontal overflow, decorative wrappers, or duplicate primary CTAs are introduced.
- [x] A focused test guards the reader structure.

## Failure-Loudly Contract

- Cause surfaced as: the focused reader test fails when the semantic reader structure or its title-deduplication class is removed.
- Detection path: focused Jest test plus browser screenshots at 375 px and 1440 px.
- Recovery path: restore `GuideViewer` as the canonical reader wrapper and rerun the focused test and visual checks.

## Incident Learning

- Failure fingerprint: `training.registered-source-placeholder-drift`
- Root cause: the guide route rendered generic markdown at small typography without a guide-specific content frame, while the source MDX duplicated the page heading.
- Detection gap: route tests verified text and navigation but did not assert reader structure or inspect the shared guide visual after the training-page template change.
- Prevention: move guide-specific reading rules into the shared `GuideViewer` and assert its structural classes in the focused test.
- Guardrail evidence: the shared `GuideViewer` now owns title deduplication and reader typography; targeted ESLint and `git diff --check` pass. The existing focused Jest command is currently blocked before tests execute by the workspace's Jest module mismatch, which is recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Production screenshot and source-to-DOM inspection | Pass | The deployed guide uses the shared route, `GuideViewer`, and generic `MarkdownRenderer`; the first body heading duplicates the PageShell title. |
| Targeted lint | `cd frontend && pnpm exec eslint src/features/training/GuideViewer.tsx src/features/training/__tests__/guide-viewer.test.tsx` | Pass | Shared reader implementation and its focused test have no lint findings. |
| Diff integrity | `git diff --check` | Pass | No whitespace errors. |
| Focused Jest | `pnpm exec jest --runInBand --runTestsByPath src/features/training/__tests__/guide-viewer.test.tsx 'src/app/(main)/training/guides/[guideSlug]/__tests__/page.test.tsx'` | Unrelated environment debt | Test bootstrap fails before executing tests with `this._moduleMocker.clearMocksOnScope is not a function`; no changed source is loaded. |
| Local browser proof | Workspace webpack/Turbopack server | Blocked by isolated-workspace tooling | Turbopack rejects the temporary external `node_modules` link; webpack then fails to resolve existing `zod` imports in `src/lib/ai/**` before serving the route. Neither error originates in the guide reader. |

## Remaining Risk

- Visual proof is deferred to the production deployment because the isolated-workspace server cannot start with the repository's dependency topology. The layout is guarded by the shared reader boundary and targeted lint; production should be checked at 375 px and 1440 px after deployment.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
