# Handoff: Submittal Spec Timeout Hardening

Status: In Progress
Session: S94
Date: 2026-06-25
Owner: Codex
Linear Issue: AAI-421
Linear URL: https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Task File: /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-25-submittal-spec-timeout-hardening.md

## Scope

Fix the specification retrieval timeout affecting AI submittal review on project
`25125`, using the synthetic Goodwill proof path and exact live route as the
verification target.

## Owned Paths

- `docs/ops/tasks/2026-06-25-submittal-spec-timeout-hardening.md`
- `docs/ops/handoffs/2026-06-25-S94-submittal-spec-timeout-hardening.md`
- `frontend/src/lib/ai/tools/document-intelligence.ts`
- `frontend/src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts`

## Command Evidence

| Command | Purpose | Result |
| ------- | ------- | ------ |
| `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts` | Guardrail test for stored spec-source matching | PASS |
| `cd frontend && npx eslint --quiet src/lib/ai/tools/document-intelligence.ts src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts` | Targeted lint on changed files | PASS |
| `set -a; source .env; source frontend/.env.local; set +a; node scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | Regression proof for synthetic submittal + drawing readiness | PASS |
| `cd frontend && node --require tsx/cjs <<'EOF' ... createSubmittalAIReviewService('6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6').runReview(25125, '7dfbccac-6ccf-4d69-8129-7de7918c5248') ... EOF` | Exact synthetic rerun through canonical review service | PASS |
| `node --input-type=module <<'EOF' ... select submittals.ai_review_result ... EOF` | Persisted result read-back | PASS |

## Artifacts

| Path | Description |
| ---- | ----------- |
| `frontend/src/lib/ai/tools/document-intelligence.ts` | Shared spec-source resolution now uses canonical spec tables first, then stored spec-like project documents, and returns a bounded note instead of vector-search timeout. |
| `frontend/src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts` | Regression guardrail for spec-like source selection. |

## Changed Files

- `docs/ops/tasks/2026-06-25-submittal-spec-timeout-hardening.md`
- `docs/ops/handoffs/2026-06-25-S94-submittal-spec-timeout-hardening.md`
- `frontend/src/lib/ai/tools/document-intelligence.ts`
- `frontend/src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts`

## Risks / Blockers

- Browser-level verification of the exact synthetic detail page is still
  outstanding in this session.

## Next Step

Run a fresh browser verification on
`/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248` and capture an updated
artifact set that shows the refreshed `ready` spec layer now that the canonical
service path no longer times out.
