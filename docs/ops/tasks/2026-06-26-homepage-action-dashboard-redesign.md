# Task: Homepage Action Dashboard Redesign

Status: Verified locally
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-707 - https://linear.app/megankharrison/issue/AAI-707/redesign-post-login-homepage-action-dashboard
Related Handoff: N/A

## Objective

Redesign the authenticated `/home` Action Dashboard so it becomes a valuable work-recovery surface instead of a bland list page, while preserving the post-login routing contract and the Alleato product noise gate.

## Attention Brief

Primary user: Authenticated Alleato operator returning after login.
Primary job: Decide what needs attention now, resume the right project, and open the correct work queue with minimal scanning.
Primary decision: Which project, task, review queue, or source-backed brief should be opened first.
Tier 1: Action required now, open assigned work, and project continuation.
Tier 2: AI/review queues, recent movement, and active project entry points.
Tier 3: Existing notification and assignment queue links.
Hide until requested: Deep project metadata, provider/debug detail, historical activity, long project lists, and unimplemented source wiring.
Remove: Empty placeholder lines that dominate the page, generic subtitles, decorative dashboard cards, KPI rows, fake AI brief claims, and repeated "Open" labels that do not improve scanning.
Primary action: Open the most relevant work item, review queue, or project.
Failure-loudly behavior: Tests or browser checks fail if required homepage sections disappear, if task/project rows lose canonical links, or if pending source wiring is presented as live intelligence.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked and evidence is recorded. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Impeccable skill and product/noise-gate references reviewed.
- [x] Existing architecture and prior related implementation reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Homepage layout redesigned around actionable scanning.
- [x] Existing post-login routing behavior preserved.
- [x] No fake live integration claims added for AI brief or inbox priority rollup.
- [x] User-facing copy/UI follows Impeccable and Alleato product noise gate.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] Regression guardrail added or updated for core behavior.

## Integration Checklist

- [x] End-to-end route remains `/home` under the authenticated main shell.
- [x] Task rows link to canonical task/project surfaces.
- [x] Project rows link to canonical project home routes.
- [x] Pending AI/inbox source wiring is visibly distinct from live content.
- [x] Mobile and desktop layouts preserve section hierarchy without horizontal overflow.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for `/home`.
- [x] Desktop and mobile screenshot artifacts captured.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear issue | AAI-707 | Passed | Created before implementation after first invalid team values were rejected. |
| Impeccable context | `node .agents/skills/impeccable/scripts/load-context.mjs`; `npx impeccable teach` | Partial | `DESIGN.md` loaded. `PRODUCT.md` missing. `npx impeccable teach` returned `Warning: cannot access teach`, so existing design context and noise-gate references are used. |
| Static/type/lint | `cd frontend && npx eslint 'src/app/(main)/home/page.tsx' 'src/app/(main)/home/__tests__/home-page-contract.test.ts'` | Passed | No output. Earlier run caught a raw heading design-system violation, fixed before final pass. |
| Targeted tests | `cd frontend && npm run test:unit -- --runTestsByPath 'src/app/(main)/home/__tests__/home-page-contract.test.ts' --runInBand` | Passed | 1 suite, 2 tests passed. |
| Browser/user-flow | `agent-browser open http://localhost:3001/home`; screenshots in `docs/ops/evidence/homepage-action-dashboard-redesign/` | Passed | Desktop and mobile rendered the redesigned sections after clearing `.next` and restarting Next on port 3001. |
| End-to-end proof | `home-desktop-check.json`; `home-mobile-check.json` | Passed | Required sections present, loading indicators cleared, and no horizontal overflow at 1440px or 390px. |
| Browser errors | `home-browser-errors-desktop.txt`; `home-browser-errors-mobile.txt` | Passed | Agent Browser request log cleared after the clean proof pass. |

## Files To Change

- `frontend/src/app/(main)/home/page.tsx` - homepage layout, hierarchy, copy, and row treatments.
- `frontend/src/app/(main)/home/__tests__/home-page-contract.test.ts` - source-contract guardrail for required sections and pending source-wiring copy.
- `docs/ops/tasks/2026-06-26-homepage-action-dashboard-redesign.md` - task ledger and evidence.
- `docs/ops/evidence/homepage-action-dashboard-redesign/` - browser proof artifacts.

## Risks / Gaps

- `PRODUCT.md` is missing and the Impeccable teach command is not accessible in this checkout. Existing `DESIGN.md`, the product-register reference, and the Alleato product noise gate are the design authority for this task.
- The current homepage APIs may return no tasks for the signed-in user. Empty states must be useful without pretending there is live work.
- Existing unrelated dirty files are present in the checkout and must not be staged or modified by this task.
- Full project typecheck/build was not run in the main thread per long-running verification guidance. This slice used targeted ESLint, a focused Jest guardrail, and browser proof.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
