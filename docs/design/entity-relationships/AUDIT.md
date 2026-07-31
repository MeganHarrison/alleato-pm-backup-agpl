# Entity Relationships Audit

**Date:** 2026-05-01
**Branch:** `claude/add-entity-relationships-dmUl4`
**Source of truth:** `frontend/src/types/database.types.ts` (regenerated fresh)

---

## 1. Primary Entity Table Inventory

All PK types are verified against freshly generated `database.types.ts` and the linked live database catalog. A live schema query is authoritative when discrepancies are flagged.

### Core Construction Management Entities

| Table | PK Field | TS Type | SQL Type | Notes |
|-------|----------|---------|----------|-------|
| `projects` | `id` | `number` | `bigint` | INTEGER — the #1 FK trap |
| `documents` | `id` | `string` | `uuid` | AI-ingested doc store |
| `project_documents` | `id` | `number` | `bigint` | SharePoint-synced project files; separate from `documents` |
| `photos` | `id` | `string` | `uuid` | Construction site photos |
| `project_photos` | `id` | `number` | `bigint` | Project-scoped photo store (parallel to `photos`) |
| `drawings` | `id` | `string` | `uuid` | Drawing revisions & sets |
| `rfis` | `id` | `string` | `uuid` | **FK-TYPES-REFERENCE.md is wrong** — RFIs are UUID, not INTEGER |
| `submittals` | `id` | `string` | `uuid` | |
| `change_events` | `id` | `string` | `uuid` | |
| `change_orders` | `id` | `string` | `bigint` | **Integer PK** |
| `prime_contracts` | `id` | `string` | `uuid` | |
| `subcontracts` | `id` | `string` | `uuid` | |
| `contracts` | `id` | `number` | `bigint` | Legacy contracts table — **INTEGER PK** |
| `purchase_orders` | `id` | `string` | `uuid` | |
| `budget_lines` | `id` | `string` | `uuid` | |
| `direct_costs` | `id` | `string` | `uuid` | |
| `daily_logs` | `id` | `string` | `uuid` | |
| `schedule_tasks` | `id` | `string` | `uuid` | Project schedule |
| `punch_items` | `id` | `string` | `uuid` | |
| `observations` | `id` | `string` | `uuid` | Field observations |
| `inspections` | `id` | `string` | `uuid` | |
| `specifications` | `id` | `string` | `uuid` | |
| `issues` | `id` | `number` | `bigint` | **INTEGER PK** |
| `notes` | `id` | `number` | `bigint` | **INTEGER PK** |

### AI-Extracted Entities (from document_metadata / meetings ingestion)

These tables store records *extracted* from documents/meetings by AI — they are not directly user-created project records:

| Table | PK Field | TS Type | SQL Type | Notes |
|-------|----------|---------|----------|-------|
| `tasks` | `id` | `string` | `uuid` | AI-extracted tasks from meetings; NOT the project schedule |
| `risks` | `id` | `string` | `uuid` | AI-extracted risks |
| `decisions` | `id` | `string` | `uuid` | AI-extracted decisions |
| `opportunities` | `id` | `string` | `uuid` | AI-extracted opportunities |
| `document_metadata` | `id` | `string` | `uuid` | Meeting transcripts, AI-analyzed docs — the "meetings" entity |

> **Note:** There is no standalone `meetings` or `contacts` table in the schema. Meetings live in `document_metadata` filtered by `category`. Contacts are represented by `people` (uuid PK) and `companies` (uuid PK).

### Communication Entities

| Table | PK Field | TS Type | SQL Type | Notes |
|-------|----------|---------|----------|-------|
| `email_messages` | `id` | `string` | `uuid` | Inbound/outbound emails |
| `project_emails` | `id` | `number` | `bigint` | **INTEGER PK** — project-scoped email index |
| `project_transmittals` | `id` | `number` | `bigint` | **INTEGER PK** |
| `transmittal_items` | `id` | `number` | `bigint` | **INTEGER PK** |

### Directory / People

| Table | PK Field | TS Type | SQL Type | Notes |
|-------|----------|---------|----------|-------|
| `people` | `id` | `string` | `uuid` | Person directory |
| `companies` | `id` | `string` | `uuid` | Company directory |
| `subcontractors` | `id` | `string` | `uuid` | |

