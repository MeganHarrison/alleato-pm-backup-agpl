# Phase 2 Entity-Relationships Design

**Date:** 2026-05-01
**Branch:** `claude/add-entity-relationships-dmUl4`
**Status:** Approved for migration

---

## Decisions Made (Open Questions Resolved)

### Decision 3a: `link_type` — Include Now

`link_type` is included in all Phase 2 tables as `text not null default 'related'` with a `check` constraint.

**Rationale:** Postgres text-check constraints are the right tool here rather than an enum type. Postgres enums require `ALTER TYPE ... ADD VALUE` to extend, which takes an ACCESS EXCLUSIVE lock in older Postgres versions, and cannot remove values without a table rewrite. A text CHECK constraint can be broadened (`alter table ... drop constraint ...; alter table ... add constraint ...`) in a single DDL statement with no lock escalation. This is the pattern used throughout the existing codebase (see `intelligence_targets.target_type`, `insight_cards.card_type`).

**Chosen value set** for construction PM workflows:
- `related` — generic bidirectional link (default)
- `attachment` — entity A is attached to entity B as supporting documentation
- `reference` — entity A explicitly cites entity B (e.g., RFI references a drawing sheet)
- `supersedes` — entity A replaces entity B (e.g., a revised drawing supersedes the prior revision link)
- `causes` — entity A directly caused entity B (e.g., an RFI triggered a change event)
- `blocks` — entity A is blocking resolution of entity B

Source: Procore's "Related Items" relationship types combined with construction field workflow patterns. The `supersedes` and `blocks` types map directly to schedule dependency semantics common in GC workflows.

### Decision 3b: `entity_links` Unified View — Deferred to Phase 3

The unified `entity_links` view (a `UNION ALL` across all link tables) is deferred.

**Rationale:** Supabase's RLS documentation explicitly warns that views in Postgres do not automatically inherit the RLS policies of underlying tables — the view itself needs a `SECURITY INVOKER` clause (`security_invoker = true`) to propagate the caller's row-level context. Without this, a view that unions 8 tables would bypass the per-table RLS policies on the underlying tables, creating a security hole. Setting `security_invoker = true` on a `UNION ALL` view works, but Supabase's PostgREST layer also has limitations: it cannot push RLS predicates through complex views efficiently, so a UNION ALL view over 8 tables with SECURITY INVOKER will do 8 full RLS evaluations per query. For a "related items" sidebar that needs low latency, this is a poor pattern at scale. The correct Phase 3 approach is a Postgres function (not a view) that accepts entity_type + entity_id parameters and returns only the relevant rows from the one or two link tables that match — eliminating the full UNION ALL scan.

---

## Schema Standard (All Phase 2 Link Tables)

```sql
create table public.{a}_{b}_links (
  id            uuid        primary key default gen_random_uuid(),
  {a}_id        <TYPE>      not null references public.{a_table}(id) on delete cascade,
  {b}_id        <TYPE>      not null references public.{b_table}(id) on delete cascade,
  project_id    integer     not null references public.projects(id) on delete cascade,
  link_type     text        not null default 'related'
                            check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note          text,
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users(id),
  constraint {a}_{b}_links_unique unique ({a}_id, {b}_id, link_type)
);
```

### RLS Strategy

Every link table gets four policies:

1. `SELECT` for `authenticated` — user must be a member of the project (via `project_id` in the projects table they can see)
2. `INSERT` for `authenticated` — same project membership check + `created_by = auth.uid()`
3. `UPDATE` for `authenticated` — only the creator or service role can update
4. `DELETE` for `authenticated` — same as UPDATE

For Phase 2, the select policy uses a simple approach: a user can read link rows if they can read the project. This mirrors the pattern in `commitment_related_items` (the most mature existing related-items table). Full member-table RLS will be a Phase 3 enhancement once the `project_members` table pattern is standardized.

```sql
-- Pattern used for each link table:
alter table public.{a}_{b}_links enable row level security;

create policy "authenticated_select" on public.{a}_{b}_links
  for select to authenticated
  using (
    project_id in (
      select id from public.projects
    )
  );

create policy "authenticated_insert" on public.{a}_{b}_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "creator_delete" on public.{a}_{b}_links
  for delete to authenticated
  using (created_by = (select auth.uid()));
```

