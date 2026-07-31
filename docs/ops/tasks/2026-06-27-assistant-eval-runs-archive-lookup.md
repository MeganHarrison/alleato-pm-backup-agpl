# Assistant Eval Runs Archive Lookup

Date: 2026-06-27
Linear: Not created - current session exposes Linear comments only, not issue creation
Status: Partial - display-path fix implemented; admin-session browser/API proof deferred

## Objective

Make the Assistant Eval Runs admin page show locally generated eval runs written
by the CLI to the documented archive path, then run the requested
`tool-coverage-read-regression` bundle and refresh the published run index.

## Scope

- Fix the admin eval-runs API directory lookup to include the documented archive
  run path.
- Keep legacy/current run path compatibility if either directory exists.
- Run the requested CLI eval bundle.
- Verify the API can read at least one run from the corrected path.

## Done Checklist

- [x] Classify as full task process because a user-facing admin surface cannot
  read generated run artifacts.
- [x] Create task markdown before implementation.
- [x] Check Linear capability before coding.
- [x] Patch eval-runs API directory lookup.
- [x] Run requested eval bundle:
  `node scripts/verify/verify_ai_assistant_eval_suite.mjs --bundle tool-coverage-read-regression`.
- [x] Verify fresh/local run artifacts exist under the documented archive path.
- [x] Verify corrected path selection resolves to the documented archive path
  from the frontend process working directory.
- [ ] Verify the admin eval-runs API can return run data through a signed-in
  admin session.
- [x] Run focused syntax/lint check for the touched API route.
- [x] Fill evidence and final status.

## Evidence

Linear capability:

- `tool_search` exposed Linear comment tools only; no issue-create tool was
  available in this session.

Command evidence:

- `node scripts/verify/verify_ai_assistant_eval_suite.mjs --bundle tool-coverage-read-regression` - FAIL, saved run
  a now-retired local eval-run artifact; result `1/13` passed.
- `node -e "const d=require('./frontend/src/data/assistant-eval-runs.json'); ..."` -
  PASS, newest published run index entry is
  `2026-06-27T19-19-25-334Z-cf04bb83`, bundle
  `tool-coverage-read-regression`, result `1/13`.
- Local path-selection readback from `frontend/` working directory - PASS,
  selected the then-current local eval-run directory and
  read newest run as `tool-coverage-read-regression 1/13`.
- `curl http://localhost:3001/api/admin/eval-runs` without auth after clearing
  `.next` - PASS for failure-loudly behavior, returned `401 AUTH_EXPIRED`.
- Saved Playwright auth cookie probe against
  `http://localhost:3001/api/admin/eval-runs` - DEFERRED/BLOCKED for admin
  readback, returned `403 FORBIDDEN`; saved session is not admin.
- `cd frontend && ./node_modules/.bin/eslint 'src/app/api/admin/eval-runs/route.ts' --quiet` - PASS.
- `cd frontend && npm run typecheck:changed` - PASS, no new `any` type debt.

Changed files:

- `frontend/src/app/api/admin/eval-runs/route.ts`
- `frontend/src/data/assistant-eval-runs.json`
- `docs/ops/tasks/2026-06-27-assistant-eval-runs-archive-lookup.md`
  (gitignored local task record)

Remaining:

- Admin API/browser proof needs an admin-authenticated local session. The saved
  Playwright auth file is valid but not admin for this route.
- The eval suite itself is red. First runtime failure is
  `toolcov-read-project-details`; later failures cascade after the local server
  stopped responding during the run.

## Root Cause

The CLI runner writes eval runs to
the historical local eval-run directory, but the admin API
only searched `docs/ai-plan/evals/runs/`. That made the page report no local
runs even when the CLI had generated them.

## Prevention

The API should keep the documented archive path in its candidate list and log
which candidates are unavailable, so future path drift fails loudly in server
logs instead of silently hiding local artifacts.
