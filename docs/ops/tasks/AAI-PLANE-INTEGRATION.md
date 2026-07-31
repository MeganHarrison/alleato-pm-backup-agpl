# Task: Shared Plane Replacement Dispatcher

Status: Six Surfaces Released; Program Acceptance Incomplete
Owner: S20260730-PLANEINTEGRATION
Created: 2026-07-30
Task ID: AAI-PLANE-INTEGRATION
Linear Issue: Tracked under the approved Plane-to-Alleato migration program
Related Handoff: N/A

## Objective

Expose the independently built Plane-derived replacement surfaces at
`/[projectId]/plane/[planeSurface]` without adding a Vercel dynamic-route
boundary. A Next.js rewrite sends those URLs through the existing project Tasks
route and its feature-owned Plane dispatcher.

## Scope

- Own the shared dispatcher, reusable Plane full-viewport workspace shell,
  route-level invalid-state UI, generated project surface inventory, and this
  integration evidence note.
- Integrate committed feature exports without editing agent-owned feature
  directories.
- Record release state separately from acceptance state. A deployed surface is
  not complete until its supported live data, interaction, responsive, and
  paired visual-parity contracts are proved.

## Source of Truth

- Canonical runtime/data owner: the committed `plane-*` feature directories and
  their existing Supabase-backed hooks/API routes.
- Canonical Plane program repository: personal production branch
  `personal-production/main`. The organization `origin/main` and a stale local
  canonical checkout are not release authorities for this program.
- Existing shared primitives/services: parent
  `frontend/src/app/(main)/[projectId]/layout.tsx` authorization guard and
  feature package `index.ts` exports.
- Deprecated or parallel paths: legacy Alleato pages remain intact until each
  replacement passes batch verification.

Delivery lane: High-risk

Verification contract: Authenticated desktop/mobile browser proof, focused
regression tests, route-budget proof, independent release review, an
anonymously accessible exact-source mirror, and production readback.

## Acceptance Criteria

- [x] One rewrite-backed project URL family supports `work-items`, `cycles`,
  `modules`, `views`, `pages`, and `intake` through the existing Tasks route.
- [x] Project IDs accept only positive safe integers.
- [x] Unknown surfaces and invalid project IDs produce a specific accessible
  not-found state.
- [x] Authorization remains inherited from the parent project layout.
- [x] Work Items and Cycles use their committed typed exports.
- [x] Cycles renders its schedule-backed projection read-only by default;
  mutation controls require the exact server-only schedule-adapter preview flag
  and project schedule-write permission.
- [x] Modules renders live schedule-backed records in read-only mode by
  default; create, update, status, and delete controls require both the exact
  server-only preview flag and project schedule-write permission.
- [x] All six routes mount exactly one reusable Plane workspace shell and inert
  the Alleato host sidebar, header, inset, and mobile navigation.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] No database, authentication, permission, or schedule data is changed by
  the Modules read-only release.

## Integration and Verification

- [x] Targeted route, lint, and TypeScript checks pass.
- [x] Batch browser parity and authenticated user-flow evidence is recorded by
  the release checkpoint.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Product files are published to the personal production repository.
- [ ] Every surface has complete functional, responsive, and paired Plane
  visual-parity proof.

## Failure-Loudly Contract

- Cause surfaced as: an accessible `Plane surface not found` response for an
  unsupported surface or invalid project ID; an accessible unavailable state
  for schedule-backed surfaces whose dedicated data migration is pending.
- Detection path: route conflict check, targeted ESLint/TypeScript validation,
  then batch browser verification.
- Recovery path: use one of the six supported surface slugs or integrate the
  missing typed feature export at this dispatcher boundary. Cycles may be
  mounted only with the mutation-capable server-only
  `PLANE_SCHEDULE_ADAPTER_MUTATION_PREVIEW=true`. Modules always mounts for
  read access, but its create/update/delete paths require that same server-only
  flag plus project schedule-write permission. The old flag and every
  `NEXT_PUBLIC` equivalent fail closed.

## Contract Adapter Note

The committed Intake and Cycles exports currently accept `projectId: string`,
although the integration brief described numeric props. The dispatcher remains
the adapter boundary: it strictly validates the route as a positive safe
integer, then passes `String(numericProjectId)` to those features. Work Items
also receives that canonical string plus the project name read by the existing
server-side project fetcher. Future contract changes must update this call site
and will fail the targeted TypeScript check rather than silently coercing an
invalid route.

## Release Learning

