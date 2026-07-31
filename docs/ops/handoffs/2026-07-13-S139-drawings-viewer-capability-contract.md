# S139 Handoff: Drawings Viewer Capability Contract

Status: Accepted
Owner: Codex
Task: `docs/ops/tasks/2026-07-13-drawings-viewer-capability-contract.md`
Linear: AAI-1061 — https://linear.app/megankharrison/issue/AAI-1061/add-deterministic-drawings-viewer-capability-regression-contract

## Current Status

Implementation, end-to-end verification, publish, and remote read-back are complete.

## Owned Scope

- `docs/ops/tasks/2026-07-13-drawings-viewer-capability-contract.md`
- `docs/ops/handoffs/2026-07-13-S139-drawings-viewer-capability-contract.md`
- `frontend/tests/e2e/drawings/drawings-viewer-capability-contract.spec.ts`
- `frontend/config/playwright/playwright.config.drawings-capability.ts`
- `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`
- `frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/pdf-proxy/route.ts`
- `frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/pdf-proxy/__tests__/route.test.ts`
- `frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx`
- `frontend/src/components/drawings/__tests__/PdfjsExpressDrawingViewer.cleanup.unit.test.tsx`
- `docs/ops/evidence/2026-07-13-drawings-capability-contract/**`
- Viewer fingerprint in `docs/ops/learning/recurring-failures.yaml`
- S139 orchestration rows

## Intake Block

1) Session ID: S139
2) Task ID: AAI-1061
3) Linear issue: AAI-1061
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1061/add-deterministic-drawings-viewer-capability-regression-contract
5) Current status: Accepted
6) Files changed (absolute paths): task/handoff/evidence; dedicated Playwright config and viewer contract; viewer page; PDF proxy plus route unit test; PDF.js Express viewer plus cleanup unit test; recurring-failure registry and test; S139 orchestration rows
7) Commands run and outcome (pass/fail counts): Playwright 3/3 pass in 2.3m; Jest 2 suites/4 tests pass; targeted ESLint pass; registry tests 7/7 pass; strict registry audit pass; git diff check pass
8) Evidence artifacts (screenshot/video/report/log paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-13-drawings-capability-contract/REPORT.md` and adjacent desktop/tablet/mobile screenshots and error summaries
9) Top 3 findings (frontend-visible issues first): mobile Download/Close were offscreen; PDF HEAD fallback intermittently returned 500 and left Loading drawing; SPA navigation and reparented vendor cleanup made adjacent navigation nondeterministic
10) Recommended next action (one line): Keep the deterministic contract in the drawings regression lane; address the unrelated recursive build-output debt separately.
11) Handoff file path: /Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S139-drawings-viewer-capability-contract.md
12) Migration ledger evidence: Not applicable; no migration files are in scope.

## Linear Updates

- Kickoff: posted with scope, exclusions, stop condition, and handoff path.
- Milestone: posted after deterministic contract, responsive repair, and registry promotion.
- Review: generated from this completed handoff after final gates.
- Publish: implementation commit `1d59cd7653930e02df1223fe933940fff724e92f` reached `origin/main` and matched local HEAD after fetch.

## Known Pitfalls

- Preserve S138 markup-overlay/object-editing ownership; S139 adopts only the PDF viewer lifecycle and proxy root-cause guards required by this contract.
- Do not stage or commit unrelated dirty work.
- Do not treat control visibility as proof when a state transition is observable.

## Failure Accounting

- Cause: the PDF vendor sends `HEAD`, but the committed proxy only exposed guarded `GET`; the fallback path intermittently parsed an empty response and returned 500.
- Detection gap: prior checks asserted route/control presence, not the vendor request sequence or usable rendered geometry.
- Prevention: explicit `HEAD`, route unit guard, fail-loud browser network monitoring, and the active recurring-failure registry command.
- Supplemental build cause: default heap exhaustion and recursive generated-output growth under the high-memory retry.
- Supplemental build prevention: track build output growth and isolate output tracing; this is unrelated repository infrastructure debt, not a viewer source failure.
