# Task: App Functional and Training Review Audit

Status: Complete
Owner: Codex SROOT-AUDIT
Created: 2026-07-27
Task ID: APP-TRAINING-REVIEW-AUDIT-20260727
Linear Issue: Connector unavailable in this session; local high-risk task and handoff are the tracking source.
Related Handoff: `docs/ops/handoffs/2026-07-27-SROOT-app-functional-training-review-audit.md`

## Objective

Prove the latest `origin/main` application works across its primary user journey
and prove whether automatic training discovery, admin review, feedback, and
human-gated agent learning operate end to end.

## Scope

- Latest GitHub revision, authenticated app runtime, primary project-management
  journey, shared filter/button behavior, training-doc automation, learning
  promotions, and admin review surfaces.
- Fix only runtime-confirmed Critical/High failures localized to a boundary.
- Excludes broad visual redesign, unrelated scheduling work in the canonical
  checkout, and speculative schema/provider changes.

## Source of Truth

- Canonical runtime/data owner: Vercel frontend, Render FastAPI backend, linked Supabase project.
- Existing shared primitives/services: `frontend/src/components/ds`,
  `frontend/src/lib/ai/learning-proposals/human-gated-learning.ts`,
  `frontend/src/app/(admin)/ai/learning-promotions`,
  `frontend/src/app/(admin)/training-docs`,
  `agents/docs-freshness-maintainer`.
- Deprecated or parallel paths: direct unreviewed promotion into durable agent
  knowledge is forbidden; the canonical review ledger is
  `ai_learning_promotions`.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The audited workspace is based on the fetched `origin/main` SHA and the canonical dirty checkout remains untouched.
- [x] Authenticated browser preflight lands on a protected route and records artifacts.
- [x] Primary project-management flows and representative shared filters/buttons have pass/fail evidence.
- [x] Automatic training discovery/sync ownership and schedule are identified from live or executable evidence.
- [x] Admins can see pending learning/training candidates and can approve, reject, or provide specific feedback.
- [x] Only an authenticated admin review action can create the reviewed correction; the rejected candidate is not applied as-is.
- [x] Failures are specific and actionable; no silent success is accepted.
- [x] Focused regression checks and end-to-end proof cover every changed boundary, with the downstream workflow blocker recorded rather than skipped tests treated as passes.
- [x] Independent re-review signs off before publication.

## Implementation Checklist

- [x] Files/modules to inspect are listed before edits.
- [x] Existing review and training abstractions are treated as canonical.
- [x] Runtime failures are localized before product-code edits.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are verified if changed.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow and live-system readback prove every changed boundary.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published through the exact-file remote-main
  publisher and verified equal to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: route/API-specific error with failed status, missing
  schedule/config, or explicit review/promotion state.
- Detection path: authenticated browser artifact, focused API/test command, and
  database/service readback where applicable.
- Recovery path: retry the scoped action, correct the specific candidate, or
  repair the localized owner; never silently auto-promote.

## Incident Learning

- Failure fingerprint: `projects.bootstrap-role-trigger-membership-order`
- Root cause: the default-role trigger executed as the caller before creator membership existed; bootstrap identity, creator access, and learning-review actions also had split runtime contracts.
- Detection gap: coverage stopped at local inserts or owner-only happy paths instead of exercising linked-database RLS, repeated bootstrap, protected creator access, non-owner app admins, and partial apply outcomes.
- Prevention: harden and verify the trigger, generate request-scoped identities, share creator access provisioning, and use one app-admin learning-review boundary with phase-aware outcomes.
- Guardrail evidence: `scripts/verify/verify_project_bootstrap_role_trigger.mjs`, focused 59/59 Jest regression tests, the applied migration ledger, protected-route browser proof, and `docs/ops/tasks/2026-07-27-app-functional-training-review-audit-proof/`.

Additional registered fingerprints:

- `projects.bootstrap-static-identity-collision`
- `projects.creator-membership-provisioning-drift`
- `ai.learning-review-boundary-drift`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| GitHub sync | `git fetch --prune origin main` | Pass | Workspace base SHA `9b33206ad28e6fb6a718195007920380fe87eda4`; later remote training-hub changes were non-overlapping. |
| Workspace isolation | `isolated-session-workspace.mjs create ...` | Pass | Clean workspace created from `origin/main`; canonical checkout remained dirty and untouched. |
| Task setup | This task file | Pass | Acceptance and failure-loudly contracts were captured before implementation. |
| Auth preflight | `frontend/tests/agent-browser-runs/2026-07-27T23-10-10-354Z-app-functional-audit-auth-preflight/` | Pass | Authenticated protected route loaded. |
| Canonical portfolio | `feature-audit-output/app-functional-training-review/screenshots/canonical-project-portfolio-loaded.png` | Pass | 85 projects loaded. |
| Search/view/settings | Search, tab, grid, and settings screenshots in the feature audit output | Pass | Shared canonical controls responded without application errors. |
| Legacy route ownership | `/projects` browser navigation plus focused route test | Pass | Redirects to canonical `/` portfolio. |
| Learning review UI | `admin-learning-review-queue.png`, `admin-learning-rejection-feedback-required.png` | Pass | App admin sees 2 candidates; rejection is disabled until correction is meaningful. |
| Focused Jest | 11 focused suites | Pass | 59/59 tests, including access, partial-outcome, and warning-toast coverage. |
| Changed quality | `pnpm --dir frontend quality:changed` | Pass | No new lint/type/unsafe-pattern/route-guardrail debt. |
| Route naming | `npm run check:routes` | Pass | No route conflicts. |
| Trigger verification | `node scripts/verify/verify_project_bootstrap_role_trigger.mjs` | Pass | Trigger is attached and hardened. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260728001500_harden_default_project_roles_trigger.sql` | Pass | Local and remote version `20260728001500` present. |
| Main publication | `npm run codex:finish -- --message "Harden project and learning review workflows" ...` | Pass | 38 exact files published to `origin/main` at `5643d413bfe5c36ec46feb6d82d1eef1494e9993`; isolated publication receipt recorded. |
| Full typecheck | `pnpm --dir frontend typecheck` | Fail, unrelated debt | 625 output lines. Representative owners: Training Map nullability and root portfolio filter typing; neither file is changed by this task. |
| Financial E2E | Exact focused Playwright command in handoff | Blocked after access pass | Creator access passes. Dev server forces full reload at contract submit and Playwright reports `ERR_NETWORK_CHANGED`; 9 later steps do not run. |
| Test cleanup | Scoped project archive/readback | Pass | Audit projects 1153 and 1158 archived; workflow fixtures 1155-1159 cleaned by the test. |

## Remaining Risk

- The core financial workflow remains unverified after prime-contract submit
  because the Next dev server repeatedly forces a full reload without source
  changes. Missing local Velt credentials are a concurrent explicit 500 but are
  not proven causal.
- The weekly training finder does not revalidate existing-resource freshness,
  and the weekday docs-freshness schedule remains a no-op.
- Database architecture inventory regeneration is blocked by 14 live MAIN
  tables missing from `docs/architecture/tables.yaml`, including the training
  resource/role/topic tables. The generator detects and names the drift before
  writing; the database architecture owner must classify those tables and run
  `RAG_SUPABASE_URL=https://fqcvmfqldlewvbsuxdvz.supabase.co npm run db:inventory`.
- Remaining promotion producers and non-transactional legacy apply writers need
  a separate bounded normalization/transaction design.

## Final Status

- [x] All required checklist items are complete after publication.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action.
