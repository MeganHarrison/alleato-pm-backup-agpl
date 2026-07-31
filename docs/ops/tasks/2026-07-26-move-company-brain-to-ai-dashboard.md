# Task: Make Company Brain the AI Dashboard entry surface

Status: In Progress
Owner: Codex
Created: 2026-07-26
Task ID: LOCAL-20260726-move-company-brain-to-ai-dashboard
Linear Issue: Not requested
Related Handoff: N/A

## Objective

Open the permission-scoped Company Brain experience at `/ai-dashboard` while preserving the direct `/ai/company-brain` route.

## Scope

- Reuse the Company Brain server loader on both routes.
- Remove the AI OS preview from the `/ai-dashboard` entry route.
- Excludes data-model, permission, and visual-design changes.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/features/company-brain/company-brain-data.ts`
- Existing shared primitives/services: `CompanyBrainExperience`, `requireBrainUser`, `PageShell`, `AiDashboardWorkspaceShell`
- Deprecated or parallel paths: `AiOsDashboard` remains available only from its explicit AI System route.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `/ai-dashboard` renders the same permission-scoped Company Brain content as `/ai/company-brain`.
- [x] Data loading and failure-loud behavior have one shared server owner.
- [x] The AI OS preview is no longer the dashboard entry content.
- [x] Targeted unit and route checks pass.
- [ ] Authenticated browser proof is captured (runner redirects to login; no authenticated session is configured).

## Failure-Loudly Contract

- Cause surfaced as: Company Brain renders its specific unavailable, partial-data, empty, and permission-limited states.
- Detection path: Company Brain route tests and authenticated browser route verification.
- Recovery path: Retry unavailable data or review permitted source/pipeline access from the rendered state.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: Shared server loader and route-ownership test.
- Guardrail evidence: `frontend/src/features/company-brain/__tests__/company-brain-page.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Route and data contracts | `npm run test:unit -- --runInBand --runTestsByPath ...company-brain-page.test.ts ...company-brain-contract.test.ts ...company-brain-data.test.ts ...route-consolidation.test.ts` | Pass | 4 suites, 17 tests. |
| Authenticated browser route | `agent-browser --session project-management-qa open https://projects.alleatogroup.com/ai/company-brain` | Blocked | Runner redirected to `/auth/login`; no authenticated session is configured. |

## Remaining Risk

- Authenticated production rendering must be verified after deployment. Owner: Codex with an authenticated browser session.

## Final Status

- [x] Standard implementation and targeted verification are complete.
- [x] Evidence is filled in; authenticated production evidence remains a release follow-up.
- [x] Incident learning is explicitly N/A.
