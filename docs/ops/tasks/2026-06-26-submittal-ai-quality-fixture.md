# Task: Submittal AI Quality Fixture

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S95-submittal-ai-quality-fixture.md

## Objective

Upgrade the synthetic Goodwill storefront submittal proof so the AI review has
real product data and section 08-43-13 requirements to compare, instead of only
proving that the workflow can run.

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
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

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
| Browser/user-flow | `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-visible/ai-review-tab.png` | PASS | Existing AI Review tab renders the persisted result on the exact route. |
| Fixture syntax | `node --check scripts/ops/ensure-synthetic-submittal-quality-fixture.mjs && node --check scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | PASS | Both fixture and verifier parse cleanly. |
| Fixture apply | `set -a; source .env; source frontend/.env.local; set +a; node scripts/ops/ensure-synthetic-submittal-quality-fixture.mjs` | PASS | Upserted synthetic product data document, synthetic 08-43-13 specification, and submittal link. |
| AI review rerun | `cd frontend && node --require tsx/cjs <<'EOF' ... runReview(25125, '7dfbccac-6ccf-4d69-8129-7de7918c5248') ... EOF` | PASS | Returned `status: ready`, `submittalDocumentCount: 2`, `specSourceCount: 1`, and a high-severity `fail` for `Submitted finish conflicts with specification`. |
| Quality verifier | `set -a; source .env; source frontend/.env.local; set +a; node scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | PASS | Verifier now fails unless the stored result includes the expected finish conflict and source coverage. |
| Browser/user-flow | `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-visible/ai-review-quality-fixture-conflict.png` | PASS | Exact route shows `Conflicts (1)` and the finish mismatch finding in the AI Review tab. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-ai-quality-fixture.md` - working done gate.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S95-submittal-ai-quality-fixture.md` - handoff evidence.
- `/Users/meganharrison/Documents/alleato-pm/scripts/ops/ensure-synthetic-submittal-quality-fixture.mjs` - idempotent synthetic fixture setup.
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` - proof now checks review quality signal.

## Risks / Gaps

- The fixture is intentionally synthetic and should not be confused with a real
  approval workflow. It is marked in metadata and uses synthetic document/spec
  titles.
- Unrelated checkout dirt exists outside this task: `frontend/src/app/(admin)/admin/page.tsx`,
  `frontend/src/lib/ai/change-request-field-guide.ts`,
  `frontend/src/lib/ai/__tests__/change-request-field-guide.test.ts`,
  `frontend/src/app/api/admin/url-resources/`, and
  `frontend/src/components/admin/url-resource-ingestion-panel.tsx`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
