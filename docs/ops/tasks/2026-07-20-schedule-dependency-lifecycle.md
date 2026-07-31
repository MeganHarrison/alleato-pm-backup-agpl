# Task: Make Schedule Dependencies Operational

Status: In Progress
Owner: Codex S195
Created: 2026-07-20
Task ID: AAI-1186
Linear Issue: AAI-1186 — https://linear.app/megankharrison/issue/AAI-1186/make-schedule-dependencies-operational
Related Handoff: `docs/ops/handoffs/2026-07-20-S195-schedule-dependency-lifecycle.md`

## Objective

Let an authorized project user create, edit, remove, and inspect schedule dependencies and deadlines from the canonical schedule page, with cycle and cross-project attempts rejected before mutation.

## Scope

- Project-scoped dependency and deadline lifecycle, including API, schedule editor, Gantt data, focused regression coverage, and authenticated browser evidence.
- Reuse `schedule_dependencies`, `schedule_deadlines`, and `SchedulingService`; no duplicate scheduling store or parallel page.
- Excludes CPM/calendar calculations, import transaction safety, field updates, submittal links, and publishing workflow. Those are separately tracked Linear issues.

## Source of Truth

- Canonical runtime/data owner: `schedule_dependencies`, `schedule_deadlines`, the schedule task API, and `SchedulingService`.
- Existing shared primitives/services: `SchedulingService`, `TaskEditModal`, `GanttChart`, project API guardrails, and task validation.
- Deprecated or parallel paths: none; service-only dependency/deadline methods must not remain unexposed to the canonical schedule flow.

Verification contract: Required

## Acceptance Criteria

