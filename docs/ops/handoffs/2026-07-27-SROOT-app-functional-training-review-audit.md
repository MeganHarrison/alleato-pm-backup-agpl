# Handoff: App Functional and Training Review Audit

Status: Complete
Owner: Codex SROOT-AUDIT
Task: `docs/ops/tasks/2026-07-27-app-functional-training-review-audit.md`
Linear: Connector unavailable in this session; local high-risk task is canonical.

## Current Status

GitHub was fetched and the clean audit workspace was created from
`origin/main` at `9b33206ad28e6fb6a718195007920380fe87eda4`.
Remote main advanced through non-overlapping training-hub work during the
audit. The exact task-owned files were published on top of that current remote
state at `5643d413bfe5c36ec46feb6d82d1eef1494e9993`. The dirty canonical
checkout was not modified, rebased, stashed, or reset.

The canonical project portfolio and representative search, scope, view, table
settings, and project-form controls pass. Four localized failures were fixed:
project-role trigger RLS, repeated bootstrap identity, missing creator access,
and split admin learning-review access/feedback handling.

## Acceptance Contract

- Prove authenticated primary project-management flows and representative
  filters/buttons on the latest revision.
- Prove automatic training discovery/sync ownership and its schedule.
- Prove admin review, approval, rejection/feedback, and guarded application of
  learning candidates.
- Fix only localized Critical/High failures, with regression guardrails.
- Obtain independent review and release evidence for any high-risk code change.

## Owned Scope

- `feature-audit-output/app-functional-training-review/**`
- `docs/ops/tasks/2026-07-27-app-functional-training-review-audit.md`
- `docs/ops/handoffs/2026-07-27-SROOT-app-functional-training-review-audit.md`
- The app, agent, test, and migration paths claimed by isolated workspace
  `SROOT-AUDIT`; product edits remain prohibited until runtime localization.

## Evidence

- Workspace base SHA: `9b33206ad28e6fb6a718195007920380fe87eda4`
- Published `origin/main` SHA:
  `5643d413bfe5c36ec46feb6d82d1eef1494e9993`
- Publication receipt:
  `/home/friday/.codex/session-handoffs/sroot-audit-app-training-review-audit-20260727-1785196734652/manifest.json`
- Isolated workspace:
  `/home/friday/.codex/isolated-workspaces/sroot-audit-app-training-review-audit-20260727-64b566`
- Browser audit report:
  `feature-audit-output/app-functional-training-review/report.md`
- Admin learning queue:
  `feature-audit-output/app-functional-training-review/screenshots/admin-learning-review-queue.png`
- Required corrective feedback:
  `feature-audit-output/app-functional-training-review/screenshots/admin-learning-rejection-feedback-required.png`
- Focused tests: 59/59 tests across 11 suites passed, including reviewer
  follow-up access, audit-outcome, and warning-toast coverage.
- Independent re-review: both High findings resolved; no new blocker.
- Changed-quality gate, route-conflict gate, trigger verifier, and remote
  migration-ledger verifier passed.
- Full typecheck remains red with broad pre-existing debt; task changes pass the
  no-new-debt gates.

### Financial workflow

Exact command:

```bash
PORT=4317 PLAYWRIGHT_BASE_URL=http://localhost:4317 BASE_URL=http://localhost:4317 \
AUTH_SETUP_REQUIRE_EXISTING_USER=true AUTH_SETUP_PRESERVE_EXISTING_USER=true \
pnpm --dir frontend exec playwright test \
tests/e2e/financial-workflow/full-financial-workflow.spec.ts \
--config=config/playwright/playwright.config.ts --project=chromium --workers=1
```

Result: creator access passes. Prime-contract submission repeatedly triggers a
Next.js Fast Refresh full reload and `page.waitForURL: net::ERR_NETWORK_CHANGED`;
9 downstream tests do not run. A stable-source run proved no `frontend/src`
mtime changed during the run. Missing Velt credentials also produce an explicit
500, but causality is not established. Artifacts:
`frontend/tests/playwright-report/index.html` and
`frontend/tests/test-results/results.json`.

## Migration Ledger Evidence

Applied and verified:

- Migration:
  `supabase/migrations/20260728001500_harden_default_project_roles_trigger.sql`
- Local/remote ledger version: `20260728001500`
- Verifier:
  `scripts/verify/verify_project_bootstrap_role_trigger.mjs`

## Known Pitfalls

- Do not touch unrelated canonical-checkout scheduling or `training-source` files.
- Do not mistake proposal creation for applied learning.
- Do not create a second review queue; `ai_learning_promotions` is canonical.
- Do not claim a page is working from HTTP 200 alone.
- Do not treat the 9 skipped financial tests as passes.
- `DELETE /api/projects/:projectId` archives rather than physically deletes.
  Audit projects 1153 and 1158 were archived and verified recoverable.

## Remaining Owners

- Frontend runtime/infrastructure: localize the unsolicited full reload at
  prime-contract submission under the Playwright dev server; then rerun the
  remaining financial chain.
- Collaboration configuration: provide Velt credentials or intentionally
  disable its local API calls so the explicit 500 cannot obscure test failures.
- Training automation: add existing-resource revalidation to the weekly finder
  and make the weekday docs-freshness schedule create review candidates.
- Database architecture: classify the 14 live MAIN tables currently missing
  from `docs/architecture/tables.yaml` (including training resource/role/topic
  tables), then rerun the live inventory generator; it fails before writing
  artifacts while that metadata drift remains.
- AI learning architecture: normalize remaining producer payloads and design
  transactional/idempotent apply writers in a separate high-risk slice.
