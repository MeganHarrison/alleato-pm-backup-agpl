# Task: Consolidate the AI Dashboard Route

Status: In Progress
Owner: Codex (S215)
Created: 2026-07-21
Task ID: LOCAL-AI-DASHBOARD-ROUTE-CONSOLIDATION-2026-07-21
Linear Issue: Unavailable: no Linear connector is exposed in this session.
Related Handoff: `docs/ops/handoffs/2026-07-21-S215-ai-dashboard-route-consolidation.md`

## Objective

Make `/ai-dashboard` the canonical AI OS experience and retire the redundant AI OS and Projects views without leaving stale bookmarks broken.

## Scope

- Canonical dashboard and legacy route owners only.
- Preserve all concurrent dashboard component/data edits outside those route owners.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`
- Existing shared primitives: `PageShell`, `AiDashboardWorkspaceShell`
- Deprecated paths: `/ai-dashboard/ai-os`, `/ai-dashboard/projects`

Verification contract: Required

## Acceptance Criteria

- [x] `/ai-dashboard` renders the AI OS surface.
- [x] Legacy AI OS and Projects URLs redirect to `/ai-dashboard`.
- [x] The previous executive dashboard route owner is no longer rendered.
- [ ] Focused route checks and browser evidence are recorded.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared shell is preserved around the canonical AI OS surface.
- [x] Legacy paths have an explicit recovery destination.
- [x] Concurrent dashboard edits remain untouched.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow proves canonical and retired routes.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: retired URLs redirect to the canonical dashboard instead of showing outdated content.
- Detection path: route test and browser navigation to each URL.
- Recovery path: `/ai-dashboard` remains the single AI OS entry point.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: AI dashboard navigation exposed duplicate, low-value entry views.
- Detection gap: no route-level canonical-owner assertion.
- Prevention: focused route contract verifies the single canonical entry point.
- Guardrail evidence: pending focused route check.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope captured before implementation. |
| Route contract | `cd frontend && npm run test:unit -- --runInBand --testPathPatterns='route-consolidation.test.ts'` | Pass | 3 assertions: root renders AI OS and both legacy routes redirect. |
| Route conflicts | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Desktop browser | `docs/ops/evidence/2026-07-21-ai-dashboard-route-consolidation-desktop.png` | Pass | `/ai-dashboard` rendered the AI OS; `/ai-dashboard/ai-os` and `/ai-dashboard/projects` resolved to `/ai-dashboard`. |
| Mobile browser | `docs/ops/evidence/2026-07-21-ai-dashboard-route-consolidation-mobile.png` | Pass | 390×844 canonical route rendered its AI OS content and navigation. |

## Remaining Risk

- The concurrent, uncommitted `workspace-shell.tsx` and `ai-os-data.ts` changes still display links to retired URLs. Those URLs safely redirect, but the labels must be removed by the active owner before publication.
- Publication is blocked while `main` is both ahead/behind and has active leases plus unrelated dirty files; pushing from this shared checkout would risk overwriting concurrent work.

## Final Status

- [ ] All required checklist items are complete. Publication and stale-navigation cleanup remain.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A for a recurring product failure.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
