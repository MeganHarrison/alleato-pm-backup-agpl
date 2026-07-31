# Handoff: 2026-06-19 - Knip Dead-Code Audit

## Intake Block

1) Session ID: S70
2) Task ID: AAI-569
3) Linear issue: AAI-569
4) Linear URL: https://linear.app/megankharrison/issue/AAI-569/add-knip-based-dead-code-audit-before-deleting-app-cleanup-candidates
5) Current status: Published to `origin/main` at `99e7e824e9`; accepted and Linear issue Done.
6) Files changed (absolute paths):
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-19-knip-dead-code-audit.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-19-S70-knip-dead-code-audit.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/review-queue.md`
- `/Users/meganharrison/Documents/alleato-pm/frontend/package.json`
- `/Users/meganharrison/Documents/alleato-pm/frontend/pnpm-lock.yaml`
- `/Users/meganharrison/Documents/alleato-pm/frontend/knip.json`
- `/Users/meganharrison/Documents/alleato-pm/package.json`
- `/Users/meganharrison/Documents/alleato-pm/scripts/audits/run-knip-dead-code-report.mjs`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit/knip-report.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit/SUMMARY.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit/knip-stdout-prelude.txt`
7) Commands run and outcome (pass/fail counts):
- PASS: `pnpm --dir frontend add -D knip`.
- PASS: `pnpm --dir frontend exec knip --config knip.json --no-exit-code --no-progress --max-show-issues 5`.
- PASS: `node --check scripts/audits/run-knip-dead-code-report.mjs`.
- PASS: `npm run audit:dead-code:frontend:report`.
- PASS: `npm run codex:finish -- --message "Add Knip dead-code audit report" --files ...` published `99e7e824e9`.
- PASS: Linear AAI-569 moved to Done.
8) Evidence artifacts (screenshot/video/report/log paths):
- `docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit/knip-report.json`
- `docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit/SUMMARY.md`
- `docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit/knip-stdout-prelude.txt`
9) Top 3 findings (frontend-visible issues first):
- No frontend-visible UI is expected; this is cleanup audit infrastructure.
- S69 proved the old orphan-audit raw counts are useful for scoping but unsafe for deletion.
- Knip found the cleanup scale: 554 unused files, 57 unused dependencies, 21 unused devDependencies, 114 unlisted dependencies, 110 unresolved imports, 1005 unused exports, 677 unused exported types, 3 duplicate exports, and 4 unlisted binaries.
10) Recommended next action (one line): Use the S70 report to create the first small deletion task by domain; do not bulk-delete from the report.
11) Handoff file path: docs/ops/handoffs/2026-06-19-S70-knip-dead-code-audit.md
12) Migration ledger evidence: Not applicable; no database migration expected.

## Linear Updates

- Kickoff comment: `b89c9854-2253-48e6-b7e1-e4b74a5b1f9b`
- Milestone comments: `d1d67eb4-47bc-4d84-a3ab-c357d8761c94`
- Completion/blocker comment: `360262d8-96f8-4721-be31-d9a6621d201a`

## Current Status

S70 added and published a trustworthy dead-code audit layer using Knip before
any deletion work. The report is advisory and explicitly not a bulk-delete list.

## Known Pitfalls

- Do not trust raw orphan counts from S69 as deletion instructions.
- Do not delete code in this slice.
- Do not stage unrelated local worktree dirt or reference clones.
- Keep generated/project-map files fresh if route/tool surfaces change.
- Knip JSON output may include dotenv prelude lines because project config loads
  env files; `run-knip-dead-code-report.mjs` strips and stores that prelude
  separately so `knip-report.json` remains valid JSON.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
git status --short
npm run linear:codex:check -- docs/ops/handoffs/2026-06-19-S70-knip-dead-code-audit.md
npm run audit:dead-code:frontend:report
```

## Evidence

- `node --check scripts/audits/run-knip-dead-code-report.mjs` passed.
- `pnpm --dir frontend exec knip --config knip.json --no-exit-code --no-progress --max-show-issues 5` passed and produced issue counts.
- `npm run audit:dead-code:frontend:report` passed and wrote the raw JSON plus summary artifacts.
- Summary artifact: `docs/ops/evidence/2026-06-19-S70-knip-dead-code-audit/SUMMARY.md`.
- Published commit: `99e7e824e9` (`Add Knip dead-code audit report`).
