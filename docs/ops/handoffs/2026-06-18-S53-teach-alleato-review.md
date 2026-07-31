# Handoff: 2026-06-18 — Teach Alleato Review Integration

## Intake Block

1) Session ID: S53
2) Task ID: AAI-540
3) Linear issue: AAI-540
4) Linear URL: https://linear.app/megankharrison/issue/AAI-540/surface-teach-alleato-submissions-in-learning-review
5) Current status: Accepted
6) Files changed (absolute paths):
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(admin)/ai-learning-promotions/promotions-client.tsx`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/learning-promotion-view-model.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/__tests__/learning-promotion-view-model.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ai-plan/TASKS-AI.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-RAG-ARCHITECTURE.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-18-S53-teach-alleato-review.md`
7) Commands run and outcome (pass/fail counts):
   - PASS: `npm run test:unit -- --runTestsByPath 'src/lib/ai/__tests__/learning-promotion-view-model.test.ts' --runInBand`
   - PASS with existing warnings only: `npx eslint 'src/app/(admin)/ai-learning-promotions/promotions-client.tsx' 'src/lib/ai/learning-promotion-view-model.ts' 'src/lib/ai/__tests__/learning-promotion-view-model.test.ts'`
   - PASS: `git diff --check -- 'frontend/src/app/(admin)/ai-learning-promotions/promotions-client.tsx' 'frontend/src/lib/ai/learning-promotion-view-model.ts' 'frontend/src/lib/ai/__tests__/learning-promotion-view-model.test.ts' docs/ai-plan/TASKS-AI.md docs/architecture/AI-RAG-ARCHITECTURE.md docs/ops/handoffs/2026-06-18-S53-teach-alleato-review.md`
   - PASS: `npm run linear:codex:check -- docs/ops/handoffs/2026-06-18-S53-teach-alleato-review.md`
   - PASS: integrated browser verification confirmed the submitted S52 candidate in the Teach Alleato filter.
8) Evidence artifacts (screenshot/video/report/log paths):
   - `tests/agent-browser-runs/2026-06-18-teach-alleato-integrated/02-teach-filter.png`
   - `tests/agent-browser-runs/2026-06-18-teach-alleato-integrated/03-teach-expanded.png`
9) Top 3 findings (frontend-visible issues first):
   - `/ai-learning-promotions` now has a Teach Alleato filter that uses the shared parser and `kind=teach` API support to recognize Teach candidates.
   - Expanded Teach candidates show source user/route, proposed destination, workflow category, example input/output, source/evidence link, scope/risk, why-it-matters, and suggested reviewer.
   - Existing reviewer actions remain in place: candidates can be approved/rejected, and apply remains governed by existing promotion-type writers.
10) Recommended next action (one line): Add the Skill Library approval writer so approved Teach candidates can become reusable skills.
11) Handoff file path: `docs/ops/handoffs/2026-06-18-S53-teach-alleato-review.md`
12) Migration ledger evidence: Not applicable; no migration or schema change.

## Linear Updates

- Kickoff comment: Not posted by this worker.
- Milestone comments: Not posted by this worker.
- Completion/blocker comment: Posted acceptance summary to Linear comment `3f8dc033-b0b2-42ff-a423-8d9ba05060f5`.

Suggested Linear comment body:

```text
S53 review/view-model slice is ready for review.

Scope:
- Added Teach Alleato parsing to frontend/src/lib/ai/learning-promotion-view-model.ts.
- Added a Teach Alleato filter/details path to /ai-learning-promotions.
- Added focused Jest coverage for Teach payload parsing and filter routing.
- Updated Phase 4 TASKS-AI review-integration checklist and AI-RAG architecture note.

Verification:
- PASS: npm run test:unit -- --runTestsByPath 'src/lib/ai/__tests__/learning-promotion-view-model.test.ts' --runInBand
- PASS with existing raw-table warnings only: npx eslint touched TS files
- PASS: git diff --check for touched files

Risk:
- Teach candidates remain reviewable workflow-rule candidates until the Skill Library schema and destination writer exist.
- Integrated browser verification passed with a real Teach intake submission.
```

## Current Status

Accepted. Teach Alleato submissions are recognized from payload/source markers (`action='teach_alleato_submission'`, Teach source surfaces, `/ai-assistant/teach`, or a submission id) and surfaced through the existing learning promotions admin console.

The requested ownership path named `frontend/src/app/(admin)/admin/ai-learning-promotions/**`, but the actual route in this repo is `frontend/src/app/(admin)/ai-learning-promotions/**`; changes were made there and the user-facing route is `/ai-learning-promotions`.

## Exact Next Step

Build the Skill Library schema and approval writer so accepted Teach candidates have a durable destination.

## Known Pitfalls

- This slice deliberately did not touch `frontend/src/app/(main)/ai-assistant/teach/**`, `frontend/src/app/api/ai-assistant/teach/**`, or the Teach intake service files; those appeared as concurrent edits.
- The Teach filter now uses `GET /api/admin/ai-learning-promotions?kind=teach`; keep future promotion-kind filters server-backed instead of adding client-only caps.
- Existing table primitive lint warnings remain in `promotions-client.tsx`; this slice did not refactor the table shell.
- Unrelated dirt existed before/during this task in `docs/ops/orchestration/session-board.md`, `scripts/jobplanner/import-prime-contract.mjs`, and concurrent Teach intake files. Do not revert them.

## Resume Commands

```bash
rg -n "teach_alleato_submission|Teach Alleato|isTeachAlleatoPromotion|workflowCategory|exampleInput|sourceEvidenceLink" frontend/src/lib/ai frontend/src/app/\(admin\)/ai-learning-promotions docs/ai-plan/TASKS-AI.md docs/architecture/AI-RAG-ARCHITECTURE.md
cd frontend && npm run test:unit -- --runTestsByPath 'src/lib/ai/__tests__/learning-promotion-view-model.test.ts' --runInBand
```

## Evidence

- Unit guardrail: `learning-promotion-view-model.test.ts` now covers Teach field parsing and Teach tab routing.
- Review UI behavior: the existing expanded row, not a new helper panel or wrapper card, displays source user/route, destination, risk/scope, workflow category, examples, evidence link, why-it-matters, and suggested reviewer.
- Failure-loud behavior: missing Teach payload fields render as explicit "No ... recorded" values instead of blank/silent omission.
- Noise gate: primary user is the admin reviewer; primary job is deciding whether submitted field knowledge should become durable assistant behavior; Tier 1 is submitted learning, source, proposed destination, and risk; Tier 2 is workflow category and examples; Tier 3 is raw payload. No nested cards, duplicate CTAs, helper panel, or decorative wrapper was added.

## Risks / Blockers

- Related remaining risk: approved workflow-rule Teach candidates do not yet write to a first-class Skill Library table.
- Related remaining risk: submitter status is still unchecked in Phase 4 because no notification/status-back system was confirmed in this slice.
- Related follow-up: if Teach candidates use a different payload shape than the parser's accepted aliases, extend `readLearning()` aliases rather than adding page-local parsing.
