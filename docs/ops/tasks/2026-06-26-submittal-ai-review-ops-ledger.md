# Task: Submittal AI Review Ops Ledger

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Record submittal AI review attempts in the canonical AI Ops ledger so source
coverage, synthesis, persistence, and failure states are inspectable outside
the submittal detail UI.

## Scope Checklist

- [x] Existing AI Ops ledger primitives reviewed before adding new storage.
- [x] Existing submittal AI review run/check persistence reviewed.
- [x] Source-of-truth owner chosen: `submittal_ai_review_runs` for review state,
  `ai_work_runs` for cross-workflow operations observability.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Add shared submittal AI review ledger helper using `createAiOpsLedger`.
- [x] Start an AI Ops run when review execution starts.
- [x] Record context assembly, synthesis, and artifact persistence steps.
- [x] Record terminal success, partial/not-ready, and failure states.
- [x] Keep ledger writes source-backed and avoid new one-off tables.

## Regression Guardrails

- [x] Unit test covers submittal review ledger mapping.
- [x] Targeted lint/type checks pass.
- [x] Route guardrails remain clean for touched route files, if any.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Unit test | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/ai-review/__tests__/ops-ledger.test.ts` | Pass | Covers start, completion/source coverage/artifact, and failure mapping. |
| Focused lint | `cd frontend && npx eslint --quiet src/lib/submittals/ai-review/ops-ledger.ts src/lib/submittals/ai-review/__tests__/ops-ledger.test.ts src/lib/submittals/ai-review/review-run-service.ts` | Pass | Touched service/helper/test lint clean. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt. |
| Route conflicts | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Route guardrails | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | Pass | No changed API routes to validate. |
| Import smoke | `cd frontend && node --require tsx/cjs -e "require('./src/lib/submittals/ai-review/ops-ledger.ts'); require('./src/lib/submittals/ai-review/review-run-service.ts')"` | Pass | Touched modules import successfully. |

## Risks / Gaps

- Browser proof is not required for this backend observability slice, but the
  visible AI Review workflow still needs a separate authenticated browser pass.
- Full project-wide typecheck/build was not run in the main thread; targeted
  checks covered the touched modules.