### Financial

| Table | PK Field | TS Type | SQL Type | Notes |
|-------|----------|---------|----------|-------|
| `prime_contract_change_orders` | `id` | `number` | `bigint` | **INTEGER PK** |
| `estimates` | `estimate_id` | `number` | `bigint` | **No `id` field** — PK is `estimate_id`, INTEGER |
| `timesheets` | `id` | `string` | `uuid` | |
| `attachments` | `id` | `string` | `uuid` | Generic attachment store |

**Total primary entity tables: ~35** (excluding acumatica sync tables, AI infrastructure, admin/dev tables, views, and RPCs)

---

## 2. Existing Link / Attachment Tables

### 2a. Typed Join Tables (correct approach — strict FK to both sides)

These tables use real FK constraints on both entity sides:

| Table | Entity A | Entity B | A PK Type | B PK Type | RLS | Notes |
|-------|----------|----------|-----------|-----------|-----|-------|
| `submittal_linked_drawings` | `submittals` (uuid) | `drawings` (uuid) | UUID | UUID | Unknown | Minimal — only 3 fields |
| `change_event_pco_links` | `change_events` (uuid) | PCOs (uuid) | UUID | UUID | Unknown | Has `pco_type` to disambiguate PCO variant |
| `cco_attachments` | CCOs | files | — | — | No | File metadata only, no FK to documents |
| `pcco_attachments` | PCCOs (int) | files | INTEGER | — | No | File metadata only |
| `prime_contract_pco_attachments` | PCOs (uuid) | files | UUID | — | No | File metadata only |
| `subcontract_attachments` | `subcontracts` (uuid) | files | UUID | — | Yes | File metadata only |
| `purchase_order_attachments` | `purchase_orders` (uuid) | files | UUID | — | Unknown | File metadata only |
| `change_event_attachments` | `change_events` (uuid) | files | UUID | — | Yes | File metadata only |
| `contract_documents` | `contracts` (bigint) | files | INTEGER | — | No | File metadata + versioning |
| `subcontractor_documents` | `subcontractors` (uuid) | files | UUID | — | Unknown | Document type catalog |
| `submittal_documents` | `submittals` (uuid) | files | UUID | — | No | File metadata + AI analysis |
| `submittal_attachments` | `submittals` (uuid) | distributions | UUID | UUID | Unknown | Links to distribution_id |
| `invoice_attachments` | owner_invoices OR sub_invoices | files | mixed | — | No | Nullable dual-parent (owner_invoice_id OR subcontractor_invoice_id) |
| `observation_photos` | `observations` (uuid) | files | UUID | — | Unknown | File metadata |

### 2b. Polymorphic Related-Items Tables (current anti-pattern — violates typed join table design)

These tables use a `related_type text` discriminator column instead of real FKs. They cannot be JOIN-optimized and have no referential integrity. They predate the typed join table decision.

| Table | Anchor Entity | Polymorphic Side | RLS | Notes |
|-------|---------------|-----------------|-----|-------|
| `change_event_related_items` | `change_events` (uuid) | `related_type + related_id` | No | Most mature — has number/title/status/url caching |
| `commitment_related_items` | subcontracts / POs (uuid, no FK) | `related_type + related_id` | Yes | No FK on commitment_id (spans two tables) |
| `drawing_related_items` | `drawings` (uuid) | `related_type + related_id` | No | Minimal fields |
| `prime_contract_change_order_related_items` | `prime_contract_change_orders` (int) | `related_type + related_id` | Yes | Has full caching fields |
| `subcontractor_invoice_related_items` | subcontractor_invoices (int) | `related_type + related_id` | Unknown | INTEGER invoice_id |

### 2c. photo_links (hybrid polymorphic)

`photo_links` uses `linked_type + linked_id` — same polymorphic pattern as related_items above but for photos.

### 2d. drawing_markup_pins (semi-linked)

`drawing_markup_pins` links drawings to other entities via `entity_id text` + `entity_type` pattern. Not a pure join table; it carries spatial pin data. Acceptable for its use case.

