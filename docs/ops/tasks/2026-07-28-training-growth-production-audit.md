# Task: Production Growth Assessment Audit

Status: Complete
Owner: Codex Sgrowthaudit
Created: 2026-07-28
Task ID: local-training-growth-production-audit
Linear Issue: Not requested; this is a single-session bounded production audit.
Related Handoff: `docs/ops/handoffs/2026-07-28-Sgrowthaudit-training-growth-production-audit.md`

## Objective

Verify the production `/training/growth` assessment end to end and correct the
confirmed client-side failures without bypassing the repository's database gate.

## Scope

- Production create/update, reload, responsive, accessibility, and failure-path evidence.
- Growth client draft safety, save timeout, replacement disclosure, saved-detail review, and regression coverage.
- Assessment-content and persistence-contract audit.
- Excludes database-contract changes until production Supabase types can be generated successfully.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/features/training/SkillGrowthClient.tsx`, `skill-growth.ts`, and `skill-growth-server.ts`
- Existing shared primitives/services: `apiFetchWithTimeout`, `useConfirm`, `SkillWheel`
- Deprecated or parallel paths: standalone `alleato-own-your-growth.html` is a source reference, not a runtime owner.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] A complete production check-in saves with HTTP 200 and reloads exact scores, targets, cadence, and focus-plan values.
- [x] An incomplete focus plan cannot be saved.
- [x] Saved evidence and focus-plan detail can be reviewed from recent history.
- [x] Switching roles with an unsaved draft requires an explicit discard decision.
- [x] Replacing a same-role, same-date check-in requires an explicit update decision.
- [x] A stalled save fails loudly instead of leaving the form saving indefinitely.
- [x] Focus-ranking copy describes the implemented gap ranking truthfully.
- [x] Focused unit and browser checks cover the changed boundary.
- [x] Database-dependent improvements remain blocked unless the Supabase types gate succeeds.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the current production outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and the published commit is an ancestor of `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: specific draft-loss, replacement, timeout, API, or database-gate message.
- Detection path: production agent-browser flow, focused Jest/Playwright checks, and migration/type commands.
- Recovery path: cancel destructive navigation/update, retry an idempotent same-date save, or restore production Supabase type-generation access before database changes.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The assessment's saved JSON detail was returned to the client but history projected only aggregate scores; role/date changes and requests lacked explicit safety boundaries.
- Detection gap: Existing E2E asserted a generic average and did not inspect saved evidence, role-switch draft loss, same-date replacement, or timeout recovery.
- Prevention: Focused client tests and production browser readback now assert the missing boundaries.
- Guardrail evidence: 27 focused tests, independent approval, local browser
  proof, and authenticated post-deploy production readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production start | `01-production-start.png` | Pass | Authenticated Project Engineer assessment loaded. |
| Required-plan guard | `02-required-plan-blocks-save.png` | Pass | Save remained disabled while one focus plan was incomplete. |
| Production save | `POST /api/training/growth` | Pass | HTTP 200 on 2026-07-28. |
| Reload readback | Agent-browser accessibility snapshot | Pass | Exact scores, targets, plan fields, 30-day cadence, and Jul 28 history row restored. |
| Mobile reload | `05-mobile-reload.png`, `07-mobile-bottom.png` | Pass | 390px cold reload, no horizontal overflow, controls/history reachable. |
| Accessibility | `agent-browser a11y --json` | Needs work | Five assessment contrast nodes plus shared-shell landmark findings. |
| Focused tests | Six Jest suites | Pass | 27 tests passed. |
| Independent review | Reviewer agent | Pass after fixes | No blocking findings; timeout-retry and client-navigation gaps were fixed and regression-tested. |
| Source lint | Targeted ESLint | Pass | No source errors; E2E path is intentionally ignored by the ESLint config. |
| Repo TypeScript | `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit --pretty false` | Unrelated tooling block | Terminated after 373s and ~6.5 GB with no diagnostics; no growth file was implicated. |
| Supabase types gate | CLI, DB URL, and Management API attempts | Blocked | Invalid legacy token; Docker/Podman unavailable; Management API returned 403. |
| Production deployment | Vercel `dpl_ujhfCX1T7YW9hXwqg8gz51FR6kiT` | Pass | Ready; commit `61520a92` promoted to `projects.alleatogroup.com`. |
| Post-deploy readback | `15-production-post-deploy-history.png`, `16-production-post-deploy-navigation-guard.png` | Pass | Saved details and dirty-navigation protection verified on the live route. |

## Remaining Risk

- Role assessments omit universal core skills and users cannot choose 2–4 focus
  skills because the database trigger enforces the current canonical role-only,
  top-four-gap contract. Owner: production Supabase access/tooling.
- Training theme contrast changes overlap an active isolated writer lease on
  `training-theme.module.css`; retain the axe evidence for the owning session.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
