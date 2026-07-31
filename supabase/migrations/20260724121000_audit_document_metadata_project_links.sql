-- Audit project-link changes on document_metadata
--
-- Context: on 2026-07-23 a batch of project deletions unlinked ~2,500 documents.
-- Because document_metadata was not covered by fn_audit_log_generic, there was no
-- record of which document pointed at which project, so the links could not be
-- restored from db_audit_log — only inferred from projects.document_count deltas.
--
-- Why this is NOT just added to the fn_audit_log_generic table list:
-- document_metadata rows average ~4 KB and peak at ~40 KB (content, raw_text,
-- summary_embedding). A full old_data + new_data snapshot across 42k rows is
-- ~341 MB per full rewrite, and the Teams/Outlook/SharePoint syncs rewrite rows
-- continuously. A generic trigger here would grow db_audit_log without bound.
--
-- Instead: a column-scoped trigger that fires ONLY when the project linkage
-- actually changes, and stores only the linkage columns. Payload is ~100 bytes.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create or replace function public.fn_audit_document_project_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_pid integer;
  v_new_pid integer;
  v_old_proj text;
  v_new_proj text;
begin
  if TG_OP = 'DELETE' then
    if OLD.project_id is null and OLD.project is null then
      return OLD;
    end if;
    insert into public.db_audit_log
      (table_name, record_id, operation, changed_by, changed_columns, old_data, new_data)
    values
      (TG_TABLE_NAME, OLD.id::text, 'DELETE', auth.uid(),
       array['project_id', 'project'],
       jsonb_build_object('id', OLD.id, 'project_id', OLD.project_id,
                          'project', OLD.project, 'title', OLD.title),
       null);
    return OLD;
  end if;

  v_new_pid  := NEW.project_id;
  v_new_proj := NEW.project;

  if TG_OP = 'INSERT' then
    -- only log inserts that arrive already linked; unlinked ingest is the norm
    if v_new_pid is null then
      return NEW;
    end if;
    insert into public.db_audit_log
      (table_name, record_id, operation, changed_by, changed_columns, old_data, new_data)
    values
      (TG_TABLE_NAME, NEW.id::text, 'INSERT', auth.uid(),
       array['project_id', 'project'], null,
       jsonb_build_object('id', NEW.id, 'project_id', v_new_pid,
                          'project', v_new_proj, 'title', NEW.title));
    return NEW;
  end if;

  -- UPDATE: only when the linkage itself changed
  v_old_pid  := OLD.project_id;
  v_old_proj := OLD.project;

  if v_old_pid is not distinct from v_new_pid
     and v_old_proj is not distinct from v_new_proj then
    return NEW;
  end if;

  insert into public.db_audit_log
    (table_name, record_id, operation, changed_by, changed_columns, old_data, new_data)
  values
    (TG_TABLE_NAME, NEW.id::text, 'UPDATE', auth.uid(),
     array(select c from unnest(array['project_id', 'project']) as c
           where (c = 'project_id' and v_old_pid is distinct from v_new_pid)
              or (c = 'project'    and v_old_proj is distinct from v_new_proj)),
     jsonb_build_object('id', OLD.id, 'project_id', v_old_pid,
                        'project', v_old_proj, 'title', OLD.title),
     jsonb_build_object('id', NEW.id, 'project_id', v_new_pid,
                        'project', v_new_proj, 'title', NEW.title));
  return NEW;
end;
$$;

comment on function public.fn_audit_document_project_link() is
  'Column-scoped audit trigger: records document_metadata project linkage changes '
  '(project_id, project) into db_audit_log. Deliberately narrower than '
  'fn_audit_log_generic to avoid storing multi-KB content/embedding snapshots.';

drop trigger if exists trg_audit_project_link on public.document_metadata;

create trigger trg_audit_project_link
after insert or update or delete on public.document_metadata
for each row execute function public.fn_audit_document_project_link();

commit;
