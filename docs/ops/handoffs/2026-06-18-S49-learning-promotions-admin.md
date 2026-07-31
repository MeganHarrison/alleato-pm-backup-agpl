# Handoff: 2026-06-18 — Learning Promotions Admin Review Queue

## Intake Block

1) Session ID: S49
2) Task ID: AAI-527
3) Linear issue: AAI-527
4) Linear URL: https://linear.app/megankharrison/issue/AAI-527/add-assistant-memory-trace-and-review-admin-workflow
5) Current status: Pending Review
6) Files changed (absolute paths):
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(admin)/ai-learning-promotions/promotions-client.tsx`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/ai-learning-promotions/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/learning-promotion-view-model.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/__tests__/learning-promotion-view-model.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-18-S49-learning-promotions-admin.md`
7) Commands run and outcome (pass/fail counts):
   - PASS: `npm run test:unit -- --runTestsByPath 'src/lib/ai/__tests__/learning-promotion-view-model.test.ts' --runInBand`
   - PASS with warnings only: `npx eslint 'src/app/(admin)/ai-learning-promotions/promotions-client.tsx' 'src/lib/ai/learning-promotion-view-model.ts' 'src/lib/ai/__tests__/learning-promotion-view-model.test.ts' 'src/app/api/admin/ai-learning-promotions/route.ts'`
   - PASS: `git diff --check -- 'frontend/src/app/(admin)/ai-learning-promotions' 'frontend/src/app/api/admin/ai-learning-promotions/route.ts' 'frontend/src/components/ai-learning' docs/ops/handoffs/2026-06-18-S49-learning-promotions-admin.md`
   - FAIL unrelated repo debt: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false --incremental false`
   - FAIL command shape only: `npm run lint -- --file ...` because this ESLint flat config does not support `--file`
8) Evidence artifacts (screenshot/video/report/log paths): Command output in this handoff; no browser artifact captured for this read-only UI/API slice.
9) Top 3 findings (frontend-visible issues first):
   - `/admin/ai-learning-promotions` now has a Memory promotion-kind tab and count copy that filters `review_memory` candidates.
   - Expanded memory candidates now show correction text, before-memory snapshot, source surface/route, memory type/visibility, project scope, and risk level.
   - Quick actions are intentionally blocked for `workflow_rule + review_memory`; the existing memory apply writer only creates new memory for `user_preference`/`project_lesson` and does not safely edit, expire, deactivate, or convert the challenged memory with audit.
10) Recommended next action (one line): Review S49 UI/API slice, then add audited memory edit/deactivate/expire service writers before enabling quick actions.
11) Handoff file path: `docs/ops/handoffs/2026-06-18-S49-learning-promotions-admin.md`
12) Migration ledger evidence: Required only if this worker touches `supabase/migrations/*.sql`

## Linear Updates

- Kickoff comment: https://linear.app/megankharrison/issue/AAI-527#comment-afff4ac3-be14-4265-a998-abf85da966fc
- Milestone comments: Pending
- Completion/blocker comment: https://linear.app/megankharrison/issue/AAI-527#comment-98c4b23a-286e-416d-bec7-7619c14a1ace

## Current Status

Implemented the smallest useful Phase 3 memory candidate review slice. The queue is read-only for memory corrections because no safe quick-action writer exists for `workflow_rule` review-memory candidates.

## Exact Next Step

Leader/reviewer should inspect the diff and decide whether S49 is accepted as a read-only memory review slice or should wait for a separate service-writer task.

## Known Pitfalls

- Follow the Alleato product noise gate: no wrapper cards, no decorative helper panels, no duplicate CTAs.
- Do not apply promotion actions silently; failed apply operations must keep the candidate reviewable and show real error details.
- Do not touch `scripts/jobplanner/import-prime-contract.mjs`; it is unrelated existing dirt.

## Resume Commands

```bash
rg -n "ai-learning-promotions|ai_learning_promotions|review_memory" frontend/src docs/ai-plan/TASKS-AI.md
```

## Evidence

- Unit guardrail: `learning-promotion-view-model.test.ts` covers parsing correction fields, routing `review_memory` workflow candidates into the Memory tab, and excluding non-memory workflow rules from Memory.
- API behavior: `GET /api/admin/ai-learning-promotions?kind=memory` filters candidates server-side after fetching the status set and attaches source feedback event rows from each promotion's source-event ID list; failures to load source events throw `UPSTREAM_FAILURE` with the real Supabase error.
- UI behavior: Memory detail is shown inline in the existing expanded table row, with no new wrapper card, helper panel, or duplicate CTA beyond the pre-existing review controls.
- ESLint warnings are pre-existing table primitive warnings in `promotions-client.tsx` (`design-system/no-raw-table-primitives`) and are unrelated to the memory slice.
- Leader integration adjustment: moved the shared promotion parser from `components/ai-learning` to `lib/ai` because it is used by both the server API route and client UI.
- Full typecheck unrelated failures:
  - `.next/types/app/api/projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/pdf/route.ts`: route exports `fetchPaymentApplicationPdfData`, which Next route typing rejects.
  - `src/app/(main)/[projectId]/intelligence/page.tsx`: `SupabaseClient` to `UntypedSupabaseReader` cast mismatch.
  - `src/lib/executive/brandon-daily-update.ts`: same `UntypedSupabaseReader` cast mismatch.
  - `src/lib/progress-reports/ai-generate.ts`: same `UntypedSupabaseReader` cast mismatch.

## Suggested TASKS-AI Checklist Updates

- Mark Phase 3 Admin UI `/admin/ai-learning-promotions` extension as partially complete for the Memory tab/filter and source-event details.
- Mark "Show original correction text", "Show before snapshot", "Show project scope", and "Show risk level" as complete for memory review candidates.
- Keep quick actions unchecked until audited writers exist for edit/deactivate/expire/convert/reject on the existing challenged memory.

## Noise Gate

- Primary user: admin reviewer processing assistant learning candidates.
- Primary job: identify whether a wrong-memory correction needs later mutation without changing assistant behavior prematurely.
- Tier 1 content added: correction text, before snapshot, source route/surface, memory scope, project, risk.
- Hidden/deferred content: quick actions and history timeline remain deferred until safe writer/audit paths exist.
- Removal/simplification: no helper panel, wrapper card, decorative badge set, or duplicate apply path added.
- Failure-loud behavior: source-event load failures return a guarded API error instead of silently omitting correction context.

## Risks / Blockers

- Related blocker: no safe service path currently handles `review_memory` quick actions against the original `ai_memories` row. Existing `applyMemoryPromotion` cannot be reused because it only accepts `user_preference`/`project_lesson` and writes a new memory.
- Related remaining risk: no browser artifact was captured; this was kept to targeted unit/lint/type checks due the requested smallest read-only slice.
- Unrelated repo debt: full frontend typecheck currently fails in payment PDF route typing and Supabase reader casts outside S49 owned paths.
