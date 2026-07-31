# Direct Costs Playwright Workflow

This script automates the direct-costs browser flow:
- open direct-costs list
- authenticate via real `/auth/login`
- open create form
- fill required fields
- submit
- verify result and save screenshots
- write per-run machine-readable reports (`report.json`)

## Prerequisites

```bash
command -v npx >/dev/null 2>&1 && echo "npx OK"
```

```bash
cd /Users/meganharrison/Documents/github/alleato-pm/frontend
npx playwright install chromium
```

Ensure the app is running:

```bash
cd /Users/meganharrison/Documents/github/alleato-pm/frontend
npm run dev
```

## Required Environment

Set these in `/Users/meganharrison/Documents/github/alleato-pm/frontend/.env.local` (or export in shell):

- `BASE_URL`
- `PROJECT_ID`
- `LOGIN_EMAIL`
- `LOGIN_PASSWORD`
- `CODEX_MODEL` (for auto-fix loop only)
- Optional: `HEADLESS`, `STORAGE_STATE`, `OUTPUT_DIR`, `MAX_ATTEMPTS`

## Run

Run (uses values from `.env`/`.env.local`):

```bash
cd /Users/meganharrison/Documents/github/alleato-pm/frontend
node scripts/manual/browser/direct-costs-workflow.js
```

Use a Playwright auth state if available:

```bash
cd /Users/meganharrison/Documents/github/alleato-pm/frontend
STORAGE_STATE="/Users/meganharrison/Documents/github/alleato-pm/frontend/tests/.auth/user.json" \
node scripts/manual/browser/direct-costs-workflow.js
```

## Auto-Fix Loop

This runner will:
- run the browser workflow
- if failure occurs, call `codex exec` to fix root cause
- rerun until success or `MAX_ATTEMPTS` is reached

```bash
cd /Users/meganharrison/Documents/github/alleato-pm/frontend
bash scripts/manual/browser/direct-costs-autofix-loop.sh
```

Set `MAX_ATTEMPTS=0` for an unbounded loop.

## Artifacts

Screenshots are saved under:

```text
/Users/meganharrison/Documents/github/alleato-pm/output/playwright/direct-costs-workflow
```

Per-run artifacts:
- `runs/<timestamp>/01-list.png ... 99-failure.png`
- `runs/<timestamp>/report.json`
- `last-run.json` (latest run status)
- `attempt-<n>.log` and `codex-attempt-<n>.log` (auto-fix loop logs)
