-- Transactional authorization contract for active employee project access.
-- Safe against a linked database: every fixture and mutation rolls back.

begin;

set local search_path = public, extensions;

select plan(13);

select has_function(
  'public',
  'current_has_project_access',
  array['bigint'],
  'The shared project access helper exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_has_project_access(bigint)',
    'EXECUTE'
  ),
  'Authenticated users can execute the project access helper'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.current_has_project_access(bigint)',
    'EXECUTE'
  ),
  'The service role can execute the project access helper'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.current_has_project_access(bigint)',
    'EXECUTE'
  ),
  'Anonymous users cannot execute the project access helper'
);

create temporary table employee_project_access_test_context (
  project_a bigint not null,
  project_b bigint not null,
  access_template uuid not null,
  empty_template uuid not null,
  company_access_template uuid not null,
  company_empty_template uuid not null,
  active_employee_person uuid not null,
  active_employee_auth uuid not null,
  legacy_user_person uuid not null,
  legacy_user_auth uuid not null,
  inactive_employee_person uuid not null,
  inactive_employee_auth uuid not null,
  contact_person uuid not null,
  contact_auth uuid not null,
  inactive_membership_person uuid not null,
  inactive_membership_auth uuid not null,
  empty_template_person uuid not null,
  empty_template_auth uuid not null,
  billing_period uuid not null
) on commit drop;

do $$
declare
  selected_project_a bigint;
  selected_project_b bigint;
  selected_access_template uuid := gen_random_uuid();
  selected_empty_template uuid := gen_random_uuid();
  selected_company_access_template uuid := gen_random_uuid();
  selected_company_empty_template uuid := gen_random_uuid();
  selected_active_employee_person uuid := gen_random_uuid();
  selected_active_employee_auth uuid := gen_random_uuid();
  selected_legacy_user_person uuid := gen_random_uuid();
  selected_legacy_user_auth uuid := gen_random_uuid();
  selected_inactive_employee_person uuid := gen_random_uuid();
  selected_inactive_employee_auth uuid := gen_random_uuid();
  selected_contact_person uuid := gen_random_uuid();
  selected_contact_auth uuid := gen_random_uuid();
  selected_inactive_membership_person uuid := gen_random_uuid();
  selected_inactive_membership_auth uuid := gen_random_uuid();
  selected_empty_template_person uuid := gen_random_uuid();
  selected_empty_template_auth uuid := gen_random_uuid();
  selected_billing_period uuid := gen_random_uuid();