### Key Inconsistencies Identified

1. **RLS gaps**: 10 of 14 attachment tables have RLS disabled.
2. **Polymorphic tables**: 5 existing tables use `related_type + related_id` with no FK integrity — cannot be migrated but must be considered when designing new link tables.
3. **Dual PK type sets**: `documents` (uuid) and `project_documents` (bigint) are parallel entities for different document sources. New link tables must pick one and document which.
4. **Photos duality**: `photos` (uuid) and `project_photos` (bigint) are similarly parallel.
5. **rfis PK discrepancy**: `FK-TYPES-REFERENCE.md` says INTEGER but schema confirms UUID — the reference doc needs updating.
6. **No `meetings` table**: Meetings are rows in `document_metadata` — any link table targeting "meetings" must FK to `document_metadata.id` (uuid).
7. **Estimates use `estimate_id` not `id`**: Any FK to estimates must reference `estimate_id`.

---

## 3. Recommended Link Pairs

### Tier 1 — Must Have (covers active daily workflows)

| # | Table Name | Entity A | A PK | Entity B | B PK | Rationale |
|---|-----------|----------|------|----------|------|-----------|
| 1 | `documents_rfis` | `project_documents` | bigint | `rfis` | uuid | Attach PDF specs/responses to RFIs |
| 2 | `documents_submittals` | `project_documents` | bigint | `submittals` | uuid | Attach shop drawings, cut sheets to submittals |
| 3 | `documents_change_events` | `project_documents` | bigint | `change_events` | uuid | Backup documentation for change events |
| 4 | `photos_punch_items` | `photos` | uuid | `punch_items` | uuid | Photo evidence for punch list items |
| 5 | `photos_observations` | `photos` | uuid | `observations` | uuid | Already partially covered by observation_photos but that is file-metadata-only; this links to the photos store |
| 6 | `photos_daily_logs` | `photos` | uuid | `daily_logs` | uuid | Daily progress photos attached to logs |
| 7 | `rfis_drawings` | `rfis` | uuid | `drawings` | uuid | RFIs reference specific drawing sheets |
| 8 | `rfis_submittals` | `rfis` | uuid | `submittals` | uuid | RFIs that clarify submittal requirements |

### Tier 2 — High Value

| # | Table Name | Entity A | A PK | Entity B | B PK | Rationale |
|---|-----------|----------|------|----------|------|-----------|
| 9 | `documents_meetings` | `project_documents` | bigint | `document_metadata` | uuid | Meeting → minutes/reports |
| 10 | `documents_daily_logs` | `project_documents` | bigint | `daily_logs` | uuid | Daily reports, weather logs |
| 11 | `change_events_rfis` | `change_events` | uuid | `rfis` | uuid | RFI that triggered a change event |
| 12 | `schedule_tasks_rfis` | `schedule_tasks` | uuid | `rfis` | uuid | RFIs that impact schedule tasks |
| 13 | `schedule_tasks_submittals` | `schedule_tasks` | uuid | `submittals` | uuid | Submittals that gate schedule tasks |
| 14 | `punch_items_drawings` | `punch_items` | uuid | `drawings` | uuid | Punch items located on a drawing (complement to markup_pins) |
| 15 | `photos_change_events` | `photos` | uuid | `change_events` | uuid | Photos documenting the change condition |
| 16 | `documents_specifications` | `project_documents` | bigint | `specifications` | uuid | Submitted specs or spec addenda |

### Tier 3 — Nice to Have

| # | Table Name | Entity A | A PK | Entity B | B PK | Rationale |
|---|-----------|----------|------|----------|------|-----------|
| 17 | `rfis_specifications` | `rfis` | uuid | `specifications` | uuid | RFIs clarifying a spec section |
| 18 | `submittals_specifications` | `submittals` | uuid | `specifications` | uuid | Submittal satisfies a spec section |
| 19 | `documents_purchase_orders` | `project_documents` | bigint | `purchase_orders` | uuid | Vendor quotes, PO confirmations |
| 20 | `photos_schedule_tasks` | `photos` | uuid | `schedule_tasks` | uuid | Progress photos tied to a schedule task |
| 21 | `documents_subcontracts` | `project_documents` | bigint | `subcontracts` | uuid | Executed subcontract documents |
| 22 | `photos_rfis` | `photos` | uuid | `rfis` | uuid | Photos uploaded with RFI question or response |
| 23 | `documents_inspections` | `project_documents` | bigint | `inspections` | uuid | Inspection checklists |
| 24 | `observations_rfis` | `observations` | uuid | `rfis` | uuid | Field observation that generated an RFI |

