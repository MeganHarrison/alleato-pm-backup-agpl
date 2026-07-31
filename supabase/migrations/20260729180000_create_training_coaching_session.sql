-- Manager Coaching Session: a stateful, per-cycle coaching workspace that turns
-- the static "Manager Coaching Guide" article into a real tool. A manager runs a
-- five-step session against a report's Skill Wheel self-assessment, then publishes
-- a shared growth plan to both dashboards.
--
-- SECURITY MODEL (read before editing):
-- The employee's self-assessment (training_skill_checkin) is private and owner-only.
-- A manager gains READ access to a specific check-in ONLY when BOTH are true:
--   (a) a coaching session THEY own references that exact check-in, and
--   (b) the EMPLOYEE has explicitly shared it (assessment_shared_at is set).
-- The employee never writes the session directly: they act through two
-- security-definer RPCs (share_coaching_assessment, confirm_coaching_plan). The
-- guard trigger additionally forbids anyone but the employee from touching the
-- consent columns and re-verifies, on every write, that a referenced check-in
-- belongs to the coached employee (closing the two-step-bind escalation). A
-- manager can therefore never self-grant access to a report's private scores,
-- and never needs a standing "manager-of" hierarchy.
--
-- Manager-private preparation lives in a SEPARATE table
-- (training_coaching_manager_prep) so the employee's row-level read of the
-- session can never expose it.
--
-- Depends on 20260726232000_create_training_skill_growth (training_skill_checkin,
-- training_role), the meetings table, and the shared set_updated_at() helper.

begin;

do $$
begin
  if to_regclass('public.training_skill_checkin') is null
     or to_regclass('public.training_role') is null
     or to_regclass('public.meetings') is null then
    raise exception
      'Manager Coaching Session requires training skill growth and meetings.';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Manager Coaching Session requires public.set_updated_at().';
  end if;
end
$$;

create table if not exists public.training_coaching_session (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  employee_user_id uuid not null
    references auth.users(id) on delete cascade,
  role_id uuid references public.training_role(id) on delete set null,
  role_context_key text not null default 'alleato-core',
  -- Set ONLY by the employee via share_coaching_assessment(); grants the manager
  -- scoped read of this exact check-in.
  source_checkin_id uuid
    references public.training_skill_checkin(id) on delete set null,
  meeting_id uuid references public.meetings(id) on delete set null,
  cycle text not null default 'new',
  status text not null default 'draft',
  current_step smallint not null default 0,
  -- Shared per-skill calibration [{skillId, employeeScore, managerScore,
  -- agreedScore, disagreement, experiment}]. Visible to the coached employee.
  calibration jsonb not null default '[]'::jsonb,
  focus_skill_ids uuid[] not null default '{}'::uuid[],
  -- Practice reps per focus skill [{skillId, action, frequency, evidence,
  -- measure, resource, feedbackOwner, feedbackTurnaround, firstDueDate}].
  practice_plan jsonb not null default '[]'::jsonb,
  stop_doing text,
  manager_support text,
  -- Employee consent to expose source_checkin_id to the manager.
  assessment_shared_at timestamptz,
  -- Manager published the plan; session moves to awaiting_employee.
  published_at timestamptz,
  -- Employee acknowledged the published plan; session becomes active.
  employee_confirmed_at timestamptz,
  review_30_date date,
  review_60_date date,
  review_90_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_coaching_session_distinct_parties_check
    check (manager_user_id <> employee_user_id),
  constraint training_coaching_session_cycle_check
    check (cycle in ('new', '30-day', '60-day', '90-day')),
  constraint training_coaching_session_status_check
    check (status in (
      'draft', 'awaiting_employee', 'active', 'completed', 'archived'
    )),
  constraint training_coaching_session_current_step_check
    check (current_step between 0 and 4),
  constraint training_coaching_session_role_context_key_check
    check (char_length(btrim(role_context_key)) between 1 and 64),
  constraint training_coaching_session_stop_doing_check
    check (stop_doing is null or char_length(stop_doing) <= 1000),
  constraint training_coaching_session_manager_support_check
    check (manager_support is null or char_length(manager_support) <= 1000),
  constraint training_coaching_session_focus_count_check
    check (array_length(focus_skill_ids, 1) is null
           or array_length(focus_skill_ids, 1) <= 4),
  constraint training_coaching_session_calibration_array_check
    check (jsonb_typeof(calibration) = 'array'
           and jsonb_array_length(calibration) <= 20),
  constraint training_coaching_session_practice_plan_array_check
    check (jsonb_typeof(practice_plan) = 'array'
           and jsonb_array_length(practice_plan) <= 4),
  -- A shared assessment must name the check-in it shared.
  constraint training_coaching_session_share_requires_checkin_check
    check (assessment_shared_at is null or source_checkin_id is not null),
  -- Confirmation only after publication.
  constraint training_coaching_session_confirm_after_publish_check
    check (employee_confirmed_at is null or published_at is not null)
);

create index if not exists training_coaching_session_manager_idx
  on public.training_coaching_session(
    manager_user_id, status, updated_at desc
  );

