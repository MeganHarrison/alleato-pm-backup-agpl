# Task: Training Module learner route and navigation

Status: Complete
Owner: Session S222
Created: 2026-07-26
Task ID: ALL-21
Linear Issue: ALL-21 in the Linear project "Training Module — Alleato-PM"
Related Handoff: N/A — bounded Standard-lane slice with exact path ownership

## Objective

Publish an authenticated company-wide `/training` destination that loads the
canonical training library, defaults the role filter from the viewer's current
job title when it resolves unambiguously, and is reachable from the Work
navigation section.

## Scope

- Owned: `frontend/src/app/(main)/training/**`,
  `frontend/src/features/training/**`,
  `frontend/src/lib/navigation-config.ts`,
  `frontend/src/lib/__tests__/navigation-config.unit.test.ts`, the generated
  project-map/app-surface/system-map inventories, and this task.
- Explicit exclusion: database schema/seeding, reviewer mutations, guide source
  recovery, finder jobs, backend/Render configuration, and unrelated navigation.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/training/server.ts` and its
  RLS-backed data-access layer.
- Existing shared primitives/services: `PageShell`, `RouteErrorPage`,
  `TablePageLoading`, `TrainingLibraryView`,
  `loadCurrentUserProfilePayload`, and `companyWideHeaderTools`.
- Deprecated or parallel paths: `frontend/src/features/training-docs/**` is a
  different authoring system and is not reused as a learner library.

Delivery lane: Standard

Verification contract: Optional

## Attention Brief

- Primary user: authenticated Alleato employee.
- Primary job: find and open approved, role-relevant training.
- Primary decision: which resource best answers the current learning need.
- Tier 1: search/filters and published resources.
- Tier 2: provider, type, and learning depth.
- Tier 3: topic grouping and track.
- Hide until requested: review/archived resources and reviewer metadata.
- Remove: KPI counts, wrapper cards, helper panels, duplicate CTAs, decorative icons.
- Primary action: open the selected resource.
- Failure-loudly behavior: route error boundary names the failed load and offers retry;
  a genuinely unseeded library is distinct from a no-filter-match state.

## Acceptance Criteria

- [x] `/training` loads canonical published resources, roles, and topics.
- [x] An unambiguous `people.job_title` match selects the viewer's role by default.
- [x] Training appears once under the company-wide Work navigation section.
- [x] Empty library, no-match, loading, and query-failure states are distinct.
- [x] No review/archived resources are requested by the learner route.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared canonical data/profile/navigation owners are reused.
- [x] Domain-to-presentation adaptation is tested without duplicating enums.
- [x] Errors are specific and actionable.

## Integration and Verification

- [x] Focused adapter/component/navigation tests pass.
- [x] Focused lint and route guardrails pass.
- [x] Desktop browser flow and screenshot prove `/training`.
- [x] Mobile browser flow and screenshot prove the responsive route and unseeded state.
- [x] Task-owned implementation is published to `origin/main` and the production deployment is Ready.

## Failure-Loudly Contract

- Cause surfaced as: route-level query/profile error or explicit unseeded-library state.
- Detection path: focused tests plus browser snapshot/screenshot on `/training`.
- Recovery path: retry query errors; recover and normalize the missing source export,
  review it, then seed published rows for an unseeded library.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused regression tests | `npx jest src/features/training/__tests__/adapter.test.ts src/features/training/__tests__/resource-filters.test.tsx src/features/training/__tests__/resource-card.test.tsx src/features/training/__tests__/training-library-view.test.tsx src/features/training/__tests__/guide-viewer.test.tsx src/lib/__tests__/navigation-config.unit.test.ts --runInBand` | Pass: 48/48 across 6 suites | Proves canonical adaptation, unique job-title role default, trusted embeds, filters, unseeded/no-match states, and exactly one Work-nav entry. |
| Frontend lint | `npx eslint 'src/app/(main)/training' src/features/training src/lib/navigation-config.ts src/lib/__tests__/navigation-config.unit.test.ts --max-warnings=0` | Pass | Includes the enforced page-shell and design-system gates. |
| Route guardrail | `npm run check:routes` | Pass | No dynamic-route conflicts. |
| Generated route inventory | `npm run map:project` | Pass | `/training` recorded in `PROJECT-MAP.md` and the canonical app-surface JSON. |
| Generated system index | `npm run map:system && npm run map:system -- --check-only` | Pass | Top-level architecture index matches the regenerated route inventory. |
| TypeScript | `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit` with S222-path filter | S222 pass; full repo fails unrelated debt | No diagnostic touches the training route, training feature, navigation config, or navigation test. |
| Exact-path publication | `npm run codex:finish -- --message "Add training library route" --staged-only --session S222` | Pass | Published implementation commit `1f542aeea6c1e91e5cca78c5bcc9585c70723f1b` to `origin/main`. |
| Vercel deployment | Deployment `dpl_FHBjj4FRaDcZp8FS4Xz9SyzRegb2` | Ready | Aliased to `https://projects.alleatogroup.com`. |
| Desktop production flow | `docs/ops/tasks/2026-07-26-training-module-route.desktop.png` | Pass | Authenticated `/training`, one desktop Training nav entry, explicit unseeded state, no browser errors, and no horizontal overflow at 1440 px. |
| Mobile production flow | `docs/ops/tasks/2026-07-26-training-module-route.mobile.png` | Pass | Authenticated `/training`, mobile navigation, explicit unseeded state, no browser errors, and no horizontal overflow at 390 px. |

## Noise Gate

- Noise gate: pass.
- Top noise sources: empty filter controls before the library has content;
  feature-local display fallbacks that could invent description/provider copy.
- Removed or simplified: all filters are hidden for a genuinely unseeded
  library; null description/provider values stay quiet; no KPI strip, wrapper
  card, helper banner, decorative icon, or duplicate CTA was added.
- Remaining risk: populated production resource cards and filters cannot be
  browser-proven until the missing source export is recovered and seeded.
- Regression guardrail: focused unseeded-state and navigation uniqueness tests,
  plus the shared design-system lint rules.

## Remaining Risk

- The production library contains zero rows until the missing resource export is
  recovered, reviewed, and seeded. The route must show that state honestly.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Missing source/seed work is explicitly deferred to its existing owner.
