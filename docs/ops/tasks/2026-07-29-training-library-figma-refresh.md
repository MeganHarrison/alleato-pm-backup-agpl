# Task: Training Library Figma Refresh

Status: Complete
Owner: Codex Sfigmalibrary
Created: 2026-07-29
Task ID: local-training-library-figma-refresh
Linear Issue: N/A, user requested direct implementation in this session.
Related Handoff: N/A, single-session Standard delivery.

## Objective

Redesign `/training/library` to adopt the referenced Figma hierarchy while
preserving the canonical Alleato shell, live training data, filters, access
controls, and resource routes.

## Scope

- Training Library page header, retrieval controls, topic grouping, and
  responsive resource cards.
- Focused component/page tests and desktop/mobile browser proof.
- Excludes training data, database schema, review workflow behavior, resource
  detail pages, and shared application shell changes.

## Source of Truth

- Canonical runtime/data owner:
  `frontend/src/app/(main)/training/library/page.tsx`,
  `frontend/src/features/training/TrainingLibraryView.tsx`, and
  `frontend/src/lib/training/**`.
- Existing shared primitives/services: `PageShell`, `SectionHeader`, `Card`,
  `ExpandableSearch`, `Select`, `Button`, and the training server/adapter.
- Visual reference: Figma file `caRc3K6x3uTTLCUc4W21Cm`, node `5119:30408`.
- Deprecated or parallel paths: Figma-generated React is reference-only and
  will not become a second runtime owner.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `/training/library` uses the Figma-inspired eyebrow/title hierarchy,
      compact retrieval row, topic sections, and responsive three-column
      resource cards.
- [x] Role, track, format, depth, and search filters remain functional.
- [x] Every visible resource card opens its canonical lesson or review source.
- [x] No-match and unavailable-data states explain cause and offer recovery.
- [x] Reviewer-only access remains conditional and linked to the canonical
      review queue.
- [x] The normal app shell and live training data model remain unchanged.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
      handled when applicable.

Owned files:

- `frontend/src/app/(main)/training/library/page.tsx`
- `frontend/src/app/(main)/training/library/__tests__/page.test.tsx`
- `frontend/src/features/training/TrainingLibraryView.tsx`
- `frontend/src/features/training/ResourceCard.tsx`
- `frontend/src/features/training/ResourceFilters.tsx`
- Focused tests for those training feature components.
- This task file and its evidence directory.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and the publication receipt is verified on
      `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit "No resources match" or "Training resources
  unavailable" state instead of an empty grid.
- Detection path: focused component tests plus browser readback of filtering,
  recovery, navigation, and horizontal overflow.
- Recovery path: clear search and filters in one action; unavailable data
  explains that reviewed resources have not been published.

## Incident Learning

This is a presentation enhancement, not an incident or recurring failure.

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Focused tests retain the grouped hierarchy, recovery path, and
  canonical lesson links.
- Guardrail evidence: 21 focused tests, scoped ESLint, the Alleato product
  noise audit, and authenticated desktop/mobile browser proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Focused tests | `jest --runInBand --runTestsByPath ...` | Pass | 4 suites and 21 tests passed. |
| Scoped lint | `eslint` against the seven changed TypeScript files | Pass | No errors or warnings. |
| Product noise audit | `audit-surface-complexity.mjs` against the four product files | Pass | All four files passed the Alleato product noise gate. |
| Desktop route proof | `actual-desktop.png` | Pass | Authenticated local route rendered 67 resources across 25 topics in a three-column layout. |
| Mobile route proof | `actual-mobile.png` | Pass | 390px viewport had no horizontal overflow; search and filter controls measured 44px high. |
| Search interaction | `agent-browser fill '@e125' 'pull planning'` | Pass | Live results reduced to 1 topic and 4 canonical resource cards. |
| Publication | `npm run codex:finish -- --staged-only ...` | Pass | Published 12 exact task-owned files to `origin/main` at `12ff1f4b24f2ea807ea1f6f1b473dea4c02924cd`. |
| Production deployment | Vercel deployment `dpl_HrTjzLvWhgWx1iWVMcGsK8hGoVVC` | Pass | Ready; build source verified `main@12ff1f4` and canonical alias updated. |
| Production route proof | `production-desktop.png` | Pass | Authenticated route rendered Resource Library, 25 topic headings, 67 cards, and no horizontal overflow. |
| Production search | `agent-browser fill '@e97' 'pull planning'` | Pass | Production results reduced to 1 matching topic and 4 cards. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors; only Git line-ending notices. |
| Unrelated failures | N/A | Pass | No unrelated verification failures affected this task. |

## Remaining Risk

- No known training-library risk remains. Existing Vercel workflow and Sentry
  source-map warnings are outside this presentation-only change.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
