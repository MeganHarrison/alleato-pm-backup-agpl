# Handoff: 2026-07-22 — Source-Backed FMDS 8-34 Evaluator

## Intake Block

1) Session ID: SROOT-FMDS87
2) Task ID: GitHub #87
3) Linear issue: Not used
4) Linear URL: N/A; GitHub issue is https://github.com/The-Alleato-Group/project-management/issues/87
5) Current status: Complete — source-backed evaluator result proof, independent review, and release evidence passed.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/fmds/asrs-estimator.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/fmds/asrs-estimator.server.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/components/fm-global/asrs-estimator-results.tsx`, focused FMDS tests, `/Users/meganharrison/Documents/github/project-management/infrastructure/asrs-supabase/supabase/migrations/20260722090000_add_fmds_rule_card_citation_source_ids.sql`, and this task/handoff documentation.
7) Commands run and outcome (pass/fail counts): focused suite 6/6 suites, 20/20 tests pass; changed-file type guard and targeted ESLint pass; full frontend unit suite found one unrelated action-tools failure and did not exit cleanly; high-memory full TypeScript check reached extensive pre-existing debt and exited 2.
8) Evidence artifacts (screenshot/video/report/log paths): migration ledger readback and dedicated-ASRS SQL/RPC source-ID readback recorded in the task file; canonical result screenshot remains blocked by local authentication.
9) Top 3 findings (frontend-visible issues first): verified results now have linkable source/review provenance; missing structured provenance is visibly Pending Review; public/authenticated/assistant consumers preserve the shared result contract.
10) Recommended next action (one line): begin the separately tracked reviewed rule-card slice for additional sprinkler intake inputs and head-count authority.
11) Handoff file path: `docs/ops/handoffs/2026-07-22-SROOT-fmds87-source-backed-evaluator.md`
12) Migration ledger evidence: N/A — no migration is planned for this slice.

## Linear Updates

- Kickoff comment: https://github.com/The-Alleato-Group/project-management/issues/87#issuecomment-5044071668
- Milestone comments: Pending source-backed implementation checkpoint.
- Completion/blocker comment: Pending.

## Current Status

The shared evaluator preserves structured table/figure source identity, review-event identity, rule key, page, and canonical evidence links. It rejects incomplete provenance as Pending Review. The corrective migration is applied, the live escalated output uses `batch1.tfs.noncompliance_escalation`, the source/review-event integrity query returns zero invalid citations, independent re-review passes, and deployment `dpl_7FRPxAUxQ9mDv6mGVkxfsYLEY2cf` is Ready on the canonical host.

## Exact Next Step

Extend reviewed deterministic rule cards only when source evidence and review approval exist; do not infer sprinkler head count from the current Batch 1 evaluator.

## Known Pitfalls

- Native vector chunks are discovery evidence, not calculation authority.
- Do not add a route-local result shape or legacy FM lookup fallback.
- Do not modify the active ASRS intake route adapter work.

## Resume Commands

```bash
node scripts/ops/checkout-session-gate.mjs status
pnpm --dir frontend exec jest --runTestsByPath src/lib/fmds/__tests__/asrs-estimator.server.test.ts src/lib/ai/tools/__tests__/asrs-intelligence.test.ts --runInBand
```

## Evidence

- GitHub ticket: https://github.com/The-Alleato-Group/project-management/issues/87
- Focused verification: 6 suites / 20 tests passed; `pnpm --dir frontend run typecheck:changed`; targeted ESLint; `git diff --check` all passed.
- Full-suite baseline: `cd frontend && npm run test:unit -- --runInBand` fails unrelated in `src/lib/ai/tools/__tests__/action-tools.test.ts` because the audit-client mock lacks `.in` at `src/lib/ai/tools/action-tools.ts:444`.
- Full TypeScript baseline: default `tsc --noEmit` OOMed. The bounded retry with `NODE_OPTIONS=--max-old-space-size=8192` exited 2 on extensive existing debt; adjacent diagnostics are `api/asrs/chat/route.ts:70` error-code union and the FMDS figure-review route's `never` fields, outside this evaluator result-contract scope.
- Migration ledger: dedicated ASRS local and remote both show `20260722090000`; direct SQL confirms 13/13 citations include `source_id`; RPC JSON-path check returns true.
- Publish evidence: `git commit --only` created `ed7e25721` from only the nine #87 paths; `git push origin main` succeeded and local `HEAD` equals `origin/main`. This fallback preserved the unrelated staged index after `codex:finish` refused it.
- Corrective migration ledger: local and remote both show `20260722140000`; the live escalated RPC output has `rule_key=batch1.tfs.noncompliance_escalation`, and the citation/source/review-event integrity query returns `0`.
- Production evidence: submission `73704f27-097b-4eb1-9039-a18bd2f7804e` rendered the table link and resolved it to table `95fec116-9f3c-4ee0-8eae-1a7b65003017`; screenshots are stored under `/Users/meganharrison/.codex/visualizations/2026/07/22/019f88ed-e004-7b50-97e2-f067a71a90d6/`.
- Release evidence: Vercel deployment `dpl_7FRPxAUxQ9mDv6mGVkxfsYLEY2cf` is Ready for commit `77cd717` and aliases `https://projects.alleatogroup.com`; post-deploy artifact is `fmds87-postdeploy-source-link.png`.