create index if not exists training_coaching_session_employee_idx
  on public.training_coaching_session(employee_user_id, status);

create index if not exists training_coaching_session_source_checkin_idx
  on public.training_coaching_session(source_checkin_id)
  where source_checkin_id is not null;

drop trigger if exists set_training_coaching_session_updated_at
  on public.training_coaching_session;
create trigger set_training_coaching_session_updated_at
before update on public.training_coaching_session
for each row execute function public.set_updated_at();

-- Manager-private preparation, split into its own table so the employee's
-- row-level read of the session can never expose it (RLS cannot mask a column).
create table if not exists public.training_coaching_manager_prep (
  session_id uuid primary key
    references public.training_coaching_session(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_coaching_manager_prep_object_check
    check (jsonb_typeof(content) = 'object')
);

drop trigger if exists set_training_coaching_manager_prep_updated_at
  on public.training_coaching_manager_prep;
create trigger set_training_coaching_manager_prep_updated_at
before update on public.training_coaching_manager_prep
for each row execute function public.set_updated_at();

-- Guard the identity + employee-controlled columns. This is the linchpin of the
-- security model: a manager can never set the fields that grant them read access,
-- and a referenced check-in must always belong to the coached employee.
create or replace function public.guard_training_coaching_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  is_service boolean := (auth.role() = 'service_role');
  touches_consent boolean;
begin
  if is_service then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.manager_user_id is distinct from actor then
      raise exception using
        errcode = '42501',
        message = 'A coaching session must be created by its manager.';
    end if;
    if new.source_checkin_id is not null
       or new.assessment_shared_at is not null
       or new.employee_confirmed_at is not null then
      raise exception using
        errcode = '42501',
        message = 'Employee consent fields cannot be set at session creation.';
    end if;
  else
    -- UPDATE: identity columns are immutable.
    if new.manager_user_id is distinct from old.manager_user_id
       or new.employee_user_id is distinct from old.employee_user_id then
      raise exception using
        errcode = '42501',
        message =
          'The manager and employee on a coaching session cannot change.';
    end if;

    touches_consent :=
      new.source_checkin_id is distinct from old.source_checkin_id
      or new.assessment_shared_at is distinct from old.assessment_shared_at
      or new.employee_confirmed_at is distinct from old.employee_confirmed_at;

    if touches_consent and actor is distinct from old.employee_user_id then
      raise exception using
        errcode = '42501',
        message =
          'Only the employee can share their assessment or confirm the plan.';
    end if;
  end if;

  -- INVARIANT (both INSERT and UPDATE): any referenced check-in must belong to
  -- the coached employee. Enforced unconditionally, not only when the column
  -- changed this statement, so a two-step bind-then-share write cannot smuggle a
  -- third party's check-in into a session.
  if new.source_checkin_id is not null then
    if not exists (
      select 1
      from public.training_skill_checkin checkin
      where checkin.id = new.source_checkin_id
        and checkin.user_id = new.employee_user_id
    ) then
      raise exception using
        errcode = '42501',
        message = 'A shared assessment must belong to the coached employee.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_training_coaching_session() from public;

drop trigger if exists guard_training_coaching_session_write
  on public.training_coaching_session;
create trigger guard_training_coaching_session_write
before insert or update on public.training_coaching_session
for each row execute function public.guard_training_coaching_session();

-- When an employee deletes a check-in that a session shared, tidy the dependent
-- sessions in the same operation so the delete succeeds and no session is left
-- "shared" with a dangling reference.
create or replace function public.clear_coaching_sessions_for_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.training_coaching_session
  set source_checkin_id = null,
      assessment_shared_at = null
  where source_checkin_id = old.id;
  return old;
end;
$$;

revoke all on function public.clear_coaching_sessions_for_checkin() from public;

drop trigger if exists clear_coaching_sessions_before_checkin_delete
  on public.training_skill_checkin;
create trigger clear_coaching_sessions_before_checkin_delete
before delete on public.training_skill_checkin
for each row execute function public.clear_coaching_sessions_for_checkin();

-- The two sanctioned employee actions run as SECURITY DEFINER so the employee
-- needs no direct UPDATE grant on the session (which would let them overwrite the
-- manager's calibration). Each re-checks that the caller is the coached employee.
create or replace function public.share_coaching_assessment(
  p_session_id uuid,
  p_checkin_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee uuid;
  v_status text;
begin
  select employee_user_id, status into v_employee, v_status
  from public.training_coaching_session
  where id = p_session_id;

  if v_employee is null then
    raise exception using
      errcode = '42501', message = 'Coaching session not found.';
  end if;
  if v_employee is distinct from auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'Only the coached employee can share their assessment.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception using
      errcode = '42501',
      message = 'An assessment can only be shared while the session is a draft.';
  end if;
  if not exists (
    select 1 from public.training_skill_checkin checkin
    where checkin.id = p_checkin_id and checkin.user_id = auth.uid()
  ) then
    raise exception using
      errcode = '42501', message = 'You can only share your own assessment.';
  end if;

  update public.training_coaching_session
  set source_checkin_id = p_checkin_id,
      assessment_shared_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.share_coaching_assessment(uuid, uuid) from public;
grant execute on function public.share_coaching_assessment(uuid, uuid)
  to authenticated;

create or replace function public.confirm_coaching_plan(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee uuid;
  v_status text;
begin
  select employee_user_id, status
  into v_employee, v_status
  from public.training_coaching_session
  where id = p_session_id;

  if v_employee is null then
    raise exception using
      errcode = '42501', message = 'Coaching session not found.';
  end if;
  if v_employee is distinct from auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'Only the coached employee can confirm this plan.';
  end if;
  if v_status is distinct from 'awaiting_employee' then
    raise exception using
      errcode = '42501',
      message = 'This plan is not awaiting your confirmation.';
  end if;

  update public.training_coaching_session
  set employee_confirmed_at = now(),
      status = 'active'
  where id = p_session_id;
end;
$$;

revoke all on function public.confirm_coaching_plan(uuid) from public;
grant execute on function public.confirm_coaching_plan(uuid) to authenticated;

alter table public.training_coaching_session enable row level security;
alter table public.training_coaching_manager_prep enable row level security;

-- Manager owns the session lifecycle.
drop policy if exists training_coaching_session_manager_select
  on public.training_coaching_session;
create policy training_coaching_session_manager_select
on public.training_coaching_session
for select
to authenticated
using ((select auth.uid()) = manager_user_id);

drop policy if exists training_coaching_session_manager_insert
  on public.training_coaching_session;
create policy training_coaching_session_manager_insert
on public.training_coaching_session
for insert
to authenticated
with check ((select auth.uid()) = manager_user_id);

drop policy if exists training_coaching_session_manager_update
  on public.training_coaching_session;
create policy training_coaching_session_manager_update
on public.training_coaching_session
for update
to authenticated
using ((select auth.uid()) = manager_user_id)
with check ((select auth.uid()) = manager_user_id);

drop policy if exists training_coaching_session_manager_delete
  on public.training_coaching_session;
create policy training_coaching_session_manager_delete
on public.training_coaching_session
for delete
to authenticated
using ((select auth.uid()) = manager_user_id and status = 'draft');

-- Employee may READ sessions about them (to act on the share request and to see
-- the published plan). They never get UPDATE — the two RPCs above are the only
-- write path, so they cannot alter the manager's calibration or plan.
drop policy if exists training_coaching_session_employee_select
  on public.training_coaching_session;
create policy training_coaching_session_employee_select
on public.training_coaching_session
for select
to authenticated
using ((select auth.uid()) = employee_user_id);

-- Manager-private prep: only the session's manager can touch it. The employee
-- has no policy here at all, so it is invisible to them.
drop policy if exists training_coaching_manager_prep_manager_all
  on public.training_coaching_manager_prep;
create policy training_coaching_manager_prep_manager_all
on public.training_coaching_manager_prep
for all
to authenticated
using (
  exists (
    select 1 from public.training_coaching_session session
    where session.id = training_coaching_manager_prep.session_id
      and session.manager_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.training_coaching_session session
    where session.id = training_coaching_manager_prep.session_id
      and session.manager_user_id = (select auth.uid())
  )
);

-- The cross-user read: a manager may read a check-in ONLY through a session they
-- own that the employee has shared. Permissive → OR'd with the owner-only policy,
-- so it widens read exactly for this consented case and nothing else.
drop policy if exists training_skill_checkin_coaching_manager_select
  on public.training_skill_checkin;
create policy training_skill_checkin_coaching_manager_select
on public.training_skill_checkin
for select
to authenticated
using (
  exists (
    select 1
    from public.training_coaching_session session
    where session.source_checkin_id = training_skill_checkin.id
      and session.manager_user_id = (select auth.uid())
      and session.assessment_shared_at is not null
  )
);

revoke all on public.training_coaching_session from anon;
revoke all on public.training_coaching_manager_prep from anon;
grant select, insert, update, delete
  on public.training_coaching_session to authenticated;
grant select, insert, update, delete
  on public.training_coaching_manager_prep to authenticated;
grant all on public.training_coaching_session to service_role;
grant all on public.training_coaching_manager_prep to service_role;

comment on table public.training_coaching_session is
  'Stateful manager-run coaching sessions calibrated against a report''s Skill Wheel. Access to the shared self-assessment is per-session and employee-consented.';
comment on column public.training_coaching_session.source_checkin_id is
  'The employee training_skill_checkin this session calibrates. Set ONLY via share_coaching_assessment(); grants the manager scoped read of that check-in.';
comment on column public.training_coaching_session.assessment_shared_at is
  'Employee consent timestamp. Until set, the manager cannot read source_checkin_id.';
comment on column public.training_coaching_session.calibration is
  'Shared per-skill calibration paired to scores by skillId; visible to the employee.';
comment on column public.training_coaching_session.practice_plan is
  'Two-to-four focus-skill practice reps published to both dashboards.';
comment on table public.training_coaching_manager_prep is
  'Manager-private coaching preparation. No employee RLS policy exists, so it is never exposed to the coached employee.';

commit;
