---
name: pattern-c-attachment-migration
description: Migrate Alleato PM legacy PURT/entity attachment tables to Pattern C document_metadata plus junction tables. Use when converting *_attachments routes, repairing dual attachment storage, creating Pattern C junctions, reconciling attachment backfills, or dropping legacy attachment tables in alleato-pm.
argument-hint: <legacy table or entity route>
---

# Pattern C Attachment Migration

This skill is for `/Users/meganharrison/Documents/alleato-pm`.

Use it when migrating a legacy attachment surface from a per-entity table such as
`attachments`, `cco_attachments`, `pcco_attachments`, `invoice_attachments`,
`change_event_attachments`, `submittal_attachments`,
`subcontract_attachments`, `purchase_order_attachments`, or
`prime_contract_pco_attachments` to Pattern C:

```text
document_metadata row + entity-specific *_documents junction row
```

## Non-Negotiable Outcome

There must be one attachment writer and one reader path for the entity. Do not
leave a legacy writer feeding a Pattern C reader, or a Pattern C writer feeding a
legacy reader.

## Source Of Truth

Read these before editing:

1. `WORKING_CONTEXT.md`
2. `docs/architecture/DATABASE-ARCHITECTURE.md` Pattern C section
3. `docs/architecture/TASKS-CONSOLIDATED-IMPLEMENTATION.md` Phase 4
4. `docs/architecture/pattern-c-attachment-migration-manifest.json`
5. Existing shared routes:
   - `frontend/src/app/api/document-picker/upload/route.ts`
   - `frontend/src/app/api/document-picker/linked/route.ts`
   - `frontend/src/app/api/document-picker/attach/route.ts`
   - `frontend/src/components/ds/document-picker.tsx`

## Required First Checks

Run these from the repo root before changing files:

```bash
git status --short
rg -n "from\\(\"(attachments|cco_attachments|pcco_attachments|prime_contract_pco_attachments|invoice_attachments|change_event_attachments|submittal_attachments|subcontract_attachments|purchase_order_attachments)\"\\)|from\\('(attachments|cco_attachments|pcco_attachments|prime_contract_pco_attachments|invoice_attachments|change_event_attachments|submittal_attachments|subcontract_attachments|purchase_order_attachments)'\\)" frontend/src -g '*.ts' -g '*.tsx'
```

Then run live counts. Do not trust stale docs for row counts.

```bash
set -a; source .env >/dev/null 2>&1; set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt <<'SQL'
with legacy(table_name, row_count) as (
  values
    ('attachments', (select count(*)::bigint from public.attachments)),
    ('cco_attachments', (select count(*)::bigint from public.cco_attachments)),
    ('pcco_attachments', (select count(*)::bigint from public.pcco_attachments)),
    ('prime_contract_pco_attachments', (select count(*)::bigint from public.prime_contract_pco_attachments)),
    ('invoice_attachments', (select count(*)::bigint from public.invoice_attachments)),
    ('change_event_attachments', (select count(*)::bigint from public.change_event_attachments)),
    ('submittal_attachments', (select count(*)::bigint from public.submittal_attachments)),
    ('subcontract_attachments', (select count(*)::bigint from public.subcontract_attachments)),
    ('purchase_order_attachments', (select count(*)::bigint from public.purchase_order_attachments))
)
select table_name || '|' || row_count from legacy order by table_name;
SQL
```

## Migration Pattern

For each entity, do the work in this order:

1. Confirm the legacy table shape from `information_schema.columns`.
2. Confirm the parent entity table and project access path.
3. Confirm or create the Pattern C junction table.
4. Confirm `public.user_can_access_entity(entity_type, entity_id)` handles the entity.
5. Backfill legacy rows into `document_metadata` using deterministic ids.
6. Backfill junction rows from the deterministic document ids.
7. Rewrite API routes/forms to use `/api/document-picker/upload`,
   `/api/document-picker/linked`, and `/api/document-picker/attach`, or a shared
   registry-backed wrapper around those routes.
8. Remove legacy route code only after all callers are moved.
9. Grep for legacy reads/writes.
10. Drop legacy tables only after live row reconciliation and zero code refs.

## Deterministic IDs

Use stable prefixes so reruns are idempotent:

- `attachments`: `att-<legacy_attachment_id>`
- `change_event_attachments`: `cea-<legacy_attachment_id>`
- `submittal_attachments`: `sa-<legacy_attachment_id>`
- `cco_attachments`: `cco-att-<legacy_attachment_id>`
- `pcco_attachments`: `pcco-att-<legacy_attachment_id>`
- `prime_contract_pco_attachments`: `pcpco-att-<legacy_attachment_id>`
- `invoice_attachments`: `inv-att-<legacy_attachment_id>`
- `subcontract_attachments`: `sub-att-<legacy_attachment_id>`
- `purchase_order_attachments`: `po-att-<legacy_attachment_id>`

Every migrated `document_metadata.source_metadata` object must include:

- `migrated_from`
- `legacy_table`
- `legacy_attachment_id`
- `migrated_at`
- original uploader when present

## Fail Loudly Gates

Stop and fix the root cause if any gate fails:

- A legacy table has rows but the manifest has no mapping.
- Remote migration ledger contains a migration version missing locally.
- A route still writes to a legacy attachment table after the entity is converted.
- A detail page reads Pattern C while create/edit still writes legacy attachments.
- A junction table exists without RLS.
- `user_can_access_entity()` returns false for an entity that should be accessible.
- A drop migration exists before the code reference grep is clean.
- `document_metadata` rows are created without a matching junction row for entity-scoped uploads.

## Verification

Minimum short checks:

```bash
npm run check:routes
rg -n "from\\(\"<legacy_table>\"\\)|from\\('<legacy_table>'\\)" frontend/src -g '*.ts' -g '*.tsx'
npm run db:migrations:verify-applied -- supabase/migrations/<migration>.sql
```

For user-facing upload flows, use `agent-browser` and save artifacts under
`tests/agent-browser-runs/<timestamp>-pattern-c-attachments/`.

Long full builds or broad test suites should be delegated to a cheaper
verification sub-agent when available.

## Completion Report

Report:

- legacy table count before migration
- migrated `document_metadata` count
- migrated junction count
- changed routes/components
- exact verification commands
- what remains blocked or intentionally deferred
- recommended next entity/table
