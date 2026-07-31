# Verification Summary

Verified on 2026-07-27/28 from isolated workspace
`SROOT-FOLLOWUPS`.

## Financial workflow

- Command: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4322 pnpm exec playwright test tests/e2e/financial-workflow/full-financial-workflow.spec.ts --config=config/playwright/playwright.config.ts --project=chromium --workers=1`
- Result: 11 passed in 1.8 minutes.
- Browser evidence:
  `frontend/tests/playwright-report/index.html` and the 11 videos under
  `frontend/tests/test-results/`.
- Cleanup: generated project 1176 was archived by the test.

## Training review and feedback loop

- Frontend Jest: 5 suites, 30 tests passed.
- Backend pytest: 29 tests passed.
- Live Supabase contract: passed service/admin authorization, deduplication,
  second-observation promotion, published-source immutability, keep/archive
  feedback bridging into canonical finder memory, and rollback.
- Migration ledgers:
  - `20260728003500`: Local and Remote.
  - `20260728013000`: Local and Remote.
  - `20260728021000`: Local and Remote.
  - `20260728022000`: Local and Remote.
- Browser/database proof:
  - `training-review-pending.png`
  - `training-review-feedback-recorded.png`
  - `training-review-database-readback.json`
  - `training-review-resource-feedback-before-archive.png`
  - `training-review-resource-feedback-after-archive.png`
  - `training-review-resource-feedback-readback.json`

## Documentation freshness

- Agent `npm run typecheck`: passed.
- Eve `npm run info`: 0 errors; one expected warning that direct runner scripts
  are outside Eve agent discovery.
- GitHub workflow YAML parsed successfully.
- GitHub repository configuration readback confirmed secret
  `LINEAR_API_KEY` and variable
  `EVE_DOCS_MAINTAINER_LINEAR_ISSUE_ID`.
- Two local delivery runs posted a fail-loud report to Linear issue ALL-30 and
  read the exact comment back (`35d7bf…`, `842a5e…`).
- Exact 62-file publication completed at `origin/main` commit
  `225d424dcdf6e044348cc87b90465aa59cd6d05d`.
- Production workflow run
  `https://github.com/The-Alleato-Group/project-management/actions/runs/30321444676`
  scanned that commit, found two blocked items, posted Linear comment
  `f07ac59f-8075-4732-8a4b-1b96a25df014`, read it back exactly, and then exited
  non-zero as the fail-loud contract requires.
- A second published-SHA run (`30321473521`) reproduced the two actionable
  findings and read back Linear comment
  `02578cb0-9368-4fb5-b589-451c5c07a5de`.
- Remediation verification used the Supabase HTTPS Management API for both
  databases: complete stats/counts/columns snapshots loaded in six total
  queries and all 520 documented tables generated without partial results.
- `node --test scripts/verify/__tests__/app-db-connection.test.mjs`: 4/4
  passed, including the batched/fail-on-incomplete inventory guardrail.
- Remediation was published at
  `ab2b8696ea0c1c349168180b89e233665a151f22`.
- Production workflow run
  `https://github.com/The-Alleato-Group/project-management/actions/runs/30322204176`
  completed successfully in 2m31s on that SHA. It posted and read back Linear
  comment `02d7a595-3f2f-41e4-95d6-633456767d50`; the only remaining finding
  was a non-blocking two-line TABLE-LIST live-stat/timestamp refresh warning.

## Static checks

- Targeted frontend ESLint: passed.
- Backend Python compile: passed.
- `git diff --check`: passed.
- Frontend bounded typecheck: failed on 274 pre-existing/unrelated repository
  errors; filtering the full log against every task-owned frontend/test/config
  path returned zero task-owned errors.
