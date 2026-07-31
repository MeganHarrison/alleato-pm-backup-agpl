# Handoff: Financial Workflow and Training Freshness Follow-ups

Status: Complete with Deferred Render Verification
Owner: Codex SROOT-FOLLOWUPS
Task:
`docs/ops/tasks/2026-07-27-financial-training-freshness-followups.md`

## Acceptance Contract

- Complete the existing full financial workflow without environmental reloads.
- Keep automatic training discovery review-only and feed admin decisions into
  future selection.
- Revalidate approved resources without changing them before admin review.
- Run weekday documentation freshness for real and prove admin delivery with
  readback.
- Fail loudly on partial outcomes and publish exact task-owned files.

## Workspace

- Base: `origin/main` at `d865d4e0ce17cac06fdb9a33dd68c4349b07e8b8`
- Isolated workspace:
  `/home/friday/.codex/isolated-workspaces/sroot-followups-app-financial-training-freshness-2026072-b0a07e`
- Canonical checkout remained read/integration-only.

## What Changed

- Financial Playwright/auth/server isolation and exact journey assertions.
- Budget zero-amount policy receipt and prime-contract invoice route.
- Admin candidate review feedback, persisted in Supabase and used by
  feedback-aware candidate ranking/rejection.
- Idempotent repeated-observation training freshness checks and admin actions.
- Weekday documentation scan delivery to Linear ALL-30 with exact comment
  readback.
- GitHub weekday scheduler and fail-loud configuration validation.

## Evidence

- Financial Playwright: 11 passed in 1.8m; project 1176 archived.
- Training frontend: 5 Jest suites / 30 tests passed.
- Training backend: 29 pytest tests passed.
- Supabase ledger:
  - `20260728003500_training_resource_freshness_review.sql`: Local/Remote.
  - `20260728013000_training_resource_review_feedback.sql`: Local/Remote.
  - `20260728021000_training_freshness_feedback_bridge.sql`: Local/Remote.
  - `20260728022000_training_freshness_feedback_enum_fix.sql`: Local/Remote.
- Live freshness contract passed service/admin ACL, dedupe, second-observation
  promotion, source immutability, Keep/Archive feedback bridging into canonical
  finder memory, and rollback.
- Browser/database proof is stored under
  `docs/ops/tasks/2026-07-27-financial-training-freshness-followups-proof/`.
- Documentation agent typecheck passed; Eve info reported 0 errors.
- Linear delivery comments `35d7bf…` and `842a5e6a…` were posted and read back.
- Exact 62-file publication completed at `origin/main`
  `225d424dcdf6e044348cc87b90465aa59cd6d05d`.
- Production GitHub run `30321444676` executed that commit, delivered two
  blocked findings to Linear comment
  `f07ac59f-8075-4732-8a4b-1b96a25df014`, read the exact comment back, and then
  exited non-zero as required by the fail-loud contract.
- Follow-up production localization found the checked-in project map was based
  on a pre-integration tree, the direct Supabase host was IPv6-only from GitHub
  Actions, and the fallback performed three Management API requests per table.
- The remediation uses complete batched stats/counts/columns snapshots for both
  databases, documents all 520 production tables, and passed the live local
  Management API run plus the 4/4 connection/inventory regression test.
- Remediation commit `ab2b8696ea0c1c349168180b89e233665a151f22`
  passed production GitHub run `30322204176`. The run delivered and read back
  Linear comment `02d7a595-3f2f-41e4-95d6-633456767d50`; its only finding was
  a non-blocking two-line TABLE-LIST live-stat/timestamp refresh warning.
- Targeted frontend ESLint and workflow YAML parse passed.
- Bounded frontend typecheck reported 274 unrelated repository errors and zero
  errors under task-owned frontend, test, or Playwright config paths.
- Independent review passed after its freshness-feedback bridge blocker was
  fixed and re-verified live.

## Migration Ledger Evidence

Commands:

```text
npm run db:migrations:verify-applied -- \
  supabase/migrations/20260728003500_training_resource_freshness_review.sql
npm run db:migrations:verify-applied -- \
  supabase/migrations/20260728013000_training_resource_review_feedback.sql
npm run db:migrations:verify-applied -- \
  supabase/migrations/20260728021000_training_freshness_feedback_bridge.sql
npm run db:migrations:verify-applied -- \
  supabase/migrations/20260728022000_training_freshness_feedback_enum_fix.sql
```

All four exact versions were present in the linked remote migration ledger.

## Failure Analysis

- Cause: stale browser/session assumptions and missing durable policy,
  feedback, repeated-observation, and scheduled-delivery ownership.
- Detection gap: permissive selectors, non-exact request checks, console-only
  scheduling, and rejection status without explanatory feedback.
- Prevention: exact request/response assertions, live token validation,
  constrained reviewer notes, feedback-aware candidate selection, idempotent
  freshness promotion, and delivery readback.
- The first feedback-bridge function exposed a PostgreSQL enum cast failure
  under the expanded live contract. The follow-up migration casts the decision
  explicitly, and the same contract now passes both Keep and Archive paths.

## Deferred External Verification

- No Render API/CLI credential or connector is available in this session, so
  live creation/readback of `alleato-training-resource-freshness-weekday`
  cannot be verified. A Render service administrator must provide that
  capability and read back the declared cron after the blueprint is applied.
