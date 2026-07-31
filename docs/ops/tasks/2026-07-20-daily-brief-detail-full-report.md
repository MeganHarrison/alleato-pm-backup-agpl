# Task: Restore Full Daily Brief Detail Reports

Status: Complete
Owner: Codex S207
Created: 2026-07-20
Task ID: AAI-1212
Linear Issue: AAI-1212 — https://linear.app/megankharrison/issue/AAI-1212/repair-daily-brief-production-rendering-and-add-a-visual-release-gate
Related Handoff: `docs/ops/handoffs/2026-07-20-S207-daily-brief-detail-full-report.md`

## Objective

Restore the route ownership contract: `/daily-brief` owns the designed executive summary template, while `/daily-briefs/[briefId]` renders the complete persisted executive report with readable source citations.

## Scope

- Reuse the canonical packet loader, `PageShell`, and existing `BriefMarkdown` report renderer.
- Remove the landing-page `ExecutiveBriefView` composition from individual report routes.
- Add a regression guard that fails if the detail route reimports the landing template or stops rendering `packet.briefMarkdown`.
- Verify the landing route remains the designed summary and the individual route renders the full report on desktop and mobile.

## Source of Truth

- Landing composition owner: `frontend/src/app/daily-brief/page.tsx` and `ExecutiveBriefView`
- Individual report owner: `frontend/src/app/(tables)/daily-briefs/[briefId]/page.tsx`
- Complete report renderer: `frontend/src/features/daily-briefs/brief-markdown.tsx`
- Persisted artifact: `CanonicalDailyBriefPacket.briefMarkdown`

Verification contract: Required

## Acceptance Criteria

- [x] `/daily-brief` continues to render the designed executive summary template.
- [x] `/daily-briefs/[briefId]` renders the full persisted report, not `ExecutiveBriefView`.
- [x] Source aliases render as readable linked citations through `BriefMarkdown`.
- [x] Missing full report content fails loudly.
- [x] Desktop and mobile screenshots show the individual full report on the canonical production route.
- [x] A route ownership regression test passes.
- [x] Independent verification approves the route split.
- [x] Task-owned changes are published and deployed.

## Failure-Loudly Contract

- Cause surfaced as: a labeled error when `briefMarkdown` is missing or is only the canonical missing-content sentinel.
- Detection path: focused route ownership test plus authenticated browser proof of both route types.
- Recovery path: repair the packet artifact or report renderer; never substitute the designed summary template on an individual report route.

## Incident Learning

- Failure fingerprint: `architecture.canonical-daily-brief-route-owner-drift`
- Root cause: the historical detail route was changed to reuse the landing-page composition, conflating summary and artifact-reader responsibilities.
- Detection gap: rendering checks asserted visual cleanliness but did not assert the route-specific content contract.
- Prevention: a source-level route ownership test requires `BriefMarkdown` and forbids `ExecutiveBriefView` on `[briefId]`.
- Guardrail evidence: focused route/citation tests, independent review, exact-revision deployment readback, and production browser screenshots pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Authenticated production `/daily-briefs/110a6bd4-a5d4-4345-b9ea-7cd9e675e8f9` | Fail observed | Individual route displayed the landing-page hero, pills, contents rail, and attention module. |
| First divergent boundary | Detail route import/composition inspection | Pass | `[briefId]/page.tsx` imports and returns `ExecutiveBriefView`; the complete `BriefMarkdown` renderer remains available but unused. |
| Route and citation contracts | `pnpm exec jest --runInBand --runTestsByPath 'src/app/(tables)/daily-briefs/__tests__/route-ownership.test.ts' src/lib/daily-briefs/__tests__/source-links.test.ts` | Pass | 20 tests passed. |
| Targeted lint | ESLint on task-owned route, renderer, helpers, and tests | Pass | No errors. |
| Changed-file type debt | `pnpm run typecheck:changed` | Pass | No new `any` debt. |
| Noise/complexity gate | Alleato surface complexity audit on `[briefId]/page.tsx` | Pass | Canonical open report surface remains minimal. |
| Architecture map gates | `npm run map:project`; `npm run map:system` | Pass | Regenerated the required route/tool and system inventories after rebasing onto current `origin/main`. |
| Local detail browser | `docs/ops/evidence/2026-07-20-daily-brief-detail-full-report/local-browser-readback.json` | Pass | 11 sections, 44 readable source links, no raw aliases, no landing template, no 390px overflow. |
| Local screenshots | `local-detail-desktop.png`, `local-detail-mobile.png`, `local-landing-desktop.png` | Pass | Full report and landing summary remain visibly distinct. |
| Independent review | `independent-review.md` | Approved | No code changes requested. |
| Existing Vercel deployment | `dpl_GyJWg3DpCiovrztiMG9UBr9mbv3n` | Ready | Existing `project-management-agent` project deployed revision `e838c204f` to `projects.alleatogroup.com`. |
| Production detail browser | `production-browser-readback.json` | Pass | 11 sections, 44 readable source links, no raw aliases, no landing template, and no desktop/mobile overflow. |
| Production screenshots | `production-detail-desktop.png`, `production-detail-mobile.png`, `production-landing-desktop.png` | Pass | Canonical detail route is the full report; landing route retains the designed summary. |
| Linear screenshot attachments | AAI-1212 attachments `14727482-a43c-422f-b5b6-92ace8dbd4d1`, `e267f8cd-ece4-416e-98a3-dc81d046fb90`, `dbb2be51-d1af-4c4a-ab56-6f5596349ce3` | Pass | Viewable production desktop, mobile, and landing screenshots are attached to the task. |

## Noise Gate

- Primary user: executive reading one saved report.
- Primary job: read the full source-backed executive narrative.
- Primary decision: understand the complete record before acting or comparing history.
- Tier 1: persisted report title, full narrative, decisions, projects, risks, and source citations.
- Tier 2: business date and app navigation.
- Tier 3: subordinate source links within the report.
- Hide until requested: technical packet metadata and internal identifiers.
- Remove: summary hero, count pills, contents rail, attention module, and designed landing-page chrome from individual routes.
- Primary action: read and open cited evidence.
- Failure-loudly behavior: missing report artifact throws instead of showing a summary substitute.

## Remaining Risk

- The missing-report path uses the route error boundary rather than a tailored diagnostic screen. It fails loudly as required; a later UX improvement can make the diagnostic friendlier without restoring a summary fallback.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No required work is deferred.
