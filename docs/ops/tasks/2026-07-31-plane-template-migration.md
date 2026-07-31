# Task: Publish Plane-derived templates in project-management

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: AAI-PLANE-MIGRATION
Linear Issue: Unavailable; no Linear connector is callable in this session.
Related Handoff: `docs/ops/handoffs/2026-07-31-SPLANEMIG0731-plane-template-migration.md`

## Objective

Copy the completed Plane-derived implementation from the backup release into
`project-management`, expose all sixteen surfaces through the existing project
Tasks route, retain legacy Tasks as the fallback, and production-verify the
single Vercel release.

## Scope

- Plane feature owners under `frontend/src/features/plane-*`.
- Plane APIs under `frontend/src/app/api/plane-*`.
- Existing `PlaneSurfaceDispatcher` integration in the project Tasks route.
- Two canonical Plane rewrites in `frontend/next.config.ts`.
- Required Plane notices and exact corresponding-source flow.
- Read-only production schema and migration-ledger verification for the
  already-live Plane tables.
- Explicit exclusion: no legacy page removal, no duplicate migrations, no mock
  data, no alternative tables, no localStorage data fallback, and no redesign.

## Source of Truth

- Canonical source implementation:
  `C:/Users/KimiClaw/.codex/release-candidates/plane-batch2`
- Canonical runtime/data owner: Supabase project `lgveqfnpkxvzbnnwuled`.
- Existing shared route owner:
  `frontend/src/app/(main)/[projectId]/tasks/page.tsx`.
- Existing shared dispatcher:
  `frontend/src/features/plane-work-items/plane-surface-dispatcher.tsx`.
- Deprecated or parallel paths: none created; legacy Tasks remains the fallback
  when `planeSurface` is absent.

Delivery lane: High-risk

Verification contract: Required

## Attention Brief

- Primary user: project managers and project team members.
- Primary job: navigate project work surfaces and act on live project records.
- Primary decision: which surface or work item requires action now.
- Tier 1: live work items, status, ownership, due dates, and primary actions.
- Tier 2: project navigation, view controls, and record detail context.
- Tier 3: filters, source context, and secondary metadata.
- Hide until requested: advanced filters and record detail metadata.
- Remove: nothing in this batch; templates are copied without redesign.
- Primary action: open or create the relevant live project record.
- Failure-loudly behavior: invalid access, missing schema, and API failures render
  explicit errors and fail the production smoke contract.

## Acceptance Criteria

- [x] All sixteen requested Plane surfaces dispatch through the existing Tasks route.
- [x] Legacy project Tasks remains the fallback without `planeSurface`.
- [x] Both canonical Plane rewrites exist, including the `/plane` Home root.
- [x] Home task links and task actions remain under Plane Work Items.
- [x] Stickies is visible and functional in the Plane sidebar.
- [x] Plane breadcrumb root resolves to `/{projectId}/plane/home`.
- [x] Settings Home navigation uses the canonical project setup/settings route.
- [x] Production is confirmed on Supabase `lgveqfnpkxvzbnnwuled`; no migration is reapplied.
- [x] Real Tasks, permissions, mutations, and Plane APIs remain functional in focused contracts.
- [x] AGPL headers, notices, `/auth/source`, `/api/source-info`, and exact-source flow are preserved.
- [ ] All sixteen authenticated production routes pass desktop and mobile smoke checks.
- [ ] Home task click opens the Plane Work Items inspector with `peek=<taskId>`.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared dispatcher and Tasks route are the only route integration owners.
- [x] Errors remain specific and actionable.
- [x] Live production Supabase project was confirmed before implementation.

## Integration and Verification

- [x] Requested focused unit and contract tests pass.
- [x] `npm run check:routes` passes.
- [x] Task-scoped `git diff --check` passes; unrelated dirty files are excluded.
- [ ] Independent review has no unresolved P0-P2 findings.
- [ ] Vercel performs the single production build.
- [ ] Desktop/mobile artifacts and the concise evidence report are recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: route-level 404, explicit API error response, visible Plane
  error state, or failed production smoke assertion.
- Detection path: focused tests, route gate, authenticated browser smoke report,
  console errors, API response inspection, and overflow measurement.
- Recovery path: stop deployment for schema mismatch; otherwise fix the shared
  dispatcher, navigation contract, or owning API before publishing.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: focused route/navigation/API contracts and one authenticated
  production smoke matrix.
- Guardrail evidence: pending focused verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Auth preflight | `npm run verify:browser -- --url https://projects.alleatogroup.com/31/tasks --name plane-migration-preflight` | Pass | Authenticated desktop/mobile route proof completed. |
| Preflight artifacts | `tests/agent-browser-runs/2026-07-31T22-55-05-691Z-plane-migration-preflight` | Pass | Current production legacy Tasks route loaded without login redirect. |
| Production Supabase | Authenticated production bundle inspection | Pass | `lgveqfnpkxvzbnnwuled=true`; alternate project reference absent. |
| Plane schema | Production REST readback | Pass | Plane domain tables plus `tasks` and `outlook_email_intake` returned HTTP 200. |
| Migration ledger | Read-only production ledger query | Pass | Versions `20260731231000` through `20260731231500` are already applied; none were reapplied. |
| Focused Jest contracts | Seven Plane surface/access/Home/Stickies suites | Pass | 30 tests passed. |
| Workspace shell | Focused Vitest navigation suite | Pass | 3 tests passed. |
| Stickies surface | Focused Vitest UI suite | Pass | 6 tests passed. |
| Route gate | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Whitespace gate | Task-scoped `git -c core.whitespace=cr-at-eol diff --check` | Pass | Unrelated dirty files were not changed. |
| Source parity | SHA-256 comparison against backup release candidate | Pass | 208/213 source files byte-identical; five differences are three LF-only license files and two documented integration seams. |

## Remaining Risk

- Vercel production compatibility and the authenticated 16-route desktop/mobile
  matrix remain to be proven by the single production deployment.

## Supabase Type Generation Recovery

- Cause: the configured legacy Supabase CLI token has an invalid format, so
  remote type generation exited before returning schema types.
- Detection gap: the CLI command writes its error payload to stdout, which can
  overwrite a redirected generated file before the non-zero exit is inspected.
- Recovery: `frontend/src/types/database.types.ts` was restored byte-for-byte
  from Git immediately; live schema and ledger checks then proved the required
  tables and migrations without changing production.
- Prevention: generated artifacts should be written to a temporary file and
  atomically replace the tracked file only after a successful CLI exit.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