begin
  select p.id
  into selected_project_a
  from public.projects p
  where not exists (
    select 1
    from public.billing_periods bp
    where bp.project_id = p.id
      and bp.start_date = date '1900-01-01'
      and bp.end_date = date '1900-01-31'
  )
  order by p.id
  limit 1;

  select p.id
  into selected_project_b
  from public.projects p
  where p.id <> selected_project_a
  order by p.id
  limit 1;

  if selected_project_a is null or selected_project_b is null then
    raise exception 'Employee project access test requires two projects';
  end if;

  insert into public.permission_templates (
    id,
    name,
    scope,
    rules_json,
    is_system
  )
  values
    (
      selected_access_template,
      'PGTAP Employee Access ' || left(selected_access_template::text, 8),
      'project',
      '{"contracts":["read"]}'::jsonb,
      false
    ),
    (
      selected_empty_template,
      'PGTAP Empty Access ' || left(selected_empty_template::text, 8),
      'project',
      '{}'::jsonb,
      false
    ),
    (
      selected_company_access_template,
      'PGTAP Company Access ' ||
        left(selected_company_access_template::text, 8),
      'company',
      '{"contracts":["read"]}'::jsonb,
      false
    ),
    (
      selected_company_empty_template,
      'PGTAP Company Empty ' ||
        left(selected_company_empty_template::text, 8),
      'company',
      '{}'::jsonb,
      false
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
      selected_active_employee_person,
      'PGTAP',
      'Active Employee',
      'employee',
      'active'
    ),
    (
      selected_legacy_user_person,
      'PGTAP',
      'Legacy User',
      'user',
      'active'
    ),
    (
      selected_inactive_employee_person,
      'PGTAP',
      'Inactive Employee',
      'employee',
      'inactive'
    ),
    (
      selected_contact_person,
      'PGTAP',
      'Contact',
      'contact',
      'active'
    ),
    (
      selected_inactive_membership_person,
      'PGTAP',
      'Inactive Membership',
      'employee',
      'active'
    ),
    (
      selected_empty_template_person,
      'PGTAP',
      'Empty Template',
      'employee',
      'active'
    );

  insert into auth.users (id, aud, role, email)
  values
    (
      selected_active_employee_auth,
      'authenticated',
      'authenticated',
      'pgtap-active-employee-' ||
        left(selected_active_employee_auth::text, 8) ||
        '@example.invalid'
    ),
    (
      selected_legacy_user_auth,
      'authenticated',
      'authenticated',
      'pgtap-legacy-user-' ||
        left(selected_legacy_user_auth::text, 8) ||
        '@example.invalid'
    ),
    (
      selected_inactive_employee_auth,
      'authenticated',
      'authenticated',
      'pgtap-inactive-employee-' ||
        left(selected_inactive_employee_auth::text, 8) ||
        '@example.invalid'
    ),
    (
      selected_contact_auth,
      'authenticated',
      'authenticated',
      'pgtap-contact-' ||
        left(selected_contact_auth::text, 8) ||
        '@example.invalid'
    ),
    (
      selected_inactive_membership_auth,
      'authenticated',
      'authenticated',
      'pgtap-inactive-membership-' ||
        left(selected_inactive_membership_auth::text, 8) ||
        '@example.invalid'
    ),
    (
      selected_empty_template_auth,
      'authenticated',
      'authenticated',
      'pgtap-empty-template-' ||
        left(selected_empty_template_auth::text, 8) ||
        '@example.invalid'
    );

  insert into public.users_auth (auth_user_id, person_id)
  values
    (selected_active_employee_auth, selected_active_employee_person),
    (selected_legacy_user_auth, selected_legacy_user_person),
    (selected_inactive_employee_auth, selected_inactive_employee_person),
    (selected_contact_auth, selected_contact_person),
    (
      selected_inactive_membership_auth,
      selected_inactive_membership_person
    ),
    (selected_empty_template_auth, selected_empty_template_person);

  insert into public.project_directory_memberships (
    project_id,
    person_id,
    permission_template_id,
    status
  )
  values
    (
      selected_project_a,
      selected_active_employee_person,
      selected_access_template,
      'active'
    ),
    (
      selected_project_a,
      selected_legacy_user_person,
      selected_access_template,
      'active'
    ),
    (
      selected_project_a,
      selected_inactive_employee_person,
      selected_access_template,
      'active'
    ),
    (
      selected_project_a,
      selected_contact_person,
      selected_access_template,
      'active'
    ),
    (
      selected_project_a,
      selected_inactive_membership_person,
      selected_access_template,
      'inactive'
    ),
    (
      selected_project_a,
      selected_empty_template_person,
      selected_empty_template,
      'active'
    );

  insert into public.billing_periods (
    id,
    project_id,
    period_number,
    start_date,
    end_date,
    due_date,
    is_closed
  )
  values (
    selected_billing_period,
    selected_project_a,
    991900,
    date '1900-01-01',
    date '1900-01-31',
    date '1900-02-10',
    true
  );

  insert into employee_project_access_test_context
  values (
    selected_project_a,
    selected_project_b,
    selected_access_template,
    selected_empty_template,
    selected_company_access_template,
    selected_company_empty_template,
    selected_active_employee_person,
    selected_active_employee_auth,
    selected_legacy_user_person,
    selected_legacy_user_auth,
    selected_inactive_employee_person,
    selected_inactive_employee_auth,
    selected_contact_person,
    selected_contact_auth,
    selected_inactive_membership_person,
    selected_inactive_membership_auth,
    selected_empty_template_person,
    selected_empty_template_auth,
    selected_billing_period
  );
