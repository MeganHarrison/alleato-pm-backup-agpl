Status: Partial - Browser verification blocked by owner-only access on available saved auth
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-915
Linear URL: https://linear.app/megankharrison/issue/AAI-915/make-project-assignment-inbox-a-single-frontend-surface-with
Related Handoff: N/A

## Objective

Make the existing project-assignment workflow easy to find and use on the frontend by turning `/assignment-inbox` into the single canonical surface for:

- unassigned meetings, tasks, emails, Teams messages, and documents that need a project
- visible attribution rules and assignment logic already applied by the system

## Attention Brief

Primary user: operations/admin users cleaning up project attribution across incoming work.
Primary job: assign unlinked work to the correct project and inspect the rules driving future assignment.
Primary decision: assign this item now, trust an existing rule, or adjust/create a rule.
Tier 1: unassigned work queue, assignment action, attribution-rules tab.
Tier 2: suggestion confidence, rule pattern, rule type, project target, rule status.
Tier 3: secondary counts, evidence text, candidate-review links, explanatory copy.
Hide until requested: verbose diagnostics, rule-edit affordances for non-admin users, raw metadata.
Remove: duplicate routes, admin-only discoverability for core attribution visibility, page-local decorative wrappers.
Primary action: assign the item or inspect the rule from the same page.
Failure-loudly behavior: if rules or inbox data fail to load, the page must show the exact failed surface and preserve access to the other tab when possible.

## Acceptance Criteria

- [ ] `/assignment-inbox` remains the canonical frontend route for project-assignment cleanup.
- [ ] The page has two page-level tabs: unassigned work and attribution rules.
- [ ] The unassigned-work tab still supports the existing assignment flow without regression.
- [ ] The attribution-rules tab makes current rules easy to inspect from the same route.
- [ ] Admin users retain a direct path to manage rules; non-admin users do not see broken edit controls.
- [ ] The page stays quiet and open-canvas, following the Alleato noise gate.
- [ ] Failures in one data surface do not silently blank the other surface.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Scope Checklist

- [x] Existing assignment inbox route and loader reviewed.
- [x] Existing attribution-rule/admin surface reviewed.
- [x] Shared ownership seam chosen before implementation.
- [x] Attention brief and failure-loud behavior defined before code edits.
- [x] Linear issue created before implementation.
- [x] Linear kickoff comment recorded.

## Implementation Checklist

- [x] Planned files listed before edits.
- [x] Reuse the existing route instead of creating a parallel page.
- [x] Shared data contracts created for rule visibility, if needed.
- [x] Admin-only management behavior preserved or made explicit.
- [x] Noise-producing wrappers/copy avoided on the new combined surface.
- [x] Errors are explicit and scoped to inbox versus rules data.

## Integration Checklist

- [x] One canonical route owns both assignment work and rule visibility.
- [x] Existing assignment APIs remain intact.
- [x] Rule data is fetched through one typed route/loader seam.
- [x] Navigation/discoverability is updated only if the current route remains hard to find after consolidation.

## Regression Guardrails

- [x] Targeted automated coverage added or updated for the combined route behavior.
- [x] Existing assignment flow contract remains covered.
- [x] Rule visibility path fails loudly instead of silently rendering empty content on error.

## Verification Checklist

