-- Transactional authorization contract for Project Manager role Commitments access.
-- Safe against a linked database: every fixture and mutation rolls back.

begin;

set local search_path = public, extensions;

select plan(19);

select has_function(
  'public',
  'current_has_project_module_permission',
  array['bigint', 'text', 'text'],
  'The shared project module permission helper exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_has_project_module_permission(bigint,text,text)',
    'EXECUTE'
  ),
  'Authenticated users can execute the shared permission helper'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.current_has_project_module_permission(bigint,text,text)',
    'EXECUTE'
  ),
  'Anonymous users cannot execute the shared permission helper'
);

create temporary table pm_role_commitment_test_context (
  project_a bigint not null,
  project_b bigint not null,
  project_manager_role_a uuid not null,
  non_pm_role_a uuid not null,
  active_pm_person uuid not null,
  active_pm_auth uuid not null,
  inactive_pm_person uuid not null,
  inactive_pm_auth uuid not null,
  non_pm_person uuid not null,
  non_pm_auth uuid not null,
  visible_subcontract uuid not null,
  private_subcontract uuid not null
) on commit drop;

do $$
declare
  selected_project_a bigint;
  selected_project_b bigint;
  selected_project_manager_role_a uuid;
  selected_non_pm_role_a uuid := gen_random_uuid();
  selected_active_pm_person uuid := gen_random_uuid();
  selected_active_pm_auth uuid := gen_random_uuid();
  selected_inactive_pm_person uuid := gen_random_uuid();
  selected_inactive_pm_auth uuid := gen_random_uuid();
  selected_non_pm_person uuid := gen_random_uuid();
  selected_non_pm_auth uuid := gen_random_uuid();
  selected_visible_subcontract uuid := gen_random_uuid();
  selected_private_subcontract uuid := gen_random_uuid();
begin
  select pr.project_id, pr.id
  into selected_project_a, selected_project_manager_role_a
  from public.project_roles pr
  where lower(btrim(pr.role_name)) = 'project manager'
  order by pr.project_id
  limit 1;

  select pr.project_id
  into selected_project_b
  from public.project_roles pr
  where lower(btrim(pr.role_name)) = 'project manager'
    and pr.project_id <> selected_project_a
  order by pr.project_id
  limit 1;

  if selected_project_a is null or selected_project_b is null then
    raise exception
      'Project Manager role test requires two projects with Project Manager roles';
  end if;

  insert into public.project_roles (
    id,
    project_id,
    role_name,
    role_type
  )
  values (
    selected_non_pm_role_a,
    selected_project_a,
    'PGTAP Non-PM ' || left(selected_non_pm_role_a::text, 8),
    'Person'
  );

  insert into public.people (
    id,
    first_name,
    last_name,
    person_type,
    status
  )
  values
    (
      selected_active_pm_person,
      'PGTAP',
      'Active PM',
      'employee',
      'active'
    ),
    (
      selected_inactive_pm_person,
      'PGTAP',
      'Inactive PM',
      'employee',
      'inactive'
    ),
    (
      selected_non_pm_person,
      'PGTAP',
      'Non PM',
      'employee',
      'active'
    );

  insert into auth.users (id, aud, role, email)
  values
    (
      selected_active_pm_auth,
      'authenticated',
      'authenticated',
      'pgtap-active-pm-' || left(selected_active_pm_auth::text, 8) ||
        '@example.invalid'
    ),
    (
      selected_inactive_pm_auth,
      'authenticated',
      'authenticated',
      'pgtap-inactive-pm-' || left(selected_inactive_pm_auth::text, 8) ||
        '@example.invalid'
    ),
    (
      selected_non_pm_auth,
      'authenticated',
      'authenticated',
      'pgtap-non-pm-' || left(selected_non_pm_auth::text, 8) ||
        '@example.invalid'
    );

  insert into public.users_auth (auth_user_id, person_id)
  values
    (selected_active_pm_auth, selected_active_pm_person),
    (selected_inactive_pm_auth, selected_inactive_pm_person),
    (selected_non_pm_auth, selected_non_pm_person);

  insert into public.project_role_members (project_role_id, person_id)
  values
    (selected_project_manager_role_a, selected_active_pm_person),
    (selected_project_manager_role_a, selected_inactive_pm_person),
    (selected_non_pm_role_a, selected_non_pm_person);

  insert into public.subcontracts (
    id,
    project_id,
    contract_number,
    title,
    is_private
  )
  values
    (
      selected_visible_subcontract,
      selected_project_a,
      'PGTAP-' || left(selected_visible_subcontract::text, 8),
      'Visible PM role commitment fixture',
      false
    ),
    (
      selected_private_subcontract,
      selected_project_a,
      'PGTAP-' || left(selected_private_subcontract::text, 8),
      'Private PM role commitment fixture',
      true
    );

  insert into pm_role_commitment_test_context
  values (
    selected_project_a,
    selected_project_b,
    selected_project_manager_role_a,
    selected_non_pm_role_a,
    selected_active_pm_person,
    selected_active_pm_auth,
    selected_inactive_pm_person,
    selected_inactive_pm_auth,
    selected_non_pm_person,
    selected_non_pm_auth,
    selected_visible_subcontract,
    selected_private_subcontract
  );
end
$$;

select set_config(
  'test.pm.project_a',
  (select project_a::text from pm_role_commitment_test_context),
  true
);
select set_config(
  'test.pm.project_b',
  (select project_b::text from pm_role_commitment_test_context),
  true
);
select set_config(
  'test.pm.visible_subcontract',
  (select visible_subcontract::text from pm_role_commitment_test_context),
  true
);
select set_config(
  'test.pm.private_subcontract',
  (select private_subcontract::text from pm_role_commitment_test_context),
  true
);

