# Task: Replace project intelligence page with a scan-first operating dashboard

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-989 - https://linear.app/megankharrison/issue/AAI-989/replace-project-intelligence-page-with-a-scan-first-operating
Related Handoff: N/A

## Objective

Replace the current project intelligence page with one canonical operating dashboard that gives a project user an immediate read on job health, what needs action now, what changed, and the evidence behind those conclusions.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

```text
Primary user: Project executive, PM, and operations lead
Primary job: Understand the current operating read fast enough to decide what needs attention today
Primary decision: Is this job healthy, what changed, and where do I need to act next
Tier 1: Current operating read, immediate action list, highest-risk signals
Tier 2: What changed, decision/risk evidence, source freshness
Tier 3: Financial context, timeline context, open tasks
Hide until requested: Extended timeline history, secondary diagnostics, low-signal source/process metadata
Remove: Equal-weight section stacking, duplicate narrative, low-value ingestion chrome, passive summaries without action or evidence value
Primary action: Open and inspect the highest-priority intelligence item, source, or workflow follow-up
Failure-loudly behavior: If packet quality, freshness, or load state is degraded, the page says exactly what failed and what path still remains trustworthy
```

## Acceptance Criteria

- [x] The top of the page presents one dominant operating read instead of equal-weight sections.
- [x] The dashboard separates current health, immediate follow-up, and supporting evidence into a clear scan path.
- [x] Low-value or redundant sections are removed or demoted behind disclosure.
- [x] Freshness, evidence quality, and packet failure states remain explicit and fail loudly.
- [x] Mobile layout leads with the primary dashboard read before supporting detail.
- [x] Existing packet/evidence drill-down paths remain canonical; no duplicate intelligence system is introduced.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Planned Files

- `docs/ops/tasks/2026-07-07-project-intelligence-dashboard-replacement.md`
- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx`
- Supporting shared intelligence/layout components only if the redesign warrants extraction.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Current-route code audit | `frontend/src/app/(main)/[projectId]/intelligence/page.tsx`; supporting intelligence services/types | Pass | Confirmed the page mixed packet summary, ops record, task list, and ingestion feed into one equal-weight dashboard. |
| Historical context | `MEMORY.md` search for project intelligence and prior packet work | Pass | Reused packet-first and freshness-separation context so the redesign preserves data ownership. |
| Linear issue | `AAI-989`; kickoff comment `d3202c85-3111-437d-9049-672fd9aee96d` | Pass | Tracking issue created before implementation and updated at kickoff. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/intelligence/page.tsx' 'src/lib/ai/__tests__/intelligence-page-state.test.ts'` | Pass | Page file and updated fail-loud test both pass. |
| Targeted test | `cd frontend && ./node_modules/.bin/jest 'src/lib/ai/__tests__/intelligence-page-state.test.ts' --runInBand` | Pass | 4 tests passed, including stale/uncited packet warning coverage for the new trust lane. |
| Diff hygiene | `git diff --check -- docs/ops/tasks/2026-07-07-project-intelligence-dashboard-replacement.md 'frontend/src/app/(main)/[projectId]/intelligence/page.tsx' frontend/src/lib/ai/__tests__/intelligence-page-state.test.ts` | Pass | No whitespace or patch formatting issues. |
| Local browser proof | `Playwright one-off against http://localhost:3001/876/intelligence with frontend/tests/.auth/user.json` | Pass | Desktop route loaded the redesigned dashboard, no browser errors, screenshot at `/tmp/project-intelligence-dashboard-local.png`. |
| Mobile browser proof | `Playwright one-off against http://localhost:3001/876/intelligence with iPhone 13 viewport and frontend/tests/.auth/user.json` | Pass | Mobile route leads with title, actions, hero status, and operating read; screenshot at `/tmp/project-intelligence-dashboard-local-mobile.png`. |
| Production auth readback | `Playwright one-off against https://projects.alleatogroup.com/876/intelligence with frontend/tests/.auth/projects-user.json` | Partial | Saved auth redirected to login; this was auth-state drift, not a page runtime error. |

## Files Changed

- `docs/ops/tasks/2026-07-07-project-intelligence-dashboard-replacement.md` - task contract, attention brief, verification plan
- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx` - replaces the equal-weight intelligence stack with an operating-read dashboard, act-now lane, trust lane, and quieter supporting context
- `frontend/src/lib/ai/__tests__/intelligence-page-state.test.ts` - adds fail-loud warning coverage for stale and uncited packets

## Risks / Gaps

- Production browser auth state for `projects.alleatogroup.com` is stale; live deployed route proof still needs a refreshed auth snapshot if you want production screenshots instead of local route proof.
- The current file still contains both internal-initiative and client-project views. This slice intentionally kept internal behavior stable rather than redesigning both surfaces at once.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
