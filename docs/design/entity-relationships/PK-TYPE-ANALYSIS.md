# Primary Key Type Analysis: INT8 vs UUID in the Alleato-Procore Database

**Date:** 2026-05-01
**Question:** Is it causing a huge mess that the `projects` table uses int8 instead of UUID?
**Short answer:** Yes — and the cost of fixing it now is far higher than the cost of living with it using guardrails.

---

## 1. Current Reality: Mixed PK Landscape

The database is already mixed. Most new tables were created with UUID PKs; older and Procore-imported tables kept INTEGER/bigint.

### INTEGER/bigint PK Tables

| Table | Notes |
|-------|-------|
| `projects` | The root entity — everything hangs off this |
| `project_documents` | bigint, SharePoint-synced files |
| `project_photos` | bigint, active photo store |
| `change_orders` | bigint |
| `contracts` | bigint, legacy financial |
| `prime_contract_change_orders` | bigint |
| `project_emails` | bigint |
| `project_transmittals` | bigint |
| `transmittal_items` | bigint |
| `issues` | bigint |
| `notes` | bigint |
| `estimates` | bigint, PK is `estimate_id` not `id` |
| `employees` | bigint (referenced by RFIs via `ball_in_court_employee_id`) |

### UUID PK Tables (the majority)

`documents`, `rfis`, `submittals`, `change_events`, `prime_contracts`, `subcontracts`, `purchase_orders`, `budget_lines`, `direct_costs`, `daily_logs`, `schedule_tasks`, `punch_items`, `observations`, `inspections`, `specifications`, `drawings`, `people`, `companies`, `subcontractors`, `tasks`, `risks`, `decisions`, `opportunities`, `document_metadata`, `email_messages`, `timesheets`, `attachments` — and all new tables created since approximately 2025-06.

### Scale of the FK Web

121 distinct tables have a foreign key pointing at `projects(id)`. That is the concrete answer to "how many things would break if we changed the PK."

---

## 2. Actual Problems Caused by Mixed PK Types

### 2a. The `rfis` Bug (already caught)

`docs/FK-TYPES-REFERENCE.md` incorrectly lists `rfis` as INTEGER. The actual schema confirms `rfis.id` is UUID. Any developer who trusted that document would write an `INTEGER` FK to `rfis` and get a silent type mismatch. The Audit.md (Phase 1) flagged this. This document corrects it.

**Corrected:** `rfis.id` is `uuid`. FK columns must be `uuid`.

### 2b. The `project_id` Trap

The FK-TYPES-REFERENCE.md notes this has caused bugs 3+ times: a developer creates a new table and writes `project_id uuid` instead of `project_id integer`, breaking every query that joins to `projects`. The error is not always immediate — PostgreSQL implicit casting can mask the type mismatch until an index is involved, causing intermittent performance degradation or silent query plan changes.

### 2c. Cross-Entity Link Table Complexity

When creating join tables between a UUID entity and an INTEGER entity (e.g., `project_documents` bigint and `rfis` uuid), the link table must carry two different FK column types. This is correct SQL but requires developers to verify each type independently. The Phase 1 audit shows several existing link tables got this wrong or were never created because of the complexity.

### 2d. TypeScript Type Confusion

In TypeScript, UUID columns are `string` and INTEGER columns are `number`. A developer who passes `projectId` (type `number`) into a function expecting a UUID entity ID gets a TypeScript error. Conversely, if they use a looser type (`string | number`) to paper over the difference, they mask real bugs. Evidence: `use-photos.ts` correctly casts `parseInt(projectId, 10)` for the `project_id` field — an extra step required only because `projects.id` is integer while the URL parameter is always a string.

### 2e. URL Enumeration

Integer PKs in URLs expose sequential record IDs (`/projects/42`, `/projects/43`). This allows enumeration attacks — a bad actor can iterate project IDs to probe what projects exist. UUID-based URLs are unguessable. For a construction PM SaaS with sensitive financial data, this is a real risk, not a theoretical one.

---

## 3. Postgres/Supabase Best-Practice Guidance

### When UUID is preferred (Supabase's own default)

Supabase's table editor creates new tables with `id uuid primary key default gen_random_uuid()` by default. The Supabase docs state: "UUIDs are ideal when you need globally unique identifiers, especially in distributed systems or when merging data from multiple sources." [Source: Supabase Tables documentation]

UUID advantages:
- Globally unique without coordination — safe for multi-region, multi-source imports
- Non-enumerable — no sequential probing possible
- Can be generated client-side before insert (optimistic UI updates)
- Standard across all Supabase tooling (Storage object names, Auth user IDs)

### When INTEGER/bigint is preferred

Postgres documentation (and Citus/Hyperscale guidance) notes INTEGER PKs have:
- Smaller index footprint: 8 bytes vs 16 bytes per row
- Better B-tree cache locality on sequential scans
- Slightly faster JOINs on large tables due to smaller key comparison

For a Procore import system where `project_id` was originally an integer from Procore's API, keeping INTEGER preserves the natural key from the source system.

### Supabase's practical recommendation

Supabase's own `gen_random_uuid()` default is the answer. They do not recommend INTEGER PKs for user-facing tables. The Supabase MCP documentation (`search_docs` on "primary key") confirms UUID is the recommended default for new tables. INTEGER is acceptable for tables that are direct imports of external systems where the integer IS the external ID.

---