- [x] Authorized users can manage predecessors and deadlines for a task on the canonical schedule page.
- [x] Gantt API and display consume persisted dependencies/deadlines rather than placeholder values.
- [x] Self-referential, circular, cross-project, and invalid dependency changes fail with specific actionable errors.
- [x] Task edit, API, and Gantt behavior have focused regression coverage plus authenticated browser proof.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Test seams are agreed: task dependency API lifecycle and Gantt payload fidelity.
- [x] New dependency-editor behaviors advanced through red → green vertical slices; the earlier service/route slice is retained with corrective regression coverage.
- [x] Shared scheduling service owns cross-cutting dependency/deadline validation.
- [x] Errors are specific and actionable.
- [x] Database, authentication, and permission contracts are handled without a schema change.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual authenticated schedule user flow proves create/update/remove behavior.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a precise dependency/deadline validation or persistence error, including the offending task relationship.
- Detection path: focused unit/API tests and the task-editor validation state on the canonical schedule route.
- Recovery path: select a valid predecessor in the same project, remove the conflicting link, or correct the deadline date and retry.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the existing service persisted scheduling relationships but `getGanttData()` emitted placeholders and the canonical UI/API did not expose lifecycle management.
- Detection gap: existing tests proved task CRUD and view switching but not relationship persistence or Gantt data fidelity.
- Prevention: relationship-contract tests plus end-to-end create/update/remove coverage. A TDD correction was recorded after initial service/route changes preceded their red test; no further feature expansion proceeds until the seams are agreed and the first test is established.
- Guardrail evidence: service-scope, dependency-route, deadline-route, Gantt payload, refreshed-editor, and auth fallback regression tests; independent review approval in `docs/ops/evidence/2026-07-20-schedule-dependency-lifecycle/independent-review.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before product edits. |
| Runtime localization | Authenticated `http://localhost:3000/43/schedule` | Pass | Existing schedule data rendered; dependency lifecycle was absent from the user flow. |
| TDD: Gantt payload | `pnpm exec jest --runInBand --runTestsByPath src/lib/services/__tests__/scheduling-service.gantt.test.ts` | Pass | Persisted FS dependency and deadline are returned to the Gantt consumer. |
| TDD: dependency API | `pnpm exec jest --runInBand --runTestsByPath src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/dependencies/__tests__/route.test.ts` | Pass | Red confirmed generic 500; green returns corrective 400 for a self-link. |
| TDD: editor and client | Focused five-test run | Pass | Editor, modal integration, and typed project-scoped client adapter are covered. |
| TDD: deadline lifecycle | Focused modal/client tests | Pass | Persisted deadline display, save, intentional clear removal, and typed PUT/DELETE client methods are covered. |
| TDD: dependency update lifecycle | Focused modal/client/API tests | Pass | Existing predecessor edits preserve its ID and use typed project-scoped PATCH validation and mutation. |
| Browser: canonical schedule editor | `/tmp/schedule-dependency-editor-2026-07-20.png` | Pass | Authenticated `http://localhost:3000/43/schedule`; predecessor controls render in the existing task modal. |
| Browser: mobile editor | `/tmp/schedule-dependency-editor-mobile-2026-07-20.png` | Pass | 390×844 viewport stacks the predecessor controls without overflow; browser error log was empty. |
| Browser: current canonical editor | `/tmp/schedule-dependency-deadline-editor-current-2026-07-20.png` | Pass | Authenticated `/43/schedule` opens the deadline and predecessor editor for “Install Sanitary Sewer”; attached to AAI-1186 as Linear attachment `2add4530-798e-4feb-a7c1-f64ab62daf5e`. |
| Browser: deadline save/clear | Server log + `/tmp/schedule-deadline-saved-2026-07-20.png`, `/tmp/schedule-deadline-cleared-2026-07-20.png` | Pass | One successful project-scoped PUT and cleanup DELETE for task `fdb8360e-bb78-46a6-9d98-168e93438a58`; no test deadline remains. |
| Login localization | `/private/tmp/project-management-frontend.log` | Pass | First compile of `auth/post-login-redirect` took 11s while its client timeout is 8s; hot endpoint returned 200 in 236ms, then authenticated route verification succeeded. |
| Login hardening | `pnpm exec jest --runInBand --runTestsByPath src/lib/auth/__tests__/post-login-redirect-client.test.ts` + saved-profile browser login | Pass | 7/7. Redirect is now bounded at 30s, not 8s; authenticated `alleato-test` login reached `/` and called the redirect endpoint successfully after an on-demand route compile. |
| Browser: predecessor lifecycle | `/tmp/schedule-dependency-created-2026-07-20.png`, `/tmp/schedule-dependency-updated-2026-07-20.png`, `/tmp/schedule-dependency-removed-2026-07-20.png` + server log | Pass | Authenticated UI created Light Fixtures → Install Sanitary Sewer (201), updated it through PATCH (200), then removed the same dependency (200); cleanup confirmed by exact dependency ID `7c24cf1b-0872-43e0-84a6-bc1cb7cab1e3`. |
| Browser: Gantt connector | `/tmp/schedule-gantt-dependency-task-window-2026-07-20.png` | Pass | Authenticated `/43/schedule` rendered the persisted Light Fixtures → Install Sanitary Sewer connector between actual Gantt bars; attached to AAI-1186 as Linear attachment `54616a17-0663-4c1f-a5b7-45b4d26856a0`. The temporary relationship was deleted afterward (dependency ID `51c46e68-8ffe-4cd4-8b22-21269174c830`, 200). |
| Focused scheduling/auth suite | `pnpm exec jest --runInBand --runTestsByPath …10 suites…` | Pass | 10 suites, 34 tests: service scope/Gantt, dependency/deadline routes, editor, modal dependency/deadline, client, refreshed-editor, and auth fallback coverage. |
| Focused lint | `pnpm exec eslint …schedule lifecycle files…` | Pass with existing warnings | 0 errors; seven pre-existing page/modal design-system/type warnings remain outside this lifecycle change. |
| Full frontend typecheck | `cd frontend && npm run typecheck` (rerun after scope/auth rework) | Unrelated failure | No errors remain in schedule dependency/deadline or auth scope/fallback files; existing debt spans daily briefs/admin, source-sync, AI, Outlook, coordination, contracts, drawings, documents, executive, progress reports, and task deduplication. |
| Independent review | `docs/ops/evidence/2026-07-20-schedule-dependency-lifecycle/independent-review.md` | Pass | Initial review required service-scope, safe-auth, and negative-path corrections; re-review approved the remediation. |

## Remaining Risk

- Concurrent-session control-plane files were additive-conflict resolved before claim; retain their staged state when publishing this task.
- The predecessor lifecycle test used a reversible relationship on the populated schedule and cleaned it up. The server log confirms exact POST → PATCH → DELETE results; agent-browser's request list mirrors each request multiple times, so server logs are the authoritative count (one mutation each).
- Local-development login no longer uses the 8s form timeout for the post-auth redirect; the explicit 30s bound protects cold compile without allowing an indefinite spinner. Browser console may show transient connection-refused messages during concurrent Fast Refresh/server restarts; the server was listening on port 3000 after the login check and the redirect completed successfully.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action. No task-scope work deferred.
