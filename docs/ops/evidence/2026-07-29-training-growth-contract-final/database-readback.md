# Training Growth Database Readback

Date: 2026-07-29
Task ID: local-training-growth-contract-final

Live checks:

1. Migration ledger
   - Command:
     `npm run db:migrations:verify-applied -- supabase/migrations/20260729120000_complete_training_growth_contract.sql`
   - Result:
     `Supabase migration ledger check passed: 20260729120000`

2. Transactional SQL contract
   - Source:
     `supabase/tests/training_growth_checkins.sql`
   - Execution path:
     direct `pg` connection to production `DATABASE_URL`
   - Result:
     `training growth SQL contract passed`

Verified contract points:

- core + role skills are present together
- duplicate core/role names collapse to the canonical core skill
- exactly 2 focus skills are accepted in the fixture
- fewer than 2 focus skills are rejected by the database trigger
- structured evidence and phased plans persist in the completed contract