insert into public.user_module_permissions (
  project_id,
  person_id,
  module,
  level
)
select
  project_a,
  active_pm_person,
  'budget',
  'write'
from pm_role_commitment_test_context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select active_pm_auth::text from pm_role_commitment_test_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  visible_fixture_count bigint;
begin
  if not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ) then
    raise exception 'Active Project Manager role did not receive Commitments read';
  end if;

  if not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ) then
    raise exception 'Active Project Manager role did not receive Commitments write';
  end if;

  if public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'admin'
  ) then
    raise exception 'Project Manager role received Commitments admin';
  end if;

  if public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'budget',
    'read'
  ) then
    raise exception 'Project Manager role received an unrelated module';
  end if;

  if public.current_has_project_module_permission(
    current_setting('test.pm.project_b')::bigint,
    'commitments',
    'read'
  ) then
    raise exception 'Project Manager role grant crossed project scope';
  end if;

  if public.current_can_view_private_commitments(
    current_setting('test.pm.project_a')::bigint
  ) then
    raise exception 'Project Manager role received private commitment visibility';
  end if;

  select count(*)
  into visible_fixture_count
  from public.subcontracts
  where id in (
    current_setting('test.pm.visible_subcontract')::uuid,
    current_setting('test.pm.private_subcontract')::uuid
  );

  if visible_fixture_count <> 1 then
    raise exception
      'Commitment RLS exposed % fixtures; expected one non-private row',
      visible_fixture_count;
  end if;
end
$$;

select ok(
  public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ),
  'An active Project Manager role member can read Commitments'
);

select ok(
  public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ),
  'An active Project Manager role member can write Commitments'
);

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'admin'
  ),
  'The Project Manager role does not grant Commitments admin'
);

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'budget',
    'read'
  ),
  'The Project Manager role does not grant unrelated modules'
);

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_b')::bigint,
    'commitments',
    'read'
  ),
  'The Project Manager role grant is scoped to its project'
);

select ok(
  not public.current_can_view_private_commitments(
    current_setting('test.pm.project_a')::bigint
  ),
  'The Project Manager role does not grant private commitment visibility'
);

select is(
  (
    select count(*)
    from public.subcontracts
    where id in (
      current_setting('test.pm.visible_subcontract')::uuid,
      current_setting('test.pm.private_subcontract')::uuid
    )
  ),
  1::bigint,
  'Commitment RLS exposes the non-private fixture and hides the private fixture'
);

insert into public.subcontracts (
  project_id,
  contract_number,
  title,
  is_private
)
values (
  current_setting('test.pm.project_a')::bigint,
  'PGTAP-' || left(gen_random_uuid()::text, 8),
  'Project Manager role insert fixture',
  false
);

select pass(
  'Commitment RLS allows a Project Manager role member to insert'
);

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select non_pm_auth::text from pm_role_commitment_test_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
begin
  if public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ) then
    raise exception 'Non-Project-Manager role received Commitments read';
  end if;
end
$$;

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ),
  'A non-Project-Manager role member receives no Commitments grant'
);

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select inactive_pm_auth::text from pm_role_commitment_test_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
begin
  if public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ) then
    raise exception 'Inactive Project Manager role received Commitments read';
  end if;
end
$$;

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ),
  'An inactive person receives no access from a stale Project Manager role'
);

reset role;

insert into public.user_module_permissions (
  project_id,
  person_id,
  module,
  level
)
select
  project_a,
  active_pm_person,
  'commitments',
  'read'
from pm_role_commitment_test_context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select active_pm_auth::text from pm_role_commitment_test_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
begin
  if not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ) then
    raise exception 'Explicit read override removed Commitments read';
  end if;

  if public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ) then
    raise exception 'Explicit read override did not remove role-derived write';
  end if;
end
$$;

select ok(
  public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ),
  'An explicit read override preserves Commitments read'
);

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ),
  'An explicit read override removes the role-derived write grant'
);

reset role;

update public.user_module_permissions
set level = 'none'
where project_id = (
    select project_a from pm_role_commitment_test_context
  )
  and person_id = (
    select active_pm_person from pm_role_commitment_test_context
  )
  and module = 'commitments';

set local role authenticated;

do $$
begin
  if public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ) or public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ) then
    raise exception 'Explicit none override did not deny role-derived access';
  end if;
end
$$;

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'read'
  ),
  'An explicit none override removes the role-derived read grant'
);

select ok(
  not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ),
  'An explicit none override removes the role-derived write grant'
);

reset role;

update public.user_module_permissions
set level = 'admin'
where project_id = (
    select project_a from pm_role_commitment_test_context
  )
  and person_id = (
    select active_pm_person from pm_role_commitment_test_context
  )
  and module = 'commitments';

set local role authenticated;

do $$
begin
  if not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'admin'
  ) then
    raise exception 'Explicit admin override was not authoritative';
  end if;
end
$$;

select ok(
  public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'admin'
  ),
  'An explicit admin override remains authoritative'
);

reset role;

delete from public.user_module_permissions
where project_id = (
    select project_a from pm_role_commitment_test_context
  )
  and person_id = (
    select active_pm_person from pm_role_commitment_test_context
  )
  and module = 'commitments';

set local role authenticated;

do $$
begin
  if not public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ) then
    raise exception 'Role-derived write was not restored after override deletion';
  end if;
end
$$;

select ok(
  public.current_has_project_module_permission(
    current_setting('test.pm.project_a')::bigint,
    'commitments',
    'write'
  ),
  'Removing the explicit override restores role-derived write'
);

select * from finish();
rollback;
