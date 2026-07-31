# Task: Shared Plane Replacement Dispatcher

Status: Five-Surface Production Verified; Modules Production Repair In Progress
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
- Defer browser parity and authenticated end-to-end proof to the coordinated
  batch verification checkpoint.

## Source of Truth

- Canonical runtime/data owner: the committed `plane-*` feature directories and
  their existing Supabase-backed hooks/API routes.
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
- [x] Cycles fails closed unless the mutation-capable server-only
  schedule-adapter preview flag is exactly `true`.
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
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

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
| Public source contract | Source-info route and helper unit tests | Pass | Three tests prove repository, independently published source-snapshot revision, source URL, and AGPL metadata. The snapshot SHA is supplied through server-only `AGPL_SOURCE_COMMIT_SHA`; the private Vercel revision is never exposed as a public-tree claim. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors. |
| Initial authenticated batch | `docs/ops/tasks/evidence/AAI-PLANE-INTEGRATION/local-batch/local-batch-report.md` | Fail | Cycles, Modules, Views, Pages, and Intake showed Alleato host chrome. These captures are regression evidence, not acceptance proof. |
| Shared Plane shell | `plane-workspace-shell.unit.test.tsx` | Pass | One root, six canonical links, active route, source offer, and host-owner selectors are locked. |
| Dispatcher shell ownership | `plane-surface-access.unit.test.ts` | Pass | Work Items owns its embedded shell; all five sibling surfaces require the dispatcher shell. |
| Final authenticated batch | `docs/ops/tasks/evidence/AAI-PLANE-INTEGRATION/release5-final/` | Pass | Work Items, Cycles, Views, Pages, and Intake return 200 at desktop/mobile widths after hydration. Intake proves 253 live rows and Work Items proves 235 live rows. |
| Work Items interactions | `work-items-command-palette-desktop.png`, `work-items-display-desktop.png`, `work-items-analytics-desktop.png` | Pass | Command, Display, and Analytics overlays render inside the Plane shell. |
| Intake numeric-ID regression | `npx vitest run --config src/features/plane-intake/vitest.config.ts src/features/plane-intake/__tests__/intake-adapter.test.ts` | Pass | 5/5; live numeric Outlook identifiers no longer crash rendering. |
| Modules mutation guard | Focused Modules model and dispatcher access Jest suites | Pass | 10/10; read access is independent, while every mutation requires the exact server gate and project write permission. |
| Modules production read | Authenticated `GET /api/projects/31/scheduling/tasks` and Vercel runtime log request `8e0768ce-44af-4ddb-b80c-b16e3d6a3481` | Fail, repair validated locally | The first production read failed inside the cookie/RLS PostgREST query with `No suitable key or wrong key type`. GET now uses `verifyProjectAccess` before the authorized server-only service client; 3/3 focused route tests and targeted ESLint pass. Fresh production readback and screenshots remain required. |
| Independent release review | Read-only review after route/safety correction | Conditional pass | Original overwrite, route-budget, and preview-label blockers are corrected. Public exact-source mirror and production verification remain release gates. |

## Remaining Risk

- The public AGPL repository must contain an independently rooted snapshot with
  the exact production tree before release. The source-offer page is public at
  `/auth/source`, and `AGPL_SOURCE_COMMIT_SHA` must resolve to that public
  snapshot. This avoids exposing the private repository's historical commit
  graph while still providing exact corresponding source.
- Shared middleware, generated maps, and other files with newer `origin/main`
  content are excluded from publication. The source offer uses the existing
  public `/auth/*` boundary so no middleware overwrite is needed.
- Cycles remains production-disabled until a dedicated, discriminator-safe
  data migration is designed, applied, and verified.
- Modules currently treats top-level schedule tasks as its read-only module
  projection. Mutations remain disabled until a dedicated module discriminator
  is approved and verified.
- The production Modules read failure was localized to the schedule-tasks GET
  route using a browser RLS client after independently decoding the auth cookie.
  Project access is now verified by the canonical guard before a server-only
  read client is constructed. Production remains unverified until the repaired
  API returns live data and fresh desktop/mobile captures replace the failed
  evidence.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning captures the provider-budget cause, detection gap, and prevention.
- [x] Deferred work names its owner and next integration action.
