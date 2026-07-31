-- ============================================================================
-- Archive-then-delete cleanup of junk directory contacts in public.people
-- ============================================================================
--
-- CONTEXT
--   public.people accumulated email-only import rows that have no real name and
--   no company. Every one of these junk rows is referenced by
--   public.project_contact_references (pcr) — a low-confidence, import/AI-derived
--   "this contact was mentioned in a project document" linkage table
--   (reference_type / source_system / confidence / source_document_metadata_id;
--   pcr.person_id is ON DELETE CASCADE). By decision, pcr is treated as an
--   IMPORT ARTIFACT, not a real reference. So a junk person whose ONLY references
--   are pcr rows is safe to remove.
--
--   This migration is REVERSIBLE: before deleting, it archives the FULL original
--   row of BOTH sides — the people rows AND the pcr rows that the cascade will
--   remove — as JSONB with an archived_at timestamp. Nothing is unrecoverable.
--
-- STRICT DELETION CRITERIA (a person row is deleted only if ALL are true)
--   1. company_id IS NULL                          (unassigned)
--   2. has a non-empty email                       (it is an email row)
--   3. it has no real name, i.e. ONE of:
--        a. first_name AND last_name both empty/null, OR
--        b. last_name empty/null AND first_name equals the email local-part
--           (the name was auto-derived from the email — e.g. "Bconner" for
--           bconner@m-n-a.com), OR
--        c. the name literally equals the full email address.
--      NOTE: a row with a genuine surname is KEPT even if first_name happens to
--      match the email local-part (e.g. "Ben Golden" / ben@goldentaxrelief.com).
--   4. it is referenced by ZERO "real-usage" foreign keys — that is, by NO FK
--      pointing at people.id EXCEPT project_contact_references.person_id.
--      This is enforced DYNAMICALLY below: every FK to people.id is enumerated
--      from the live catalog at apply time (except pcr), and any candidate
--      referenced by one of them is skipped. So a person that gained a real
--      reference (meeting_attendees, tasks, project_role_members, users_auth,
--      companies.primary_contact_id, ...) since analysis is automatically kept,
--      and new FK tables added later are honored without editing this file.
--      (A candidate referenced by neither pcr nor any real-usage table — a pure
--      orphan — also qualifies and is deleted with no cascade rows to archive.)
--   The set of ids is NEVER hardcoded — it is derived live from criteria 1-4.
--
-- IDEMPOTENT
--   Both archive tables are created IF NOT EXISTS. Rows already archived are not
--   re-archived. Once a person is deleted it can no longer match (and its pcr
--   rows are gone), so re-running the migration is a no-op. Row counts are
--   emitted via RAISE NOTICE.
--
-- EXPECTED IMPACT (read-only dry run against PM APP lgveqfnpkxvzbnnwuled,
-- 2026-07-22): 972 people total; 143 match the name/email criteria (1-3); 7 are
-- referenced by real-usage tables and KEPT (meeting_attendees 2, users_auth 1,
-- project_role_members 2, tasks 2); 136 are deletable (132 referenced only by
-- project_contact_references + 4 pure orphans with zero references). Those 136
-- map to ~1095 project_contact_references rows (archived, then cascade-removed).
-- These counts drift as production data changes — the migration recomputes the
-- exact set at apply time and prints the real numbers via RAISE NOTICE.
--
-- HOW TO RESTORE (undo this cleanup) — restore people FIRST, then references
--   The original primary keys and all FK values (person_id, project_id,
--   company_id, ...) are preserved in row_data, so no id remapping is needed —
--   but people must be reinserted before the pcr rows so pcr.person_id resolves.
--
--   Step 1 — restore the deleted people:
--     INSERT INTO public.people
--     SELECT (jsonb_populate_record(NULL::public.people, row_data)).*
--     FROM public.people_archived_junk
--     WHERE archive_reason LIKE 'directory-junk-cleanup%'
--       AND person_id NOT IN (SELECT id FROM public.people);
--
--   Step 2 — restore the cascaded project_contact_references rows:
--     INSERT INTO public.project_contact_references
--     SELECT (jsonb_populate_record(NULL::public.project_contact_references, row_data)).*
--     FROM public.project_contact_references_archived_junk a
--     WHERE a.archive_reason LIKE 'directory-junk-cleanup%'
--       AND a.person_id IN (SELECT id FROM public.people)
--       AND a.reference_id NOT IN (SELECT id FROM public.project_contact_references);
--
--   (Optionally then prune restored rows from the two archive tables.)
-- ============================================================================

