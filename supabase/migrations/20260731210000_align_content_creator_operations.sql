begin;

-- The original migration reached production before independent review found
-- that its RPC authorization did not match the existing Content Studio route
-- guard. Keep this repair migration for the applied database while the source
-- migration remains correct for fresh environments.
do $$
declare
  function_signature regprocedure;
  function_definition text;
  corrected_definition text;
begin
  foreach function_signature in array array[
    'public.get_knowledge_content_engagement_summary()'::regprocedure,
    'public.get_knowledge_content_managers()'::regprocedure,
    'public.bulk_update_knowledge_content_governance(uuid[], text, text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(function_signature::oid)
    into function_definition;

    corrected_definition := replace(
      function_definition,
      'public.current_is_learning_admin()',
      'public.current_is_app_admin()'
    );

    if function_signature =
      'public.bulk_update_knowledge_content_governance(uuid[], text, text)'::regprocedure
    then
      corrected_definition := replace(
        corrected_definition,
        'normalized_value::timestamptz',
        'normalized_value::date::timestamp at time zone ''UTC'''
      );
    end if;

    if position(
      'public.current_is_app_admin()' in corrected_definition
    ) = 0 then
      raise exception
        using
          errcode = 'P0001',
          message = format(
            'Content creator authorization repair could not validate %s.',
            function_signature
          );
    end if;

    if function_signature =
      'public.bulk_update_knowledge_content_governance(uuid[], text, text)'::regprocedure
      and position(
        'normalized_value::date::timestamp at time zone ''UTC'''
        in corrected_definition
      ) = 0
    then
      raise exception
        using
          errcode = 'P0001',
          message = 'Content review date repair could not validate calendar-date normalization.';
    end if;

    execute corrected_definition;
  end loop;
end;
$$;

commit;
