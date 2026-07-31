-- Keep linked Outlook surfaces consistent when intake/project_emails already
-- agree on a project but the connected document_metadata row is still null.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

update public.document_metadata dm
set
  project_id = e.project_id,
  project = p.name
from public.outlook_email_intake e
left join public.project_emails pe on pe.id = e.project_email_id
join public.projects p on p.id = e.project_id
where dm.id = e.document_metadata_id
  and dm.project_id is null
  and e.project_id is not null
  and (
    pe.id is null
    or pe.project_id = e.project_id
  );

commit;
