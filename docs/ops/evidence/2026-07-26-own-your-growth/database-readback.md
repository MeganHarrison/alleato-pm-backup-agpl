# Database and persistence readback

- Linked Supabase project: `lgveqfnpkxvzbnnwuled`.
- Migration compile preflight: passed inside a forced rollback.
- Applied migration:
  `20260726234500_create_training_growth_checkins.sql`.
- Applied forward hardening migrations:
  - `20260727010000_harden_training_growth_plan_metadata.sql`;
  - `20260727013000_enforce_training_growth_cadence.sql`.
- Linked migration ledger: local and remote entries align for the canonical
  base (`20260726232000`), this action-plan extension (`20260726234500`), and
  score-snapshot hardening (`20260727002000`), legacy/canonical metadata
  hardening (`20260727010000`), and exact cadence enforcement
  (`20260727013000`).
- Transactional database contract:
  `supabase/tests/training_growth_checkins.sql` passed against the linked
  database and rolled back its fixture row.
- The final contract proves:
  - the authenticated owner can insert and read the complete private plan and
    the returned `user_id` is the authenticated owner;
  - a different authenticated user reads zero rows, updates zero rows, and
    cannot insert a row for the owner under RLS;
  - legacy rows have no blank evidence after the repair migration;
  - changing the derived focus selection or canonical description is rejected;
  - a next-check-in date that contradicts the 30/60/90-day cadence is rejected.
- Browser persistence proof: two real authenticated saves returned their rows,
  appeared in history, remained present after full reload, and produced the
  expected cross-check-in average delta.

No service-role client participates in the learner save. The application binds
`user_id` from the authenticated server session, and RLS independently enforces
the same owner boundary.
