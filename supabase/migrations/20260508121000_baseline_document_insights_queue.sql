-- Baseline the live private queue/function used by the documents insights trigger.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.document_processing_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempted smallint NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.enqueue_document_for_insights()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
  if (tg_op = 'UPDATE') then
    if (new.processing_status = 'generate_insights'
        and (old.processing_status is distinct from new.processing_status)) then
      insert into private.document_processing_queue(document_id, status, created_at, updated_at)
      select new.id, 'pending', now(), now()
      where not exists (
        select 1 from private.document_processing_queue q
        where q.document_id = new.id and q.status = 'pending'
      );

      perform pg_notify('documents_generate_insights', new.id::text);
    end if;
  end if;

  return new;
end;
$function$;