begin;

-- 1a. Reversible archive store for people. Full original row as JSONB (schema-
--     drift tolerant). No FK to people, so it survives the delete.
create table if not exists public.people_archived_junk (
  archive_id     bigint generated always as identity primary key,
  person_id      uuid not null,
  archived_at    timestamptz not null default now(),
  archive_reason text not null,
  row_data       jsonb not null
);

create index if not exists idx_people_archived_junk_person_id
  on public.people_archived_junk (person_id);

-- 1b. Companion archive store for the project_contact_references rows that the
--     cascade will remove, so the cascade can be fully reconstructed.
create table if not exists public.project_contact_references_archived_junk (
  archive_id     bigint generated always as identity primary key,
  reference_id   uuid not null,   -- original project_contact_references.id
  person_id      uuid not null,   -- original project_contact_references.person_id
  archived_at    timestamptz not null default now(),
  archive_reason text not null,
  row_data       jsonb not null
);

create index if not exists idx_pcr_archived_junk_person_id
  on public.project_contact_references_archived_junk (person_id);

-- 2. Archive-then-delete, FK-safe by dynamic enumeration.
do $$
declare
  fk record;
  people_deleted bigint := 0;
  people_archived bigint := 0;
  pcr_archived bigint := 0;
  reason constant text :=
    'directory-junk-cleanup: company_id null + email-only/no-real-name + referenced only by project_contact_references';
begin
  -- Candidates: unassigned + has email + no real name (criteria 1-3 above).
  create temporary table _junk_candidates on commit drop as
  select p.id
  from public.people p
  where p.company_id is null
    and nullif(btrim(p.email), '') is not null
    and (
      (coalesce(nullif(btrim(p.first_name), ''), '') = ''
        and coalesce(nullif(btrim(p.last_name), ''), '') = '')
      or (coalesce(nullif(btrim(p.last_name), ''), '') = ''
        and lower(btrim(p.first_name)) = split_part(lower(btrim(p.email)), '@', 1))
      or lower(btrim(p.first_name)) = lower(btrim(p.email))
      or lower(btrim(concat_ws(' ', p.first_name, p.last_name))) = lower(btrim(p.email))
    );

  -- Criterion 4: drop any candidate referenced by ANY live FK to people.id
  -- EXCEPT project_contact_references (the import artifact we are clearing).
  for fk in
    select tc.table_schema  as ref_schema,
           tc.table_name    as ref_table,
           kcu.column_name  as ref_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
     and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'people'
      and ccu.column_name = 'id'
      and not (tc.table_name = 'project_contact_references'
               and kcu.column_name = 'person_id')
  loop
    execute format(
      'delete from _junk_candidates jc where exists '
      || '(select 1 from %I.%I r where r.%I = jc.id)',
      fk.ref_schema, fk.ref_table, fk.ref_column
    );
  end loop;

  -- Archive the project_contact_references rows that will cascade-delete,
  -- BEFORE the delete, skipping any already archived.
  insert into public.project_contact_references_archived_junk
    (reference_id, person_id, archive_reason, row_data)
  select r.id, r.person_id, reason, to_jsonb(r)
  from public.project_contact_references r
  join _junk_candidates jc on jc.id = r.person_id
  where not exists (
    select 1 from public.project_contact_references_archived_junk a
    where a.reference_id = r.id
  );
  get diagnostics pcr_archived = row_count;

  -- Archive the people rows (full original row), skipping any already archived.
  insert into public.people_archived_junk (person_id, archive_reason, row_data)
  select p.id, reason, to_jsonb(p)
  from public.people p
  join _junk_candidates jc on jc.id = p.id
  where not exists (
    select 1 from public.people_archived_junk a where a.person_id = p.id
  );
  get diagnostics people_archived = row_count;

  -- Delete the people rows. project_contact_references rows cascade-delete
  -- (pcr.person_id is ON DELETE CASCADE) and are already archived above.
  delete from public.people p
  using _junk_candidates jc
  where p.id = jc.id;
  get diagnostics people_deleted = row_count;

  raise notice 'directory-junk-cleanup: people archived=%, people deleted=%, project_contact_references rows archived=%',
    people_archived, people_deleted, pcr_archived;
end $$;

commit;
