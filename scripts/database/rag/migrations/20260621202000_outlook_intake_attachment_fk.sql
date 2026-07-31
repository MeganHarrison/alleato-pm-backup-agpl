do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'outlook_email_intake_attachments_intake_email_id_fkey'
      and conrelid = 'public.outlook_email_intake_attachments'::regclass
  ) then
    alter table public.outlook_email_intake_attachments
      add constraint outlook_email_intake_attachments_intake_email_id_fkey
      foreign key (intake_email_id)
      references public.outlook_email_intake(id)
      on delete cascade
      not valid;
  end if;
end $$;

alter table public.outlook_email_intake_attachments
  validate constraint outlook_email_intake_attachments_intake_email_id_fkey;

notify pgrst, 'reload schema';