---

## Tier 1 Link Tables — Confirmed

### Table 1: `documents_rfis_links`

Connects `project_documents` (bigint) to `rfis` (uuid).

```
project_document_id bigint  -> project_documents(id)
rfi_id              uuid    -> rfis(id)
```

Note: Named `documents_rfis_links` per alphabetical convention; the FK column is `project_document_id` (not `document_id`) to be unambiguous about which document store is referenced.

### Table 2: `documents_submittals_links`

Connects `project_documents` (bigint) to `submittals` (uuid).

```
project_document_id bigint  -> project_documents(id)
submittal_id        uuid    -> submittals(id)
```

### Table 3: `change_events_documents_links`

Connects `change_events` (uuid) to `project_documents` (bigint). Alphabetical: change_events < documents.

```
change_event_id     uuid    -> change_events(id)
project_document_id bigint  -> project_documents(id)
```

### Table 4: `project_photos_punch_items_links`

Connects `project_photos` (bigint) to `punch_items` (uuid).

```
project_photo_id bigint  -> project_photos(id)
punch_item_id    uuid    -> punch_items(id)
```

### Table 5: `observations_project_photos_links`

Connects `observations` (uuid) to `project_photos` (bigint). Alphabetical: observations < project_photos.

```
observation_id   uuid    -> observations(id)
project_photo_id bigint  -> project_photos(id)
```

### Table 6: `daily_logs_project_photos_links`

Connects `daily_logs` (uuid) to `project_photos` (bigint). Alphabetical: daily_logs < project_photos.

```
daily_log_id     uuid    -> daily_logs(id)
project_photo_id bigint  -> project_photos(id)
```

### Table 7: `drawings_rfis_links`

Connects `drawings` (uuid) to `rfis` (uuid).

```
drawing_id uuid -> drawings(id)
rfi_id     uuid -> rfis(id)
```

### Table 8: `rfis_submittals_links`

Connects `rfis` (uuid) to `submittals` (uuid).

```
rfi_id       uuid -> rfis(id)
submittal_id uuid -> submittals(id)
```

---

## Indexes (Each Table)

Two indexes per table minimum:
1. `idx_{table}_a_id` on the first entity FK column
2. `idx_{table}_b_id` on the second entity FK column
3. `idx_{table}_project_id` on `project_id` (for RLS policy performance — see Supabase performance docs on indexing RLS policy columns)

The unique constraint on `(a_id, b_id, link_type)` creates an implicit index covering both entity FK columns for the common case of preventing duplicate links.

---

## Example Queries

### Get all documents linked to an RFI

```sql
select pd.*
from public.project_documents pd
join public.documents_rfis_links l on l.project_document_id = pd.id
where l.rfi_id = $1
  and l.project_id = $2;
```

### Get all RFIs and submittals linked to each other for a project

```sql
select
  r.number as rfi_number,
  r.question,
  s.title as submittal_title,
  l.link_type,
  l.note
from public.rfis_submittals_links l
join public.rfis r on r.id = l.rfi_id
join public.submittals s on s.id = l.submittal_id
where l.project_id = $1
order by r.number;
```

### Insert a link

```sql
insert into public.drawings_rfis_links (drawing_id, rfi_id, project_id, link_type, created_by)
values ($1, $2, $3, 'reference', auth.uid())
on conflict (drawing_id, rfi_id, link_type) do nothing;
```

---

## FK-TYPES-REFERENCE.md Corrections Required

The existing `docs/FK-TYPES-REFERENCE.md` has two confirmed errors:

1. **`rfis` listed as INTEGER** — actual schema: `rfis.id` is UUID. Corrected in the migration.
2. **`tasks`, `risks`, `decisions` listed as "Legacy" INTEGER** — actual schema: all three have `id: string` (UUID). These are AI-extracted tables, not legacy Procore imports. The legacy section of FK-TYPES-REFERENCE.md is misleading.

---

## What Was Not Done in Phase 2

- No changes to any `*_related_items` tables (confirmed: leave alone, schedule deprecation as follow-up)
- No unified `entity_links` view (deferred to Phase 3)
- No changes to `photos` table (deprecated, but safe drop requires `photo_links` migration first)
- No changes to `project_documents` or `project_photos` tables themselves