- Failure fingerprint: `plane-shared-dispatcher-route-budget`
- Root cause: The production app was already at its internal allowance of 654
  dynamic source boundaries. The required shared dispatcher added one boundary,
  which estimates three generated Vercel routes.
- Detection gap: Independent route-free feature builds could not expose the
  provider-budget impact; it became observable only after the shared route file
  existed and `verify:nonprod-routes` ran.
- Prevention: Plane URLs now rewrite through the existing Tasks route, so the
  manifest remains at exactly 654 dynamic boundaries and 2042 estimated routes
  while preserving a six-route reserve below Vercel's 2048 hard cap.
- Guardrail evidence:
  `frontend/scripts/build/__tests__/nonprod-route-budget.test.mjs`

### Host chrome leaked into replacement routes

- Failure fingerprint: `plane-replacement-host-chrome-leak`
- Root cause: Full-viewport portal, sidebar, topbar, and host-layout isolation
  were embedded inside Work Items instead of owned by the shared dispatcher
  boundary. The other five routes mounted feature content directly inside the
  Alleato application shell.
- Detection gap: Feature-level static checks proved data/render contracts but
  did not compare the full viewport composition. The first authenticated batch
  screenshots exposed Alleato's legacy global header/sidebar on every sibling
  route.
- Prevention: `PlaneWorkspaceShell` now owns the one full-viewport Plane shell,
  canonical navigation, mobile drawer, body portal, focus/overflow restoration,
  and host chrome inert/visibility cleanup. Work Items consumes it internally;
  the dispatcher wraps the other five surfaces exactly once. Focused shell and
  dispatcher tests lock the ownership split.
- Guardrail evidence:
  `frontend/src/features/plane-work-items/plane-workspace-shell.unit.test.tsx`
  and
  `frontend/src/app/(main)/[projectId]/plane/[planeSurface]/plane-surface-access.unit.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Ownership, adapter boundary, and deferred browser gate captured. |
| Route conflict | CRLF-normalized `scripts/check-route-conflicts.sh` | Pass | No dynamic route conflicts found. |
| Dispatcher lint | Targeted ESLint for `page.tsx` and `not-found.tsx` | Pass | No errors or warnings. |
| Targeted types | TypeScript compiler API rooted at dispatcher and public source routes | Pass | 3,053 dependency files compiled with no diagnostics. |
| Provider budget | `npm run verify:nonprod-routes` | Pass | 654 dynamic files, 2042 estimated routes, six routes below hard cap. |
| Schedule fail-closed gate | `plane-surface-access.unit.test.ts` | Pass | Exact mutation-preview opt-in only; legacy and `NEXT_PUBLIC` flags fail closed. |
| Public source contract | `GET https://alleato-pm-backup.vercel.app/api/source-info` | Pass | On 2026-07-31 the live endpoint returned repository `MeganHarrison/alleato-pm-backup-agpl`, exact revision `9fdd616a05fc154f3ef7e046166735a359f9e382`, `AGPL-3.0-only`, and notice `/auth/source`. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors. |
| Initial authenticated batch | `docs/ops/tasks/evidence/AAI-PLANE-INTEGRATION/local-batch/local-batch-report.md` | Fail | Cycles, Modules, Views, Pages, and Intake showed Alleato host chrome. These captures are regression evidence, not acceptance proof. |
| Shared Plane shell | `plane-workspace-shell.unit.test.tsx` | Pass | One root, six canonical links, active route, source offer, and host-owner selectors are locked. |
| Dispatcher shell ownership | `plane-surface-access.unit.test.ts` | Pass | Work Items owns its embedded shell; all five sibling surfaces require the dispatcher shell. |
| Final authenticated batch | `docs/ops/tasks/evidence/AAI-PLANE-INTEGRATION/release5-final/` | Partial acceptance proof | Work Items, Views, Pages, and Intake have committed desktop/mobile production captures. The batch recorded 253 live Intake rows and 235 live Work Items. Its Cycles capture predates the final read-only release and is not accepted as current mutation proof. |
| Work Items interactions | `work-items-command-palette-desktop.png`, `work-items-display-desktop.png`, `work-items-analytics-desktop.png` | Pass | Command, Display, and Analytics overlays render inside the Plane shell. |
| Intake numeric-ID regression | `npx vitest run --config src/features/plane-intake/vitest.config.ts src/features/plane-intake/__tests__/intake-adapter.test.ts` | Pass | 5/5; live numeric Outlook identifiers no longer crash rendering. |
| Modules mutation guard | Focused Modules model and dispatcher access Jest suites | Pass | 10/10; read access is independent, while every mutation requires the exact server gate and project write permission. |
| Modules production read | Personal production commits `696434794` and `f914c8cfa` | Released read-only; acceptance pending | The authorized server-only read repair is deployed. Current evidence shows an empty project rather than a non-empty domain projection. Commit a fresh desktop/mobile evidence set and prove a non-empty authorized read before calling the slice complete. |
| Cycles production read | Personal production commit `0cfcb14af` | Released read-only; acceptance pending | The read-only release is deployed. Its mutation path remains disabled pending a discriminator-safe cycle model. Fresh evidence for this exact release is not committed in this task record. |
| Independent release review | Read-only review after route/safety correction | Conditional pass | Original overwrite, route-budget, preview-label, and source-offer blockers are corrected. The remaining functional and paired visual-parity gates below still apply. |

