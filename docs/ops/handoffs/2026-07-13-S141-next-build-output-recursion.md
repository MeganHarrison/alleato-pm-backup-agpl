# S141 Handoff: Next Build Output Recursion Repair

Status: Accepted
Owner: Codex
Task: `docs/ops/tasks/2026-07-13-next-build-output-recursion.md`
Linear: AAI-1064 — https://linear.app/megankharrison/issue/AAI-1064/stop-nextjs-build-output-recursion-and-memory-exhaustion

## Intake Block

1) Session ID: S141
2) Task ID: AAI-1064
3) Linear issue: AAI-1064
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1064/stop-nextjs-build-output-recursion-and-memory-exhaustion
5) Current status: Accepted
6) Files changed (absolute paths): task/handoff/evidence; `frontend/next.config.ts`; canonical build runner and focused guardrail/test; `scripts/dev/start-frontend-clean.sh`; production `frontend/tsconfig.json`; `docs/ops/learning/recurring-failures.yaml`; S141 orchestration rows
7) Commands run and outcome (pass/fail counts): focused node contract 8/8 pass; targeted ESLint/syntax/shell checks pass; baseline canonical build pass in 1.1m; patched canonical build pass in 2.0m; final follow-up canonical build pass in 1.2m at 541,045,568 bytes; production and direct-dev fail-loud probes pass; ports 3001/3002 healthy
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-13-next-build-output-recursion/REPORT.md`
9) Top 3 findings: canonical `.next` build was already safe; custom production dist bypassed Next's hard-coded `.next` chunk ignore; old dev servers demonstrably rewrote the tracked production tsconfig until restarted through the isolated config path
10) Recommended next action (one line): Keep `build:production` and the canonical dev launcher as the only build/dev output owners.
11) Handoff file path: /Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S141-next-build-output-recursion.md
12) Migration ledger evidence: Not applicable; no migration files are in scope.

## Linear Updates

- Kickoff: posted with scope, owned files, prior 5.3 GB symptom, and isolated-reproduction next action.
- Milestone: posted after the clean baseline, live tsconfig rewrite proof, seven focused tests, patched canonical build, and output-boundary read-back.
- Review: this handoff contains the final comment inputs and evidence path for acceptance.
- Publish: implementation commit `7b4db99b0e892cb3b627267435e48b342d07a083` reached `origin/main` and matched local HEAD after fetch.
- Follow-up: S138's direct `.next-s138` server exposed the missing-tsconfig bypass; guard and 8th test passed, and both active ports were restarted through the canonical launcher before republish.
- Follow-up publish: `970416e740478b78dc9df1e554cc17950fe45887` reached `origin/main` and matched local HEAD after fetch.

## Failure Accounting

- Cause: a port-scoped dev dist/tsconfig leaked into production; Next's trace optimization only recognizes canonical `.next` generated chunks.
- Detection gap: build watchdog detected silence but not unsafe input paths, output recursion/growth, nested dist trees, or tracked-tsconfig mutation.
- Prevention: custom dev output requires an isolated tsconfig, per-port launch configs, production preflight, 2 GiB monitor, post-build scan, and eight focused tests.
