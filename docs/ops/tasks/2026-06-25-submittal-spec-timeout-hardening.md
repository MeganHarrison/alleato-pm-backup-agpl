# Task: Submittal Spec Timeout Hardening

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-25-S94-submittal-spec-timeout-hardening.md

## Objective

Fix the `spec_context` timeout blocking AI submittal review on project `25125`
so the workflow can return specification-backed context or a specific bounded
fallback instead of failing the entire spec layer with a statement timeout.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states, if applicable.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Shared spec-source hardening | `frontend/src/lib/ai/tools/document-intelligence.ts` | PASS | Replaced RPC-first `onedrive_document` lookup with shared project-scoped spec-source resolution: canonical spec tables first, then stored spec-like RAG docs, with a loud bounded no-source note instead of timeout. |
| Guardrail test | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts` | PASS | Confirms spec-like documents are selected and unrelated project docs are excluded. |
| Targeted lint | `cd frontend && npx eslint --quiet src/lib/ai/tools/document-intelligence.ts src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts` | PASS | No lint errors on changed files. |
| Exact synthetic rerun | `cd frontend && node --require tsx/cjs <<'EOF' ... createSubmittalAIReviewService('6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6').runReview(25125, '7dfbccac-6ccf-4d69-8129-7de7918c5248') ... EOF` | PASS | Returned `status: ready`; `spec_context` layer became `ready` with `availableCount: 4`; `checks: 5`. |
| Storage read-back | `node --input-type=module <<'EOF' ... select submittals.ai_review_result ... EOF` | PASS | Persisted `ai_review_result.status: ready`; `spec_context.state: ready`; `availableCount: 4`. |
| Synthetic proof regression | `set -a; source .env; source frontend/.env.local; set +a; node scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | PASS | Existing synthetic submittal + linked drawing + OCR/page intelligence proof remains valid after the hardening change. |
| Browser verification | `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/ai-review-tab.png` | PASS | Exact route loaded authenticated at `http://127.0.0.1:3001/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248`; AI Review tab showed persisted source-backed findings and reviewer disposition controls, including `Submitted finish conflicts with specification`. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-25-submittal-spec-timeout-hardening.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-25-S94-submittal-spec-timeout-hardening.md`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/document-intelligence.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts`

## Risks / Gaps

- Browser proof required clearing stale `.next` cache and using `127.0.0.1:3001`
  because the existing saved browser auth was stale for `localhost:3001`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
