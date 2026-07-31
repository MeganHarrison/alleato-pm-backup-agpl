# Handoff: Submittal AI Quality Fixture

Status: In Progress
Session: S95
Date: 2026-06-26
Owner: Codex
Linear Issue: AAI-421
Linear URL: https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Task File: /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-ai-quality-fixture.md

## Scope

Make the synthetic Goodwill storefront AI-review proof meaningful enough to
exercise pass/fail review quality, not only the workflow plumbing.

## Owned Paths

- `docs/ops/tasks/2026-06-26-submittal-ai-quality-fixture.md`
- `docs/ops/handoffs/2026-06-26-S95-submittal-ai-quality-fixture.md`
- `scripts/ops/ensure-synthetic-submittal-quality-fixture.mjs`
- `scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs`

## Command Evidence

| Command | Purpose | Result |
| ------- | ------- | ------ |
| `agent-browser open http://localhost:3001/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248` then click `AI Review` | Prove the existing implemented surface is visible | PASS |
| `node --check scripts/ops/ensure-synthetic-submittal-quality-fixture.mjs && node --check scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | Static syntax check for fixture/verifier scripts | PASS |
| `set -a; source .env; source frontend/.env.local; set +a; node scripts/ops/ensure-synthetic-submittal-quality-fixture.mjs` | Apply richer synthetic product/spec fixture | PASS |
| `cd frontend && node --require tsx/cjs <<'EOF' ... runReview(25125, '7dfbccac-6ccf-4d69-8129-7de7918c5248') ... EOF` | Rerun exact AI review after fixture enrichment | PASS |
| `set -a; source .env; source frontend/.env.local; set +a; node scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | Verify stored result includes quality signal | PASS |

## Artifacts

| Path | Description |
| ---- | ----------- |
| `frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-visible/ai-review-tab.png` | Full-page screenshot of the visible AI Review tab. |
| `frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-visible/ai-review-tab-annotated.png` | Annotated screenshot of the visible AI Review tab. |
| `frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-visible/ai-review-quality-fixture-conflict.png` | Full-page screenshot showing `Conflicts (1)` for the synthetic finish mismatch. |

## Changed Files

- `docs/ops/tasks/2026-06-26-submittal-ai-quality-fixture.md`
- `docs/ops/handoffs/2026-06-26-S95-submittal-ai-quality-fixture.md`
- `scripts/ops/ensure-synthetic-submittal-quality-fixture.mjs`
- `scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs`

## Risks / Blockers

- The fixture is synthetic and marked as such in metadata/titles. It proves the
  AI review can surface pass/fail source-backed findings, not that the real
  Goodwill storefront package is approved or rejected.
- Unrelated dirty files exist in admin and change-request work areas; they were
  left untouched.

## Next Step

Use the exact route
`http://localhost:3001/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248`,
click `AI Review`, and inspect `Conflicts (1)`. The stored result now contains a
high-severity failing finding: `Submitted finish conflicts with specification`.
