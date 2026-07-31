-- Final deployment assertion for the ALL-56 integrity boundary. The preceding
-- idempotent migration owns the complete function definitions; this forward
-- marker fails loudly if a deployment did not receive the reviewed versions.

do $$
begin
  if pg_get_functiondef(
    'public.canonicalize_subcontractor_invoice_line_source()'::regprocedure
  ) not ilike '%tg_op = ''INSERT''%'
    or pg_get_functiondef(
      'public.guard_commitment_sov_invoice_history()'::regprocedure
    ) not ilike '%to_jsonb(old)%'
    or pg_get_functiondef(
      'public.update_subcontractor_invoice_line_item(bigint, bigint, bigint, numeric, numeric, numeric, numeric, numeric, numeric)'::regprocedure
    ) not ilike '%signed scheduled value%'
  then
    raise exception
      'Subcontractor invoice SOV integrity functions are not at the reviewed version';
  end if;
end;
$$;
