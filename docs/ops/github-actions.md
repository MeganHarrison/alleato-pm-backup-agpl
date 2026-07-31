# GitHub Actions & Automation

> Last verified: 2026-06-26
> Source of truth for every workflow under `.github/workflows/`, what triggers it,
> what secrets it needs, and its current health. Update this when you add, remove,
> or change a workflow.

This repo automates CI, AI-assisted review/triage, and scheduled production checks
through GitHub Actions. There are **13 workflows** plus supporting config under
`.github/`.

---

## Quick reference

| Workflow | File | Trigger | Purpose | Health |
|----------|------|---------|---------|--------|
| Quality Gate | `quality-gate.yml` | PR + manual | Changed-file quality ratchet + route checks (predeploy-gate job is dead — see below) | ✅ Active |
| Guardrail PR Check | `guardrail-pr-check.yml` | PR | Route guardrail coverage + no-new-`any` debt gate | ✅ Active |
| Design System Guardrails | `design-system-guardrails.yml` | PR + manual | Blocks new design-system disables / form violations, lint ratchet | ✅ Active |
| PR Review with Progress Tracking | `pr-review-comprehensive.yml` | PR opened/sync/reopened | Claude posts an inline code review with a progress checklist | ✅ Active |
| Claude Code Action | `claude.yml` | issue/PR comments, reviews, issues | `@claude` mentions & assigned issues → Claude acts | ✅ Active |
| Issue Handler | `issue-handler.yml` | issue opened | Claude auto-triages + labels new issues (`/label-issue`) | ✅ Active |
| Codex Fix Issue | `codex-fix-issue.yml` | issue labeled `codex:fix` | OpenAI Codex attempts a scoped frontend fix → draft PR | ✅ Active |
| Claude Commit Analysis | `manual-code-analysis.yml` | manual | On-demand commit summary or security review | ✅ Manual only |
| API Smoke Contracts | `api-smoke-scheduled.yml` | daily 08:00 UTC + manual | Hits prod API surface, asserts response contracts | ⚠️ Failing — finding **real** prod bugs (see below) |
| E2E Smoke (post-merge) | `e2e-smoke.yml` | manual | Fast Playwright smoke against a deployed URL | ✅ Manual only |
| E2E Regression (Nightly) | `e2e-nightly.yml` | nightly 02:00 UTC + manual | Full Playwright suite against a deployed URL | 🔧 Fixed 2026-06-26 (needs `PLAYWRIGHT_BASE_URL`) |
| Post-Deploy Verify | `postdeploy-verify.yml` | manual | Health + auth smoke after a deploy | ✅ Manual only |
| CI Failure Handler | `ci-handler.yml` | `workflow_run` on a workflow named **"CI"** | Flaky-vs-real triage + auto-retry / auto-fix | 💤 Dormant — no "CI" workflow exists (see Gaps) |

---

## CI / quality gates (run on every PR)

These are the gates that protect `main`. They mirror the local pre-commit hooks
described in `CLAUDE.md` so that what blocks a commit also blocks a PR.

### `quality-gate.yml` — Quality Gate
- **Triggers:** `pull_request` + `workflow_dispatch` only. The `on:` block does **not**
  include `push`.
- **PR job (`changed-quality`):** validates non-production route state, installs frontend
  deps, runs the changed-file quality ratchet (`quality:changed`), and runs API smoke
  contracts **only if** `API_SMOKE_BASE_URL` is set (otherwise skipped, not failed).
- **`predeploy-gate` job — ⚠️ never runs.** It is guarded by
  `if: github.event_name == 'push'`, but the workflow has no `push` trigger, so the full
  `quality:predeploy` gate (45-min) is effectively dead code. If main-branch predeploy
  protection is wanted, add a `push` trigger (scoped to `main`) or move that gate
  elsewhere. Today, nothing runs `quality:predeploy` in CI.
