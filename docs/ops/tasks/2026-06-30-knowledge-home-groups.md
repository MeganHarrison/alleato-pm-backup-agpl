# Task: Knowledge home groups

Status: Blocked/Deferred - authenticated browser proof and publish remaining
Owner: Codex
Created: 2026-06-30
Linear Issue: Blocked - Linear connector `_save_issue` requires a team UUID and no team lookup tool is exposed in this session.
Related Handoff: N/A

## Objective

Update `/knowledge` so it is a quiet top-level home with two choices:
`How to Use the App` and `Company Knowledge Base`. Route each choice to a group
home. Keep the current Company Knowledge Base experience intact, and add an app
help group page organized by tool.

## Attention Brief

Primary user: Alleato users looking for either product instructions or company
knowledge.
Primary job: Choose the right knowledge source before browsing details.
Primary decision: Is this question about using the app or about company
knowledge.
Tier 1: The two top-level group links.
Tier 2: App-help tool groups and direct article links.
Tier 3: Existing company knowledge topic browsing.
Hide until requested: Individual app-help articles until the user chooses the
app-help group.
Remove: Mixed app-help and company-knowledge concepts on the same first screen.
Primary action: Choose a top-level group, then select a tool/article or company
knowledge topic.
Failure-loudly behavior: Route/component tests assert the two-group home,
company knowledge route handoff, and app-help tool grouping.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing knowledge route and current company knowledge component reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for app-help grouping data.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] `/knowledge` shows only the two top-level group choices.
- [x] Company Knowledge Base route renders the current knowledge page experience.
- [x] How to Use the App route groups help documents by tool.
- [x] User-facing UI follows the Alleato noise gate and responsive standards.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] Existing `/knowledge/manage` admin source route remains intact.
- [x] Existing company knowledge browse/search behavior remains available.
- [x] App-help grouping uses a typed local source, not ad hoc inline filtering.

## Regression Guardrails

- [x] Unit/component test added or updated for the two-option home.
- [x] Unit/component test added or updated for app-help tool grouping.
- [x] Existing company knowledge page test remains passing.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated.
- [x] Targeted automated tests run.
- [x] Browser/user-flow verification attempted for frontend-visible routes.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `frontend/src/app/(main)/knowledge/page.tsx` - top-level two-option knowledge home.
- `frontend/src/app/(main)/knowledge/company/page.tsx` - current Company Knowledge Base experience.
- `frontend/src/app/(main)/knowledge/app/page.tsx` - How to Use the App group home.
- `frontend/src/features/knowledge/knowledge-home-page.tsx` - group choice UI.
- `frontend/src/features/knowledge/app-help-page.tsx` - app-help tool grouping UI.
- `frontend/src/features/knowledge/app-help-content.ts` - typed tool/article grouping source.
- `frontend/src/features/knowledge/__tests__/*` - focused regression tests.
- `docs/ops/tasks/2026-06-30-knowledge-home-groups.md` - task ledger.

## Acceptance Criteria

- `/knowledge` presents exactly two primary options: `How to Use the App` and
  `Company Knowledge Base`.
- Each option links to a separate group home.
- `/knowledge/company` preserves the current Company Knowledge Base page.
- `/knowledge/app` groups documents by tool, including Budget, Prime Contracts,
  Commitments, Change Events, Change Orders, Schedule, and Meetings.
- Mobile layout stacks cleanly with no horizontal overflow.

## Evidence

| Check               | Command / artifact                                                                                                                                                                                                                                  | Result             | Notes                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Linear create       | `_save_issue` with `team: "Alleato"`                                                                                                                                                                                                                | Blocked            | Connector returned `teamId must be a UUID`; no team lookup tool exposed.                                                                         |
| Formatting          | `pnpm --dir frontend exec prettier --write ...`                                                                                                                                                                                                     | Pass               | Formatted touched route, feature, test, and task files.                                                                                          |
| Targeted tests      | `pnpm --dir frontend test:unit -- --runInBand --runTestsByPath src/features/knowledge/__tests__/knowledge-home-page.test.tsx src/features/knowledge/__tests__/app-help-page.test.tsx src/features/knowledge/__tests__/knowledge-base-page.test.tsx` | Pass               | 3 suites, 4 tests passed. Covers two-option home, app-help tool groups, and existing company knowledge behavior.                                 |
| Targeted lint       | `pnpm --dir frontend exec eslint ...knowledge touched files...`                                                                                                                                                                                     | Pass with warnings | No errors. Warnings: route-file PageShell detector on thin route wrappers, plus existing `ExpandingSearch` warning in `knowledge-base-page.tsx`. |
| Changed type guard  | `pnpm --dir frontend typecheck:changed`                                                                                                                                                                                                             | Pass               | No new `any` type debt detected.                                                                                                                 |
| Browser route proof | `agent-browser open http://localhost:3001/knowledge && agent-browser wait --load networkidle && agent-browser snapshot -i`                                                                                                                          | Blocked            | Local route redirected to `/auth/login?callbackUrl=%2Fknowledge`; authenticated browser state unavailable in this session.                       |
| Whitespace          | `git diff --check -- ...task-owned files...`                                                                                                                                                                                                        | Pass               | No whitespace errors.                                                                                                                            |

## Risks / Gaps

- Authenticated browser verification is blocked by login redirect in this
  session. The implementation has component-level proof but not live UI proof.
- This checkout has unrelated pre-existing dirty files; publish should use
  exact task-owned files or hunk staging.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
