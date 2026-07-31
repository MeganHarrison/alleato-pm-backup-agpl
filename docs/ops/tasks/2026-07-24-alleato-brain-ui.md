# Task: Ship the Alleato Brain branch UI

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-BRAIN-UI
Linear Issue: ALL-11 (referenced by the approved migration blueprint; Linear connector is unavailable in this session)
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINUI-alleato-brain-ui.md`

## Objective

Active internal staff can open Alleato Brain, choose a Business Area, and
browse its Knowledge, Meetings, Tasks, and Files without using a fake project.
Authenticated external contacts are rejected before branch queries.

## Scope

- Add `/brain` and `/brain/[businessAreaId]` routes, a top-level navigation
  entry, branch-aware server data adapters, a shared embedded table, and
  branch-scoped knowledge upload.
- Preserve Finance fail-closed behavior through the signed-in Supabase client
  and existing RLS, and enforce the internal-employee boundary before any Brain
  query. Do not create owners, memberships, Phase 2 relabels,
  Phase 5 elapsed-time evidence, or Phase 6 cutover state.

## Source of Truth

- Canonical runtime/data owner: PM Supabase
  `business_areas`, `document_metadata`, `meetings`, and `tasks`
- Existing shared primitives/services:
  `PageShell`, `EmbeddedUnifiedTablePage`, `KnowledgeUploadDialog`,
  `createClient`, `getCurrentUser`, and `current_is_app_admin`
- Deprecated or parallel paths:
  `frontend/src/features/company-brain/**` is a mock graph prototype and is not
  a production data owner.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `/brain` lists the five canonical Business Areas without count cards or
      decorative wrappers.
- [x] `/brain/[businessAreaId]` provides Knowledge, Meetings, Tasks, and Files
      tabs backed by branch-scoped server queries.
- [x] Restricted Finance content is not loaded for an unauthorized user and
      the page gives an actionable access message.
- [x] Authenticated external contacts are redirected before any Business Area
      query.
- [x] Admin knowledge upload from a branch stamps `business_area_id` at the
      initial metadata insert.
- [x] Search, sorting, pagination, source opening, loading, not-found, and
      failure states are usable on desktop and mobile.
- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned paths:

- `frontend/src/app/(main)/brain/**`
- `frontend/src/features/brain/**`
- `frontend/src/lib/navigation-config.ts`
- `frontend/src/lib/__tests__/navigation-config.unit.test.ts`
- `frontend/src/features/knowledge/knowledge-upload-dialog.tsx`
- `frontend/src/app/api/knowledge/upload/route.ts`
- `frontend/src/app/api/knowledge/upload/__tests__/**`
- `frontend/tests/brain/**`
- `frontend/src/lib/app-surface/page-descriptions.json`
- `frontend/src/lib/app-surface/app-surface.generated.json`
- `docs/architecture/PROJECT-MAP.md`
- `docs/architecture/SYSTEM-MAP.md`
- `docs/architecture/generated/system-map.json`
- `tests/agent-browser-runs/2026-07-24-alleato-brain-ui/**`

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: branch query failures reach the route error boundary with
  a Brain-specific message; expired authentication redirects to login;
  restricted access renders a Finance-specific denial; upload validation names
  the invalid/missing branch.
- Detection path: focused Jest, browser route evidence at five responsive
  widths, Finance negative-path proof, and the digest-bearing Brain route
  error boundary.
- Recovery path: retry the route for transient reads, reauthenticate for an
  expired session, or ask an Alleato administrator/branch owner to add the
  required Finance membership.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: Type generation against project
  `lgveqfnpkxvzbnnwuled` matched the checked-in database contract before DB
  code was written.

## Evidence

| Check               | Command / artifact               | Result      | Notes                                                                                      |
| ------------------- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Task setup          | This task file                   | Pass        | High-risk scope and done gate captured before implementation.                              |
| Supabase types gate | `supabase gen types ...` + `cmp` | Pass        | Live and checked-in contracts match; Business Area fields exist on all four scoped tables. |
| Focused tests       | Jest, 5 suites / 50 tests        | Pass        | Navigation, internal-employee authorization, query construction, URL controls, and upload guardrails pass. |
| Changed-file gate   | `npm --prefix frontend run quality:changed` | Pass | No new lint, `any`, unsafe-pattern, or route-guardrail debt.                     |
| Route gate          | `npm run check:routes`           | Pass        | No dynamic-route conflicts.                                                                |
| Project map         | generation + `origin/main` reconciliation | Pass | Both Brain routes are indexed; retired login experiments remain absent.                 |
| System map          | remote exact-file readback at `af6be44d` | Pass | Both canonical system-map files report 358 routes on `origin/main`.                       |
| Responsive browser  | `browser-verification.md`        | Pass        | Five required widths plus list/detail proof; no horizontal overflow.                       |
| Server controls     | `browser-verification.md`        | Pass        | Page, title sort, and page-size controls update the server URL and reload live rows.         |
| Finance authorization | Live RLS verifier + browser denial | Pass | Database CRUD guardrails pass; an internal nonmember sees no Finance rows or tabs. |
| Internal employee boundary | Focused Jest + external browser session | Pass | RPC errors fail loudly and an authenticated external contact redirects before the branch list query. |
| Noise gate          | Impeccable surface audit         | Pass        | No nested cards, one-off menus, decorative wrappers, or popup complexity.                   |
| Independent review  | Initial + delta + final reruns   | Pass        | Final decision APPROVED with no product, security, layout, catalog, or publication blocker. |
| Publication         | `origin/main` `83ea23c6d4ca881795b25956316ab99c286d9452` | Pass | All 43 exact UI, catalog, task, and evidence files were published after the system-map receipt at `af6be44d`. |
| Full typecheck      | `npm --prefix frontend run typecheck` | Unrelated debt | Fails in pre-existing admin/daily-brief/AI and other non-task files; no Brain error emitted. |

## Remaining Risk

- Owner names and the exact Finance membership group remain an explicit owner
  gate in the approved blueprint. The UI must not invent either.
- The shared application shell has pre-existing axe findings for unnamed
  project-selector controls, duplicate main landmarks, and active-tab contrast.
  The Brain surface adds no one-off shell override; the shared shell remains
  the correction owner.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
