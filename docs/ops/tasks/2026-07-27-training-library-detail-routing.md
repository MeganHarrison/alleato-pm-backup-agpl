# Task: Training Library Detail Routing

Status: Complete
Owner: SROOT-training-detail-0727
Created: 2026-07-27
Task ID: LOCAL-training-library-detail
Linear Issue: Not required for a single-session Standard change
Related Handoff: N/A

## Objective

Every published training resource opens its Alleato detail page, and supported
YouTube sources render in an on-page player even when an optional stored embed
URL is invalid.

## Scope

- Published resource tiles and the shared training embed resolver call sites
- Focused routing, fallback, and rendering regression tests
- Excludes training review actions, resource authoring, and database changes

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/training/data-access.ts`
- Existing shared primitives/services: `ResourceCard`, `TrainingResourcePageContent`, `resolveTrainingEmbed`
- Deprecated or parallel paths: direct external navigation from the learner library

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] A published library tile has one internal detail-page destination.
- [x] A supported YouTube URL renders in the detail-page iframe.
- [x] An invalid optional `embed_url` falls back to a supported canonical resource URL.
- [x] Unsupported media fails loudly on the detail page instead of silently redirecting.
- [x] Relevant existing guardrails are identified before implementation.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared `resolveTrainingEmbed` policy owns URL validation at both call sites.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are not changed.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Live-system readback proves the current production route and iframe behavior.
- [x] Updated user-flow proof and screenshots are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an explicit unsupported-reader warning on the detail page
- Detection path: focused component tests plus authenticated browser iframe inspection
- Recovery path: correct the source/embed URL in training administration, then reopen the lesson

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Production currently routes internally and embeds the sampled YouTube playlist; this change closes an untested fallback gap rather than claiming a reproduced production failure.
- Detection gap: Existing tests did not cover an invalid stored embed URL paired with a valid YouTube source URL.
- Prevention: Shared resolver fallback and learner-card routing assertions.
- Guardrail evidence: 15 focused tests, targeted ESLint, and the Alleato surface-complexity audit pass.

## UX Gate

- Primary user: Alleato learner
- Primary job: Open and consume one vetted resource without leaving Alleato
- Primary decision: Which lesson to open
- Tier 1: Resource title and lesson content
- Tier 2: Topic, track, format, and depth
- Tier 3: Source attribution
- Hide until requested: Original external source
- Remove: Duplicate external learner CTA from the library tile
- Primary action: Open the internal lesson page
- Failure-loudly behavior: Show an actionable unsupported-reader warning
- Blessed pattern: Existing training resource tile plus existing `PageShell` lesson detail
- Complexity budget: One destination per tile; one lesson-content surface per detail page

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Live library | Authenticated Playwright readback of `https://projects.alleatogroup.com/training/library` | Pass | Published cards resolve to internal `/training/resources/[resourceId]` routes. |
| Live YouTube detail | `/tmp/training-resource-youtube-live.png` | Pass | Sampled playlist rendered through `youtube-nocookie.com/embed/videoseries`. |
| Focused regression | `npm run test:unit -- --runInBand --runTestsByPath ...` | Pass | 3 suites, 15 tests. |
| Targeted static check | `npx eslint` on the four changed source/test files | Pass | No errors. |
| UI doctrine audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/features/training/TrainingResourcePage.tsx frontend/src/features/training/ResourceCard.tsx` | Pass | Both files pass. |
| Current desktop library | Codex visualization artifact `training-library-detail-routing/library-desktop.png` | Pass | Canonical `origin/main` open-row tile pattern retained. |
| Current desktop detail | Codex visualization artifact `training-library-detail-routing/youtube-detail-desktop.png` | Pass | Internal lesson route renders the YouTube player. |
| Current mobile detail | Codex visualization artifact `training-library-detail-routing/youtube-detail-mobile.png` | Pass | 375px viewport, `scrollWidth=375`, iframe present. |
| Artifact retention guard | Repository pre-commit guard | Pass | Reviewed screenshots remain outside Git because new `docs/ops/evidence` binaries are prohibited. |

## Remaining Risk

- Automatic Vercel production deployment and canonical-alias readback must be verified after publication.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