## Remaining Scope Matrix

| Requirement | Current state | Missing proof or implementation | Next slice |
| --- | --- | --- | --- |
| AAI-1288 inspector | Work Items detail peek is released | Browser Back, focus/scroll restoration, tablet overlay, and mobile full-screen detail | Authenticated inspector acceptance journey |
| AAI-1289 create | Quick-add code and focused tests exist | Live create/validation/reload proof was deferred to avoid changing production-backed data | Run a reversible mutation journey after explicit approval |
| AAI-1290 board status | Optimistic update and rollback code exist | One successful persisted move and one rejected rollback/recovery journey | Authenticated Board mutation acceptance |
| AAI-1291 navigation | Compact Plane shell is released | Resize/collapse persistence, permission-derived destinations, and real workspace destinations | Navigation behavior slice |
| AAI-1292 cutover | Replacement routes are released; legacy Tasks remains | Complete end-to-end acceptance and explicit user acceptance | Retire the old composition only after both gates |
| Cycles | Released read-only | Fresh committed proof for the exact release and a dedicated cycle data discriminator | Evidence publication, then domain migration design |
| Modules | Released read-only | Non-empty authorized read proof and a dedicated module discriminator | Evidence/read proof, then domain migration design |
| Views | Released read-only | Create/update/default/duplicate/delete are intentionally absent | Separately authorize and implement saved-view mutations |
| Pages | CRUD implementation is released | Live create/edit/save/archive/restore and permission proof | Authenticated Pages mutation journey |
| Intake | Live combined reads are released | Update/delete/reclassification proof across admin and member policies | Authenticated Intake permission/mutation journey |
| Home, Drafts, Your work, Stickies | Sidebar labels/buttons only | No Plane-derived page routes or data-owner contracts | Define mappings and implement individual templates |
| More, Favorites, recents | Decorative or inert shell affordances | No canonical navigation, permissions, or persistence | Shared navigation-state slice |
| RFIs | Not started | Entire Plane-derived replacement | First phase-3 module after Work Items acceptance |
| Submittals | Not started | Entire Plane-derived replacement | Second phase-3 module |
| Change Events | Not started | Entire Plane-derived replacement | Third phase-3 module |
| Commitments and Prime Contracts | Not started | Dense list/detail replacement surfaces | Fourth phase-3 module group |
| Cross-project work | Not started | Company work, favorites, recents, saved views, command navigation | Final planned rollout group |

## Remaining Risk

- The exact-source offer is live and currently resolves to public revision
  `9fdd616a05fc154f3ef7e046166735a359f9e382`. Every later deployment must update
  the independently accessible source mirror before or with production.
- Source mapping and code-fidelity audits do not satisfy the user's required
  side-by-side Plane/Alleato desktop and mobile visual comparison. Complete
  paired evidence remains missing across the full six-surface set.
- Cycles and Modules currently treat top-level schedule tasks as read-only
  projections. Their mutations remain disabled until dedicated,
  discriminator-safe domain contracts are approved and verified.
- The legacy Tasks composition must remain recoverable until AAI-1288 through
  AAI-1290 and the production acceptance journey pass. It must then be retired
  deliberately under AAI-1292.

## Final Status

- [x] All six replacement surfaces and the source offer are released.
- [ ] The program-level acceptance and retirement checklist is complete.
- [ ] Functional and paired visual evidence is complete for every surface.
- [x] Incident learning captures the provider-budget cause, detection gap, and prevention.
- [x] Deferred work names its owner and next integration action.
