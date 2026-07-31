# Handoff: 2026-07-26 — Training Module Foundation

## Intake Block

1) Session ID: S220
2) Task ID: ALL-15 through ALL-18
3) Linear issue: ALL-16
4) Linear URL: https://linear.app/alleato-group/issue/ALL-16/t2-supabase-schema-migration-for-training-tables
5) Current status: Complete — ALL-17 seed deferred because its real source export is unavailable; publication pending.
6) Files changed (absolute paths): S220 task/handoff/control-plane rows, `specs/training-module-spec.md`, `supabase/migrations/20260726143515_create_training_resource_library.sql`, `supabase/tests/training_resource_library.sql`, and `frontend/src/types/database.types.ts`.
7) Commands run and outcome (pass/fail counts): Linear GraphQL project/task readback passed; repository/source discovery found the integration owners and confirmed the standalone source assets are absent; direct type generation failed closed without an access token, then secure Vercel-environment type generation passed; remote transactional migration + full SQL contract passed and rolled back; Jest passed 14/14; focused ESLint passed; the bounded full typecheck has zero Training diagnostics but still exits 1 on unrelated repo-wide debt.
8) Evidence artifacts (screenshot/video/report/log paths): This handoff and the linked task evidence table.
9) Top 3 findings (frontend-visible issues first): Training is a company-wide `/training` module, not project-scoped; current profile data already exposes `people.job_title` as `profile.title`; standalone resource/guide sources are outside this checkout and must be recovered by S221.
10) Recommended next action (one line): Publish the verified foundation and S221 presentation slice, then wire `/training`; seed only after Brandon supplies the real export.
11) Handoff file path: `docs/ops/handoffs/2026-07-26-S220-training-module-foundation.md`
12) Migration ledger evidence: PASS — `npm run db:migrations:verify-applied -- supabase/migrations/20260726143515_create_training_resource_library.sql` confirmed exact local/remote version `20260726143515`.

Task file: `docs/ops/tasks/2026-07-26-training-module-foundation.md`
Verification manifest: `frontend/src/lib/training/__verification__/foundation.verification-manifest.json`
Verification result: `frontend/src/lib/training/__verification__/foundation.verification-result.json`

## Linear Updates

- Kickoff comment: https://linear.app/alleato-group/issue/ALL-16/t2-supabase-schema-migration-for-training-tables#comment-41410c03
- Milestone comments: None.
- Completion/blocker comment: None.

## Current Status

The live schema, ledger, regenerated types, server-only helpers, focused tests,
strict verification contract, and independent review pass. Two early review
rounds caught and removed service-role publish and retag paths. Automation now
has table reads plus one atomic review-candidate RPC and no direct writes.
ALL-17 alone is deferred because the real 92-published/~24-review source export
is unavailable; no records were invented.

## Exact Next Step

Publish the exact S220 files, integrate S221 commits `b8b85a92e` and
`6ff8c83eb`, then wire the authenticated `/training` route against
`frontend/src/lib/training/server.ts`.

## Known Pitfalls

- Do not conflate the existing admin-only `training_docs` authoring system with
  the learner-facing training resource library.
- Do not create a second user job-role field; reuse `people.job_title` through
  the current profile contract.
- Do not seed invented resources while the standalone source file is missing.
- Do not make review rows readable to ordinary authenticated users.

## Resume Commands

```bash
cd /home/friday/.codex/isolated-workspaces/s220-all-15-18-571186
node scripts/ops/checkout-session-gate.mjs audit --session S220
git status --short --branch
```

## Evidence

- Linear project: https://linear.app/alleato-group/project/training-module-alleato-pm-440c4dd32bec
- Task contract: `docs/ops/tasks/2026-07-26-training-module-foundation.md`

## Independent Review

Reviewer `/root/training_schema_review` initially blocked generic
`service_role` writes because they could publish directly, then blocked direct
join-table inserts because they could retag an already-published resource. Both
paths were removed. The approved boundary gives `service_role` table reads plus
one `SECURITY DEFINER` RPC whose signature exposes neither status/cost nor an
existing resource id and atomically tags only its new review row. Final verdict:
**APPROVED**, no blocking findings. The one residual test suggestion—prove an
ordinary authenticated caller cannot execute the RPC—was added and passed
before live application. The final frontend/data-access review also identified
and repaired active-role visibility drift: RLS now remains the single taxonomy
visibility owner, inaccessible linked roles fail loudly, and mapped roles sort
deterministically. Final publication verdict: **APPROVED**.