- **Secrets:** `API_SMOKE_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `RAG_DATABASE_URL`,
  `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` (most have safe fallbacks).

### `guardrail-pr-check.yml` — Guardrail PR Check
- **Triggers:** `pull_request`.
- Runs `check-changed-route-guardrails.mjs` twice (changed-file scope, then full-route
  debt gate) and `check-no-new-any.mjs`. Enforces raw-error envelope standards on
  changed routes and prevents new `any` type debt.
- **Secrets:** none.

### `design-system-guardrails.yml` — Design System Guardrails
- **Triggers:** `pull_request`, manual.
- Computes the merge-base, then blocks new design-system `eslint-disable`s, new
  changed-file form violations, enforces the design lint ratchet, and audits form
  fields. Uses `pnpm` (corepack, pinned `10.13.1`).
- **Secrets:** none.

---

## AI-assisted automation

### `claude.yml` — Claude Code Action
- **Triggers:** `issue_comment`, `pull_request_review_comment`, `pull_request_review`
  (when `changes_requested`), `issues` (opened/assigned).
- Runs the official `anthropics/claude-code-action@v1`. Fires when a comment contains
  `@claude`, on any PR review comment, on `changes_requested` reviews, on new issues,
  or when an issue is assigned to `anthropic-claude-code`.
- **Secrets:** `CLAUDE_CODE_OAUTH_TOKEN`.

### `pr-review-comprehensive.yml` — PR Review (Claude)
- **Triggers:** `pull_request` (opened, ready_for_review). Reviews **once** when a PR
  becomes reviewable — NOT on every push. Drafts are skipped; to force a fresh review
  after changes, comment `@claude review` (handled by `claude.yml`).
- Claude is the **single** automated PR reviewer (CodeRabbit disabled via `.coderabbit.yaml`,
  Codex via its cloud settings). `track_progress: true` (posts a live progress checklist
  comment that updates in place) with a concise, high-signal prompt (actionable findings
  only — no praise / N/A recitation). One checklist per PR, since it runs once (not per push).
- **Secrets:** `CLAUDE_CODE_OAUTH_TOKEN`.

### `issue-handler.yml` — Issue Handler
- **Triggers:** `issues` opened.
- Calls Claude with `/label-issue` to triage and label every new issue.
- **Secrets:** `CLAUDE_CODE_OAUTH_TOKEN`, `GITHUB_TOKEN`.

### `codex-fix-issue.yml` — Codex Fix Issue
- **Triggers:** `issues` labeled `codex:fix`.
- The most involved workflow. It parses the issue template, **hard-blocks** anything
  that isn't a fully-scoped `Frontend` task with allowed edit paths under
  `frontend/src/**` or `frontend/tests/**`, runs `openai/codex-action@v1`
  (`gpt-5.4`, high effort, `workspace-write`), validates the diff stays in scope, runs
  `pnpm --dir frontend run quality` + `pnpm run check:routes`, and opens a **draft** PR
  only if everything passes. Every failure mode posts a structured blocker comment
  (cause / detection gap / prevention step).
- **Secrets:** `OPENAI_API_KEY`, `GITHUB_TOKEN`.
- **Supporting config:** `.github/codex/prompts/fix-issue.md`,
  `.github/codex/templates/pr-body.md`.

### `manual-code-analysis.yml` — Claude Commit Analysis
- **Triggers:** manual (`workflow_dispatch`) with an `analysis_type` choice of
  `summarize-commit` or `security-review`.
- One-off Claude analysis of the latest commit. Does not run automatically.
- **Secrets:** `CLAUDE_CODE_OAUTH_TOKEN`.

### `ci-handler.yml` — CI Failure Handler 💤
- **Triggers:** `workflow_run` completed for a workflow **named `"CI"`**.
- **Intended behavior:** Claude inspects a failed CI run, classifies flaky vs. real
  (JSON schema output); if flaky with ≥0.7 confidence it re-runs the workflow, if a
  real bug on a PR it runs `/fix-ci` to auto-fix on a new branch.
- **Status: dormant.** There is no workflow named `CI` in this repo, so this never
  fires. See [Gaps & follow-ups](#gaps--follow-ups). It costs **zero** minutes today.

---

## Scheduled & deploy checks

### `api-smoke-scheduled.yml` — API Smoke Contracts ⚠️
- **Triggers:** daily at 08:00 UTC + manual.
- Runs `scripts/api-smoke-contracts.mjs` against `API_SMOKE_BASE_URL` (prod). The same
  script is also the PR gate inside `quality-gate.yml` and the canonical place to add
  endpoint regression coverage (per `CLAUDE.md`).
- **Status:** currently failing every run — **not** because the workflow is broken, but
  because it is catching real production regressions. As of 2026-06-25: 129 pass / 10
  fail / 5 warn. Representative failures worth fixing:
  - Several `GET /api/projects/67/.../{fake-uuid}` detail endpoints return **400**
    where `200|401|404` is expected (change-events, commitment-pcos, contract payments,
    commitment detail) — likely UUID validation returning 400 instead of 404.
  - `PUT`/`PATCH /api/commitments/{fake-uuid}` return **400** instead of **401**
    (auth/retainage guard ordering — input validated before auth).
  - `POST /api/sync/acumatica/commitments` returns **200 while unauthenticated**
    (expected **401**) — **possible auth gap, review first.**
  - `PATCH /api/projects/67/rfis/{fake-uuid}` returns **500** (RFI close — email
    failure should be non-blocking).
  - **This workflow is kept on purpose.** Fix the endpoints above (add regression cases
    to `scripts/api-smoke-contracts.mjs`) to turn it green.
- **Secrets:** `API_SMOKE_BASE_URL` (required). The script also reads
  `API_SMOKE_BEARER_TOKEN` and `ADMIN_API_KEY` to enable authenticated write probes, but
  **the workflow does not currently forward them into the step's `env`** — so even if
  those secrets exist in the repo, those probes stay downgraded to warnings until the
  workflow passes them through. Add them to the `Run API smoke contracts` step `env` to
  enable full coverage.

### `e2e-nightly.yml` — E2E Regression (Nightly) 🔧
- **Triggers:** nightly at 02:00 UTC + manual.
- Installs frontend deps + Chromium and runs the full Playwright suite against a
  deployed URL, uploading the HTML report as an artifact (7-day retention).
- **Fixed 2026-06-26:** the run step previously combined `working-directory: frontend`
  with `pnpm --dir frontend exec`, resolving to a non-existent `frontend/frontend`
  path (every run failed with `ENOENT`). It also ran `playwright test` without a
  `--config`, so Playwright found no config. The step now drops `working-directory` and
  passes `--config=config/playwright/playwright.no-webserver.config.ts`. The
  **no-webserver** config is deliberate: the canonical CI config
  (`config/playwright/playwright.config.ts`, used by `npm run test`) declares a
  `webServer: npm run dev` block with `reuseExistingServer: !CI`. Against a deployed
  `PLAYWRIGHT_BASE_URL` in CI, Playwright would try to boot a local dev server on a URL
  that already responds and throw before any test runs. The no-webserver config skips
  that and writes its HTML report to `frontend/tests/playwright-report/` (matching the
  upload step). Note there are several Playwright configs under `config/playwright/`;
  this is the one for remote-URL CI runs.
- **Still required to pass:** set the `PLAYWRIGHT_BASE_URL` secret (falls back to
  `API_SMOKE_BASE_URL`). Without it the job exits 1 by design.
- **Secrets:** `PLAYWRIGHT_BASE_URL` (or `API_SMOKE_BASE_URL`),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### `e2e-smoke.yml` — E2E Smoke (post-merge)
- **Triggers:** manual only.
- Fast Playwright smoke (`playwright.config.smoke.ts`, `smoke` project). Skips cleanly
  (exit 0) if `PLAYWRIGHT_BASE_URL` is unset.
- **Secrets:** same as nightly.

### `postdeploy-verify.yml` — Post-Deploy Verify
- **Triggers:** manual only.
- Runs `scripts/postdeploy-verify.sh` to check deployment health and core auth behavior.
- **Secrets:** `API_SMOKE_BASE_URL`.

---

## Supporting automation config (`.github/`)

- **`ISSUE_TEMPLATE/`** — issue forms, including the constrained "Codex Fixable Frontend
  Bug" form that `codex-fix-issue.yml` depends on.
- **`codex/`** — `prompts/fix-issue.md` and `templates/pr-body.md` used by the Codex
  workflow.
- **`pull_request_template.md`** — default PR description scaffold.

> Deployments (Vercel/Render) are configured outside GitHub Actions. This doc only
> covers Actions workflows.

---

## Cleanup log

### 2026-06-26 — removed two permanently-failing scheduled workflows
Both had **never** had a successful run and burned Action minutes on every schedule:

- **Deleted `ai-assistant-prod-evals.yml`** (AI Assistant Prod Evals) — daily 25-min
  job, 61/61 runs failed. The eval bundles require `AI_EVAL_SUPABASE_EMAIL`,
  `AI_EVAL_SUPABASE_PASSWORD`, and `RAG_DATABASE_URL` secrets that were never
  configured, so every run exited 1. Re-add from git history once those secrets exist
  and the eval bundles are confirmed runnable in CI.
- **Deleted `db-inventory-drift.yml`** (DB Inventory Drift Check) — weekly, 258/258 runs
  failed. `scripts/dev-tools/generate-db-inventory.mjs` requires a local `.env` file
  (`❌ .env not found`) and is not CI-runnable as written. The drift check still runs
  locally; if a CI version is wanted, make the script read env vars (not `.env`) first.

### 2026-06-26 — fixed `e2e-nightly.yml`
See the workflow entry above. Path bug + missing `--config` corrected; still needs
`PLAYWRIGHT_BASE_URL` to go green.

### Kept on purpose
- **`api-smoke-scheduled.yml`** stays red until the prod API bugs it found are fixed —
  that red is the signal working as intended, not a broken workflow.

---

## Gaps & follow-ups

1. **`ci-handler.yml` is dormant.** It listens for `workflow_run` on a workflow named
   `"CI"`, which does not exist (the gates are `quality-gate.yml`,
   `guardrail-pr-check.yml`, `design-system-guardrails.yml`). Either rename one of those
   to `CI`, point `ci-handler.yml` at the real workflow name(s), or delete it. It wastes
   no minutes today but provides no value either.
2. **API Smoke prod bugs** (listed above) — the unauthenticated Acumatica sync returning
   `200` should be reviewed first as a potential auth gap.
3. **Node 20 deprecation** — runners now warn that Node 20 actions are forced onto Node
   24. Non-blocking, but bump `actions/setup-node` `node-version` and action majors when
   convenient.

---

## How to add a new workflow

1. Add the `.yml` under `.github/workflows/`.
2. Prefer `pull_request` / `push` gates over schedules unless you genuinely need a
   periodic check — a failing schedule burns minutes silently.
3. If it needs a secret, **fail loudly and early** with a clear message (see the
   `Validate required secrets` pattern in the existing workflows) rather than failing
   deep in a build step.
4. Pin `pnpm` to `10.13.1` and Node to the repo standard.
5. **Add a row to the Quick reference table above and document triggers + secrets.**
