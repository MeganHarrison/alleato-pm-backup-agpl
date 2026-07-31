do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'durable_ai_turns'
      and column_name = 'command_payload'
  ) then
    raise exception
      'durable_ai_turns.command_payload must exist before refreshing the PostgREST schema cache';
  end if;
end
$$;

comment on column public.durable_ai_turns.command_payload is
  'Immutable accepted command payload used for durable resume.';

notify pgrst, 'reload schema';
