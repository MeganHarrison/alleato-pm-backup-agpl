# Handoff: Content Display Tabs

Session: S-content-display-tabs
Task: AAI-1295
Status: Complete

## Scope

- `knowledge_content_item.display_area`
- catalog and training-library read views
- Content Studio tabs and editable placement column
- database types, focused tests, and screenshot evidence

## Architecture Decision

`content_kind` describes what a record is. It cannot safely control where the
record appears. A separate display-area enum is the durable placement boundary.

## Evidence

- Live schema now owns `knowledge_content_item.display_area` as
  `knowledge_display_area` with Training, Resources, SOPs, and Documentation.
- Deterministic backfill and insert trigger are applied.
- Learning-admin-only RPC updates placement and fails loudly for unauthorized
  callers or missing content. Anonymous execution is explicitly revoked.
- Content Studio filters a single canonical catalog through URL-backed tabs and
  edits placement through the shared editable-select column.
- Training-library view includes only published Training and Resources content.
- Live distribution: Training 6, Resources 95, SOPs 4, Documentation 95.
- Migration ledger evidence:
  `20260731025204`, `20260731030157`, `20260731030254`.
- Authenticated browser proof passed at `http://localhost:3011/content`.
- Screenshots:
  - `docs/ops/evidence/2026-07-30-content-display-tabs/content-studio-tabs-desktop-final.png`
  - `docs/ops/evidence/2026-07-30-content-display-tabs/content-studio-display-area-select-desktop-final.png`
  - `docs/ops/evidence/2026-07-30-content-display-tabs/content-studio-tabs-mobile-final.png`

## Verification

- ESLint: pass
- Jest: 2 targeted tests pass
- Changed-file typecheck: pass
- Route-name gate: pass
- Shared tabs audit: pass
- Impeccable surface-complexity audit: pass
- Database security/readback: pass
- Exact-file publication to `origin/main`: pass

## Failure Analysis and Prevention

- Cause: content identity and display placement had been conflated, and the
  existing creator role could read broader content than it could safely mutate.
- Detection gap: the catalog did not expose placement as a first-class field,
  and function grants were not explicitly checked for the anonymous role.
- Prevention: enum-backed placement, deterministic insert trigger, scoped
  security-definer RPC, explicit grants, URL-backed tabs, and focused static
  and authenticated browser checks.
- Runtime recovery: a failed inline save preserves the existing placement and
  displays the returned server error so the creator can retry.

## Unrelated Blocks Observed

- The repository-wide migration verifier encounters two unrelated migrations
  with version `20260729190000`; exact ledger readback for this task passed.
- The canonical checkout contains unrelated Platform Kit merge conflicts, so
  repository-wide diff checking cannot pass. No conflicted file was touched.
