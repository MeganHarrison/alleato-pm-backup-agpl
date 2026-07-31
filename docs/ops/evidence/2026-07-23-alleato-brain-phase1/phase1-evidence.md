# Phase 1 evidence — Business Areas foundation (ALL-7)

Applied: 2026-07-23 ~21:00 UTC via Supabase Management API (project lgveqfnpkxvzbnnwuled)
Migration: `supabase/migrations/20260723180000_create_business_areas_foundation.sql`

## Ledger

- `node scripts/ops/check-supabase-migration-ledger.mjs supabase/migrations/20260723180000_create_business_areas_foundation.sql`
  → **"Supabase migration ledger check passed: 20260723180000"**
- Ledger row: `20260723180000 | create_business_areas_foundation` present in
  `supabase_migrations.schema_migrations`.

## Live read-back (SELECT-only, production)

- Branches seeded (5): leads, ai, **finance (is_restricted=true)**,
  internal-operations, marketing.
- Mapping (5): 60→finance, 89→marketing, 90→internal-operations,
  756→leads, 767→ai (`business_area_project_map`).
- `document_metadata.business_area_id` exists, nullable;
  rows with area set: **0** (42k+ existing rows untouched).
- Policy `document_metadata_select_business_area` present
  (additive OR policy; existing `document_metadata_select` unchanged).
- The five container projects are **unchanged** (still active, not archived):
  60, 89, 90, 756, 767 — per plan, archiving happens only at Phase 6.

## No user-visible change

Nothing in the app reads these tables yet; that is Phase 3–4.

## Fresh readback after Phase 3 authorization publication

Read-only verifier:

```bash
ALLEATO_ENV_FILE=<secure-env> \
  node scripts/database/verify-alleato-brain-foundation.mjs
```

The earlier result at 2026-07-24T04:13:35Z was **PASS** for the then-current
snapshot. Independent review expanded the verifier; its latest run is
intentionally **BLOCKED** because a new Fireflies project-60 row arrived without
the Finance label. Final evidence will replace this snapshot after durable
caller routing lands.

- PM APP project: `lgveqfnpkxvzbnnwuled`
- AI Database project: `fqcvmfqldlewvbsuxdvz`
- Business Areas: 5; mappings: 5; Finance restricted: true
- Membership rows: 0; active Finance memberships: 0 (fail-closed)
- App documents carrying both comparison labels: 2,115
- Current RAG chunks carrying both comparison labels: 12,581
- Current RAG branch count equals current legacy-container count: true
- All five container projects remain unarchived
- `document_metadata_select_business_area` and the existing policies coexist
