# Task: T11 — Final QA pass for the Training Module (ALL-25)

Status: Done
Owner: Session S229; authenticated-proof reconciliation by S236
Created: 2026-07-26
Task ID: ALL-25
Linear Issue: ALL-25 (https://linear.app/alleato-group/issue/ALL-25)
Related Handoff: `docs/ops/handoffs/2026-07-26-S229-training-module-qa.md`

## Objective

Final QA pass now that T1–T10 are all Done: `npm run quality`, unit/integration
tests, `check:routes`, backend pytest, and a live check of `/training` in
production (per the ticket's updated 2026-07-26 process note, this repo
ships via direct-to-main isolated-workspace publishes, not a combined PR —
there is no separate preview to gate on, production IS the check).

Delivery lane: Standard

Verification contract: Optional

Note: initially drafted as High-risk, corrected on publish. This task is a
*verification pass* over already-shipped work (T1-T10), not itself a
schema/auth/money/provider/deployment change — AGENTS.md's High-risk
category is for changes in those categories, not for read-only QA/checking
activity. The individual tickets that made the actual changes (T3's
migration, etc.) carried their own correct High-risk classification and
independent review at the time they shipped.

## Checks Run

| Check | Command | Result |
| --- | --- | --- |
| Frontend quality | `npm run quality` (typecheck + lint), delegated to sub-agent | PASS — zero new errors in any training path (`app/(main)/training`, `features/training`, `lib/training`, `content/training-guides`). 210 pre-existing unrelated errors elsewhere, untouched. |
| Unit tests | `npx jest src/features/training src/lib/training src/content/training-guides "src/app/(main)/training"` | PASS — 13 suites, 69 tests |
| Route conflicts | `npm run check:routes` | PASS — no dynamic route naming conflicts |
| Backend pytest | `pytest tests/test_training_resource_finder.py tests/test_training_resource_finder_weekly.py -v` | PASS — 20 tests |
| Production deployment | Vercel `get_deployment` on the latest production deployment (commit `b655e787a`, "Record weekly training cron closeout") | READY, live at `projects.alleatogroup.com` |
| Production route health | `curl -sL --max-redirs 0 https://projects.alleatogroup.com/training` | `HTTP 307` -> `/auth/login?callbackUrl=%2Ftraining` — confirms the route exists, is correctly auth-gated, and is not a 404/500 |
| **Authenticated visual proof** | Production desktop/mobile browser pass | **PASS** — library, guide, admin-review, queue-isolation, responsive-layout, and clean-console evidence is stored under `docs/ops/evidence/2026-07-26-training-module-completion/`. |

## Failure-Loudly Contract

- Original cause: S229's sandbox had blank local credentials and could not
  create the required authenticated browser artifact.
- Detection gap: none. The completion gate correctly kept the QA task open
  instead of treating route health and automated tests as visual proof.
- Recovery: S235 reused a persisted app-admin production session and captured
  exact-route desktop/mobile screenshots, DOM checks, queue/learner isolation,
  clean-console evidence, and the independent-review result under
  `docs/ops/evidence/2026-07-26-training-module-completion/`.
- Prevention: an authenticated persisted browser profile is an accepted proof
  source when local test credentials are unavailable; the proof must still bind
  the exact production route, responsive dimensions, visible content, and
  console/page-error checks.

## Remaining Risk

None for T1–T11. T12–T15 are separately tracked expansion issues and are not
implied complete by this T11 QA reconciliation.