---

## 4. Naming Convention

**Chosen pattern: `{entity_a}_{entity_b}_links`**

Where entity_a and entity_b are the singular snake_case table name roots, ordered **alphabetically** (so `documents_rfis` not `rfis_documents`). Alphabetical ordering ensures there is exactly one canonical name for any pair.

**Rejected alternatives:**
- `{entity_a}_to_{entity_b}`: verbose, harder to grep; `_to_` is ambiguous as a separator.
- `{entity_a}_{entity_b}` (no `_links` suffix): collides too easily with existing compound table names (e.g., `submittal_documents` is already taken for file metadata, not a pure join).
- `entity_links` (generic table): rejected by design decision — polymorphic, no FK integrity.

**Full link table column standard** (every table must have all of these):

```sql
CREATE TABLE public.{entity_a}_{entity_b}_links (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  {entity_a}_id  <PK_TYPE>   NOT NULL REFERENCES public.{entity_a}(id) ON DELETE CASCADE,
  {entity_b}_id  <PK_TYPE>   NOT NULL REFERENCES public.{entity_b}(id) ON DELETE CASCADE,
  project_id     integer     NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  link_type      text        NOT NULL DEFAULT 'related'
                             CHECK (link_type IN ('related', 'attachment', 'reference', 'supersedes')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES auth.users(id),
  UNIQUE (entity_a_id, entity_b_id, link_type)
);
```

**RLS policy** on every table: authenticated users can select/insert/delete (matching the pattern in `commitment_related_items`). Service role gets full access.

---

## 5. Open Questions (max 5)

**Q1 — `project_documents` vs `documents` — which is the canonical "document" entity for links?**

There are two parallel document stores: `project_documents` (bigint PK, SharePoint-synced project files) and `documents` (uuid PK, AI-ingested pipeline). All Tier 1 link table proposals above use `project_documents` (the user-facing file list), but if the intent is to link AI-analyzed documents to RFIs/meetings, the FK needs to go to `documents` instead. Which is the primary entity for user-created document links?

**Q2 — Should existing polymorphic `*_related_items` tables be migrated or kept as-is?**

The 5 existing tables (`change_event_related_items`, `commitment_related_items`, `drawing_related_items`, `prime_contract_change_order_related_items`, `subcontractor_invoice_related_items`) use the polymorphic pattern. Options:
- (a) Leave them alone and add typed join tables for new pairs only.
- (b) Deprecate them in favor of typed join tables and migrate data.
- (c) Extend them with real FK columns while keeping the text fallback for legacy data.

Option (a) is safest for Phase 2 scope and avoids a risky data migration.

**Q3 — Do photos and project_photos need unified treatment?**

`photos` (uuid) is the newer structured store with GPS/markup. `project_photos` (bigint) is the older project-scoped table. For Tier 1 punch_item/observation/daily_log photo links, which table should the FK target? If both are live, should there be one set of link tables per store, or a unified approach?

**Q4 — Should link tables include a `link_type` enum or keep it simple (no type)?**

The proposed schema includes `link_type` with values `(related, attachment, reference, supersedes)`. Some pairs (e.g., `documents_submittals`) have an obvious type (always 'attachment'). Others (e.g., `rfis_drawings`) could be 'reference' or 'related'. Is the `link_type` column worth the complexity, or should Phase 2 start with a single implicit type per table and add `link_type` later?

**Q5 — Should the `entity_links` unified VIEW be part of Phase 2 or deferred?**

Option 1 specifies a unified `entity_links` VIEW that surfaces all typed join table rows through a single query surface. This is useful for a "related items" sidebar component but requires a UNION across all link tables. Should Phase 2 include this view, or should we ship individual link tables first and add the view in Phase 3 once patterns stabilize?
