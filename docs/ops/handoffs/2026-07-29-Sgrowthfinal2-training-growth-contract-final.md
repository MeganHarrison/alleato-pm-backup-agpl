# Handoff: Training Growth Assessment Contract

Status: Ready to Publish
Session: Sgrowthfinal2
Task: local-training-growth-contract-final
Delivery lane: High-risk
Verification manifest: `docs/ops/evidence/2026-07-29-training-growth-contract-final/verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-29-training-growth-contract-final/verification-result.json`

## Objective

Complete and verify the actual `/training/growth` assessment contract through
production.

## Runtime localization

- New isolated workspaces previously lacked ignored runtime files.
- Runtime provisioning now has a separate fix path; this assessment task uses
  the already-provisioned local runtime and direct production DB access.
- Production Vercel values for Supabase management credentials are placeholders.
- The locally stored `sbp_` values are malformed and rejected by Supabase CLI.
- The connected Supabase organization does not expose the production project
  still referenced by the deployed app.
- The production `DATABASE_URL` does connect successfully and confirms both
  assessment tables exist. This is the first working contract boundary and is
  the path used for live schema inspection, migration execution, ledger
  verification, and SQL readback.

## Acceptance contract

See `docs/ops/tasks/2026-07-29-training-growth-contract-final.md`.

## What changed

- Combined universal core skills with each active role library and deduped core
  versus role-specific duplicates by normalized name.
- Removed seeded score defaults so new assessments start blank.
- Replaced implicit top-four selection with explicit user-owned 2–4 focus picks.
- Replaced freeform evidence with structured situation/behavior/outcome fields.
- Replaced generic plans with resource, feedback, and exact 30/60/90 actions
  and measures.
- Preserved legacy saved plans through an adapter while keeping all new writes on
  the completed contract.
- Collapsed the prior per-role latest-check-in loading pattern into one bounded
  history query.
- Fixed the regression where editing a selected focus skill silently removed it
  from the saved plan.
- Fixed the regression where more than 200 saved check-ins would brick the page;
  the route now shows the latest 200 and warns that older history still exists.
- Fixed the duplicated visible `Current Target` score label caused by a legacy
  pseudo-element selector.

## Migration ledger evidence

- `npm run db:migrations:verify-applied -- supabase/migrations/20260729120000_complete_training_growth_contract.sql`
- Result: `Supabase migration ledger check passed: 20260729120000`

## Verification evidence

- Focused suite:
  `pnpm --dir frontend exec jest --runInBand --runTestsByPath src/features/training/__tests__/skill-growth.test.ts src/features/training/__tests__/skill-growth-server.test.ts src/features/training/__tests__/skill-growth-client.test.tsx 'src/app/api/training/growth/__tests__/route.test.ts' 'src/app/(main)/training/growth/__tests__/page.test.tsx'`
  - Result: 25/25 tests passed.
- Live SQL contract:
  - `training growth SQL contract passed`
  - Source: transactional readback of `supabase/tests/training_growth_checkins.sql`
    against production through `DATABASE_URL` with `sslmode=no-verify`.
- Authenticated browser flow:
  `pnpm --dir frontend exec playwright test tests/e2e/training-growth.spec.ts --config config/playwright/playwright.no-webserver.config.ts --project chromium`
  - Result: desktop + mobile save/reload flow passed with zero console/page
    errors and one `main` landmark.
- Browser artifacts:
  - `docs/ops/evidence/2026-07-29-training-growth-contract-final/desktop.png`
  - `docs/ops/evidence/2026-07-29-training-growth-contract-final/mobile.png`
- Independent review:
  - `/root/machine_capability_review/assessment_review`
  - `/root/growth_accessibility_review`
  - Findings were revalidated against the current diff; focus-loss and
    history-bricking regressions are fixed and covered by tests.
- Typecheck review:
  - `/root/growth_types_verify2`
  - Result: unrelated baseline debt remains, but no owned training-growth
    typecheck errors remain.

## Remaining work

- Publish this workspace to `origin/main`.
- Verify the deployed `/training/growth` route in production after publish.
- Publish the separate worktree-runtime provisioning fixes so future isolated
  workspaces arrive with the required ignored runtime files and browser auth.