end
$$;

select set_config(
  'test.employee.project_a',
  (select project_a::text from employee_project_access_test_context),
  true
);
select set_config(
  'test.employee.project_b',
  (select project_b::text from employee_project_access_test_context),
  true
);
select set_config(
  'test.employee.billing_period',
  (select billing_period::text from employee_project_access_test_context),
  true
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (
      select active_employee_auth::text
      from employee_project_access_test_context
    ),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select ok(
  public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ),
  'An active employee with an active access-bearing membership has project access'
);

select ok(
  not public.current_has_project_access(
    current_setting('test.employee.project_b')::bigint
  ),
  'Employee project access does not cross project boundaries'
);

select is(
  (
    select count(*)
    from public.billing_periods
    where id = current_setting('test.employee.billing_period')::uuid
  ),
  1::bigint,
  'Billing-period RLS exposes the project row to the active employee'
);

do $$
declare
  visible_billing_periods bigint;
begin
  if not public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ) then
    raise exception
      'Active employee project access is false; employee identity support regressed';
  end if;

  if public.current_has_project_access(
    current_setting('test.employee.project_b')::bigint
  ) then
    raise exception
      'Active employee project access crossed the project boundary';
  end if;

  select count(*)
  into visible_billing_periods
  from public.billing_periods
  where id = current_setting('test.employee.billing_period')::uuid;

  if visible_billing_periods <> 1 then
    raise exception
      'Billing-period RLS exposed % fixtures; expected one',
      visible_billing_periods;
  end if;
end
$$;

reset role;

insert into public.person_company_templates (person_id, template_id)
select active_employee_person, company_access_template
from employee_project_access_test_context
union all
select inactive_employee_person, company_access_template
from employee_project_access_test_context
union all
select contact_person, company_access_template
from employee_project_access_test_context
union all
select empty_template_person, company_empty_template
from employee_project_access_test_context;

set local role authenticated;

select ok(
  public.current_has_project_access(
    current_setting('test.employee.project_b')::bigint
  ),
  'An active employee access-bearing company template is company-wide'
);

do $$
begin
  if not public.current_has_project_access(
    current_setting('test.employee.project_b')::bigint
  ) then
    raise exception
      'Active employee company-template access did not cross project scope';
  end if;
end
$$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select legacy_user_auth::text from employee_project_access_test_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select ok(
  public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ),
  'Legacy user identities retain project access'
);

do $$
begin
  if not public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ) then
    raise exception 'Legacy user project access regressed';
  end if;
end
$$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (
      select inactive_employee_auth::text
      from employee_project_access_test_context
    ),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select ok(
  not public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ),
  'Inactive employees remain denied even with a company template'
);

do $$
begin
  if public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ) then
    raise exception
      'Inactive employee received access from a company template';
  end if;
end
$$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select contact_auth::text from employee_project_access_test_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select ok(
  not public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ),
  'Contacts do not gain access from an internal company template'
);

do $$
begin
  if public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ) then
    raise exception 'Contact received access from an internal company template';
  end if;
end
$$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (
      select inactive_membership_auth::text
      from employee_project_access_test_context
    ),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select ok(
  not public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ),
  'Inactive project memberships remain denied'
);

do $$
begin
  if public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ) then
    raise exception 'Inactive project membership received access';
  end if;
end
$$;

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (
      select empty_template_auth::text
      from employee_project_access_test_context
    ),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select ok(
  not public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ),
  'Access-empty project and company templates remain denied'
);

do $$
begin
  if public.current_has_project_access(
    current_setting('test.employee.project_a')::bigint
  ) then
    raise exception
      'Access-empty project or company template received project access';
  end if;
end
$$;

select * from finish();
rollback;
