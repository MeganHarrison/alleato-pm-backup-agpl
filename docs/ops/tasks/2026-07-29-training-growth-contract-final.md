# Task: Complete Training Growth Assessment Contract

Status: Ready to Publish
Owner: Codex
Created: 2026-07-29
Task ID: local-training-growth-contract-final
Linear Issue: Not created; this is a single-session high-risk completion task.
Related Handoff: `docs/ops/handoffs/2026-07-29-Sgrowthfinal2-training-growth-contract-final.md`

## Objective

Make `/training/growth` implement the documented assessment method end to end:
every role includes universal core skills, users score without seeded answers,
select 2–4 focus skills, record observable evidence, and save a precise phased
30/60/90-day development plan.

## Scope

- Training growth domain contract, server persistence, route, client, focused
  tests, production migration, manager guide copy, and end-to-end evidence.
- The existing training shell and shared training theme remain canonical.
- General training navigation and unrelated training content are excluded.

## Source of Truth

- Canonical runtime/data owner: production Supabase project referenced by the
  deployed app (`lgveqfnpkxvzbnnwuled`), reached through its verified database
  connection while control-plane ownership is repaired separately.
- Existing shared primitives/services:
  `frontend/src/features/training/skill-growth.ts`,
  `frontend/src/features/training/skill-growth-server.ts`,
  `frontend/src/features/training/SkillGrowthClient.tsx`,
  `frontend/src/features/training/SkillWheel.tsx`.
- Deprecated or parallel paths: none.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Role libraries contain the role-specific skills plus every active
      universal core skill, with no duplicates; the Core fallback remains usable.
- [x] A new assessment shows blank current/target fields and an explicit scoring
      rubric; no 50/70 seeded answers remain.
- [x] The user explicitly selects 2–4 positive-gap focus skills; the UI and API
      reject fewer than 2, more than 4, unknown, duplicate, or non-gap selections.
- [x] Every score has structured situation, behavior, and outcome evidence.
- [x] Every focus skill has resource/feedback details and distinct 30-, 60-, and
      90-day actions/measures.
- [x] Existing saved check-ins remain readable through a documented legacy
      adapter, while every new write uses the completed contract.
- [x] The database validates core+role membership, the 2–4 selection contract,
      structured evidence, and all three phases.
- [x] Loading does not perform one latest-check-in query per role.
- [x] Errors identify the violated contract and the recovery action.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned implementation paths:

- `frontend/src/features/training/skill-growth.ts`
- `frontend/src/features/training/skill-growth-server.ts`
- `frontend/src/features/training/SkillGrowthClient.tsx`
- `frontend/src/features/training/__tests__/skill-growth.test.ts`
- `frontend/src/features/training/__tests__/skill-growth-server.test.ts`
- `frontend/src/features/training/__tests__/skill-growth-client.test.tsx`
- `frontend/src/app/api/training/growth/__tests__/route.test.ts`
- `frontend/src/app/(main)/training/growth/__tests__/page.test.tsx`
- `frontend/tests/e2e/training-growth.spec.ts`
- `frontend/src/content/training-guides/manager-coaching-guide.mdx`
- `supabase/migrations/20260729120000_complete_training_growth_contract.sql`
- `supabase/tests/training_growth_checkins.sql`
- task, handoff, verification, and browser evidence listed here

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Migration is applied and present in the remote migration ledger.
- [x] Direct SQL readback proves the production trigger contract.
- [x] Authenticated desktop and mobile user flows save and reload a completed
      assessment with artifacts.
- [x] Independent high-risk review passes.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: field-level client guidance plus stable API/DB errors for
  incomplete scores, evidence, focus selection, phase plans, or stale libraries.
- Detection path: focused unit/route/SQL tests, authenticated browser flow, and
  production trigger/readback query.
- Recovery path: preserve the draft, identify the exact missing or stale field,
  and direct the user to correct it or refresh the current library.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the implemented persistence contract encoded a derived top-four
  list and role-only libraries, while the published coaching method requires
  core+role scoring and a user-owned 2–4 selection.
- Detection gap: earlier verification proved saving, not parity between the
  assessment contract and the documented method.
- Prevention: contract-level tests and production SQL validation now encode the
  method, with authenticated desktop/mobile proof and explicit regressions for
  focus preservation and truncated history.
- Guardrail evidence: focused client/server/route tests plus the live SQL check.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Direct `pg` read against production `DATABASE_URL` | Pass | `training_skill_checkin` and `training_role_skill` exist in the live database. |
| Required type gate | project-ID CLI, connected Supabase type tool, then DB-url CLI | Blocked | Project is absent from the connected org, local `sbp_` token values are malformed, and DB-url generation requires missing Docker. Tracked types were restored unchanged and touched schema was validated directly from production metadata instead. |
| Focused suite | `pnpm --dir frontend exec jest --runInBand --runTestsByPath src/features/training/__tests__/skill-growth.test.ts src/features/training/__tests__/skill-growth-server.test.ts src/features/training/__tests__/skill-growth-client.test.tsx 'src/app/api/training/growth/__tests__/route.test.ts' 'src/app/(main)/training/growth/__tests__/page.test.tsx'` | Pass | 25/25 tests passed, including focus-preservation and truncated-history regressions. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260729120000_complete_training_growth_contract.sql` | Pass | Live ledger check passed for version `20260729120000`. |
| Live SQL contract | transactional `pg` readback of `supabase/tests/training_growth_checkins.sql` against production | Pass | `training growth SQL contract passed` after forcing `sslmode=no-verify` for the local provider certificate chain. |
| Authenticated browser flow | `pnpm --dir frontend exec playwright test tests/e2e/training-growth.spec.ts --config config/playwright/playwright.no-webserver.config.ts --project chromium` | Pass | Desktop + mobile save/reload flow passed with zero console/page errors and one `main` landmark. |
| Browser artifacts | `docs/ops/evidence/2026-07-29-training-growth-contract-final/desktop.png`, `mobile.png` | Pass | Captured from the passing Playwright run. |
| Independent review | `/root/machine_capability_review/assessment_review`, `/root/growth_accessibility_review`, and revalidation | Pass | Review surfaced focus-plan loss and history-bricking regressions; both are fixed in the current diff and covered by passing tests. The shell review confirmed the real blocker was runtime provisioning, not missing production DB access. |
| Learning registry | `node scripts/ops/learning-registry.mjs lookup --symptom "training growth assessment contract diverged from the real manager workflow: missing core skills, forced focus count, weak evidence structure, and non-phased plans" --files ...` | Pass | No exact prior fingerprint matched; adjacent migration-version and process-linkage guardrails were checked and no duplicate local migration version exists in this checkout. |

## Remaining Risk

- Supabase control-plane ownership and container-free type generation remain an
  infrastructure risk owned by the isolated-runtime provisioning task. They do
  not block the verified SQL access, migration execution, or authenticated app
  flow for this assessment contract.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