## 4. The True Cost of Migrating `projects.id` to UUID

### Scale

- **121 tables** have a FK to `projects(id)`
- Each FK column must be changed from `integer` to `uuid`
- Every row in every child table must be updated with the new UUID value
- All application code that passes `projectId` as a number must be changed to a string

### Migration Steps Required

```sql
-- 1. Add a uuid column to projects
alter table projects add column uuid_id uuid default gen_random_uuid();
update projects set uuid_id = gen_random_uuid(); -- fill existing rows
alter table projects alter column uuid_id set not null;

-- 2. For EACH of 121 child tables:
alter table budget_lines add column project_uuid uuid;
update budget_lines bl set project_uuid = p.uuid_id from projects p where p.id = bl.project_id;
alter table budget_lines alter column project_uuid set not null;
-- then drop old FK, add new FK on uuid_id

-- 3. Repeat for all 121 tables

-- 4. Drop projects.id, rename uuid_id to id
-- 5. Regenerate all FK constraints
```

### What breaks

- Every API route that reads `projectId` from the URL and passes it to `parseInt()` must change
- Every Supabase query with `.eq("project_id", parseInt(projectId, 10))` must change to `.eq("project_id", projectId)` (string)
- All Procore sync jobs that use Procore's integer project ID must store the mapping separately
- Any external systems (Acumatica ERP sync, which has 10+ tables with `project_id` INTEGER FKs) would need parallel migration
- The migration requires a maintenance window or a multi-phase online migration — with 121 tables and production data, a naive migration would lock every table

### Risk Assessment

This is a **high-risk migration** that touches every table in the database. A production database with 1,700+ documents, 300+ contacts, and active financial data cannot absorb this without careful planning. Estimated engineering effort: 3–5 days of migration + testing + rollback planning.

---

## 5. Recommendation: Three Options Ranked

### Option B (Recommended): Keep Mixed PKs, Build Guardrails

**Keep `projects.id` as bigint. Build tooling to prevent FK type bugs.**

Rationale:
1. The cost of migrating 121 FKs vastly exceeds the benefit at current scale
2. The bugs caused by mixed PKs are preventable with a single reference document (FK-TYPES-REFERENCE.md) and TypeScript types enforcement
3. The `project_id` integer IS Procore's external project ID — keeping it preserves the natural join key for Procore API sync
4. All new tables should be UUID (and they are), so the problem is bounded
5. The FK type errors already documented have been fixed and guardrailed in the reference doc

**Guardrails to add now (included in Phase 2):**
- Fix FK-TYPES-REFERENCE.md (rfis is UUID, not INTEGER)
- Add `project_photos` and `project_documents` to the reference
- Add a Zod/TypeScript lint rule that flags `project_id: z.string()` (should be `z.number()`)
- Add a comment block to the migration template reminding developers to check FK types

### Option C (Viable): Migrate New Tables to UUID, Leave Existing INTEGER Tables

This is essentially the current state — all new tables since 2025 use UUID. The problem is that `projects.id` being INTEGER forces every new table to also have a `project_id integer` column, which is the right call. Option C is already being practiced.

The gap Option C doesn't close: `project_documents` and `project_photos` still have bigint PKs and will be FK targets for the new link tables. The link tables must carry mixed-type FK columns, which is valid but requires explicit documentation.

### Option A (Not Recommended): Full Migration to UUID

Migrating `projects.id` to UUID is architecturally correct but operationally unjustifiable at this stage. The 121-table cascade migration, Procore sync code changes, and Acumatica ERP integration changes represent weeks of work for marginal benefit. This should be revisited only if the platform adds multi-region write replicas or needs to merge project data across deployments — scenarios that don't apply today.

---

## 6. Impact on Entity-Relationships Work (Phase 2)

The mixed PK landscape directly shapes the link table design:

1. **`project_documents` is bigint** — the three `documents_*` link tables must use `bigint` for the `project_document_id` column
2. **`project_photos` is bigint** — the three `project_photos_*` link tables must use `bigint` for the `project_photo_id` column
3. **All other Tier 1 entity pairs are UUID** — `rfis`, `submittals`, `drawings`, `punch_items`, `observations`, `daily_logs`, `change_events` are all UUID PKs
4. **Every link table needs `project_id integer`** — it still FKs to `projects(id)` which is still bigint

The unique constraint on `(entity_a_id, entity_b_id, link_type)` must handle the mixed types, but PostgreSQL has no problem with this — the constraint types match the column types.

**Bottom line:** The mixed PK situation makes Phase 2 slightly more complex (you must verify each entity's PK type before writing the FK) but does not block the work. The `database.types.ts` is the authoritative source — check `id: string` vs `id: number` for each entity before writing a migration.

---

## Summary Table for Quick Reference (Phase 2)

| Entity | PK Type | FK column type in link tables |
|--------|---------|-------------------------------|
| `project_documents` | `bigint` | `bigint` |
| `project_photos` | `bigint` | `bigint` |
| `rfis` | `uuid` | `uuid` |
| `submittals` | `uuid` | `uuid` |
| `drawings` | `uuid` | `uuid` |
| `punch_items` | `uuid` | `uuid` |
| `observations` | `uuid` | `uuid` |
| `daily_logs` | `uuid` | `uuid` |
| `change_events` | `uuid` | `uuid` |
| `projects` | `bigint` | `integer` (as `project_id`) |
