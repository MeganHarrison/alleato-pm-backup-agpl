# Task: Persisted Training Skill Wheel

Status: In Progress
Owner: S239 implementation / S240 database hardening
Created: 2026-07-26
Task ID: ALL-28
Linear Issue: https://linear.app/alleato-group/issue/ALL-28/t14-my-growth-interactive-skill-wheel-self-evaluation-persisted-per-user
Related Handoff: `docs/ops/handoffs/2026-07-26-S239-training-skill-wheel.md`

Delivery lane: High-risk

## Objective

Replace the standalone browser-local Skill Wheel with an authenticated in-app
My Growth workflow whose role skills and dated self-evaluations persist in
Supabase.

## Acceptance Contract

- [ ] Role-specific libraries and an Alleato Core fallback are database-backed.
- [ ] Learners can edit current and target scores from 0–100.
- [ ] The wheel redraws immediately as scores change.
- [ ] Focus areas are ranked by `importance × max(target - current, 0)`.
- [ ] Check-ins are dated and persisted per authenticated user.
- [ ] The latest check-in restores when the learner returns.
- [ ] 30/60/90-day re-score dates are shown from the latest check-in.
- [ ] RLS permits users to read/write only their own check-ins.
- [ ] Failures are specific, visible, and recoverable.

## Failure-Loudly Contract

- Cause surfaced as: authenticated API error envelope plus a visible recovery
  toast; stale skill libraries return a refresh-required precondition error.
- Detection path: focused API tests, RLS readback, authenticated production
  save/reload proof, and browser error inspection.
- Prevention: schema checks, canonical server-side skill snapshotting, RLS,
  unique user/role/date check-ins, database-level canonical snapshot validation,
  and regression tests.

## Rollback

Remove the My Growth route/nav entry, then drop
`training_skill_checkin` before `training_role_skill`. Existing training
library data is not altered.

## Evidence

- Migration `20260726232000_create_training_skill_growth.sql` was applied to the linked Supabase project in one transaction.
- `npm run db:migrations:verify-applied -- supabase/migrations/20260726232000_create_training_skill_growth.sql` passed.
- Additive hardening migration `20260727002000_harden_training_skill_checkin_scores.sql` passed rollback preflight, exact linked-ledger verification, and a live rollback probe that accepted a canonical snapshot, rejected `scores = [{}]`, and read back the validation trigger.
- The S240 closeout publishes the hardening migration together with this task contract so the database guardrail cannot ship as untracked follow-up work.
- Live schema readback: both tables have RLS enabled; eight expected policies are present; five Alleato Core skills and 48 role skills were seeded across six roles.
- Focused Jest: 7 suites / 18 tests passed, including ranking, redraw, save payload, stale-library recovery, authentication recovery, route load, and hub navigation.
- Focused ESLint: zero errors and zero warnings across every changed TypeScript file.
- `npm run check:routes`: passed with no dynamic route conflicts.
- Impeccable surface-complexity audit: all three changed UI surfaces passed.
- `git diff --check`: passed.
- Local startup/read boundary: isolated Next server reached Ready on port 3319 and `/training/growth` returned the expected unauthenticated redirect.
- Deployment configuration repair: the three required Vercel production Supabase variables existed but were empty; they were replaced individually from the governed Supabase project and stored as sensitive values.
- Full `tsc --noEmit`: default heap failed at 4 GB; the 8 GB retry completed and reported unrelated existing type debt across admin, AI, project, and reporting owners, with no Skill Wheel files in the failures.
- Independent review approved with no P0–P2 findings. Pending before closure: authenticated production save/reload and responsive browser proof.