- [x] Focused lint/static check run on touched frontend files.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for the two-tab page.
- [ ] End-to-end requested outcome proved: assignable queue + visible rules in one page.
- [x] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `docs/ops/tasks/2026-07-03-project-assignment-surface-unification.md`
- `frontend/src/app/(tables)/assignment-inbox/page.tsx`
- `frontend/src/app/(tables)/assignment-inbox/assignment-inbox-client.tsx`
- `frontend/src/features/assignment-inbox/load-inbox-items.ts`
- `frontend/src/features/assignment-inbox/assignment-inbox-table-config.tsx`
- `frontend/src/features/assignment-inbox/attribution-rules.ts`
- `frontend/src/features/assignment-inbox/assignment-inbox-rules-panel.tsx`
- `frontend/src/app/api/assignment-inbox/assign/route.ts`
- `frontend/src/app/api/assignment-inbox/assign/__tests__/route.test.ts`
- `frontend/src/app/api/assignment-inbox/rules/route.ts`
- `frontend/src/app/api/assignment-inbox/__tests__/rules.route.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Existing inbox route review | `frontend/src/app/(tables)/assignment-inbox/{page.tsx,assignment-inbox-client.tsx}` | Pass | Existing unassigned-work route confirmed before edits. |
| Existing rule surface review | `frontend/src/app/(admin)/project-attribution/project-attribution-review-client.tsx`, `frontend/src/app/api/admin/project-attribution-rules/route.ts` | Pass | Existing admin rule surface and API confirmed before edits. |
| Historical context review | `WORKING_CONTEXT.md` project assignment inbox section | Pass | Confirmed this workflow already shipped and should be promoted, not rebuilt. |
| Task gate | `docs/ops/tasks/2026-07-03-project-assignment-surface-unification.md` | Pass | Task file created before implementation edits. |
| Linear kickoff | Comment `b507d176-fd53-4913-bd53-bc00574bc383` on `AAI-915` | Pass | Scope and verification plan recorded before code edits. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(tables)/assignment-inbox/assignment-inbox-client.tsx' 'src/features/assignment-inbox/load-inbox-items.ts' 'src/features/assignment-inbox/assignment-inbox-table-config.tsx' 'src/features/assignment-inbox/assignment-inbox-rules-panel.tsx' 'src/features/assignment-inbox/attribution-rules.ts' 'src/app/api/assignment-inbox/assign/route.ts' 'src/app/api/assignment-inbox/assign/__tests__/route.test.ts' 'src/app/api/assignment-inbox/rules/route.ts' 'src/app/api/assignment-inbox/rules/__tests__/route.test.ts'` | Pass | No errors across the expanded task + rules unification surface. |
| Targeted route tests | `cd frontend && ./node_modules/.bin/jest 'src/app/api/assignment-inbox/assign/__tests__/route.test.ts' 'src/app/api/assignment-inbox/rules/__tests__/route.test.ts' --runInBand` | Pass | Assignment route now covers tasks in addition to documents/emails; rules route still covers auth, non-admin, and admin cases. |
| Whitespace diff | `git diff --check -- 'docs/ops/tasks/2026-07-03-project-assignment-surface-unification.md' 'frontend/src/app/(tables)/assignment-inbox/assignment-inbox-client.tsx' 'frontend/src/features/assignment-inbox/load-inbox-items.ts' 'frontend/src/features/assignment-inbox/assignment-inbox-table-config.tsx' 'frontend/src/features/assignment-inbox/assignment-inbox-rules-panel.tsx' 'frontend/src/features/assignment-inbox/attribution-rules.ts' 'frontend/src/app/api/assignment-inbox/assign/route.ts' 'frontend/src/app/api/assignment-inbox/assign/__tests__/route.test.ts' 'frontend/src/app/api/assignment-inbox/rules/route.ts' 'frontend/src/app/api/assignment-inbox/rules/__tests__/route.test.ts'` | Pass | No whitespace or patch-format issues. |
| Browser auth check | `agent-browser auth login alleato-test-3001`; `agent-browser open http://localhost:3001/assignment-inbox` | Blocked | Saved test auth reaches `/access-denied?reason=owner-only`, so live browser proof for this owner-only route remains blocked until an owner-capable session is available. |

## Files Changed

- `docs/ops/tasks/2026-07-03-project-assignment-surface-unification.md` - task gate and evidence ledger.
- `frontend/src/app/(tables)/assignment-inbox/assignment-inbox-client.tsx` - repointed page-level tabs to queue versus rules on the canonical route.
- `frontend/src/features/assignment-inbox/load-inbox-items.ts` - added unlinked tasks to the same inbox union and task-origin project suggestions from linked source records.
- `frontend/src/features/assignment-inbox/assignment-inbox-table-config.tsx` - added `Task` content type to the shared inbox filter vocabulary.
- `frontend/src/features/assignment-inbox/assignment-inbox-rules-panel.tsx` - quiet read-only rules panel with explicit failure state and admin follow-through links.
- `frontend/src/features/assignment-inbox/attribution-rules.ts` - shared rules response contract for the inbox surface.
- `frontend/src/app/api/assignment-inbox/assign/route.ts` - extended the canonical assignment write path to support unlinked tasks without routing them through attribution-learning feedback.
- `frontend/src/app/api/assignment-inbox/assign/__tests__/route.test.ts` - added task assignment coverage to the inbox assignment route tests.
- `frontend/src/app/api/assignment-inbox/rules/route.ts` - signed-in rules visibility API with admin-only pending-candidate counts.
- `frontend/src/app/api/assignment-inbox/rules/__tests__/route.test.ts` - targeted auth and payload coverage for the new route.

## Risks / Gaps

- Existing attribution-rule UI is still admin-oriented for editing, so the new shared tab remains read-only and routes admins to the dedicated management surfaces for mutations.
- Task assignment now lands in the shared queue, but task reassignment intentionally does not feed the attribution-rule learning loop because that service currently only accepts `document_metadata` and `outlook_email_intake` sources.
- Browser proof still needs an owner-capable auth session because the available saved `alleato-test-3001` profile is redirected to `/access-denied?reason=owner-only`.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
