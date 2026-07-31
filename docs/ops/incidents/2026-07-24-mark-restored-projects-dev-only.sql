\set ON_ERROR_STOP on
begin;

-- The 24 restored projects → mark development-only + prefix name with "dev - "
-- (skip re-prefixing if already prefixed, so this is re-runnable)
update public.projects
set is_development = true,
    name = case when name like 'dev - %' then name else 'dev - ' || coalesce(name, '(unnamed)') end
where id in (876,877,800,1067,1009,1008,1096,1102,34,825,178,871,58,1098,886,1026,753,68,98,91,1097,1014,88,1033);

-- Developer role = ONLY megan@megankharrison.com
update public.user_profiles set is_developer = false
where is_developer = true and lower(email) <> 'megan@megankharrison.com';

update public.user_profiles set is_developer = true
where lower(email) = 'megan@megankharrison.com';

-- Verify
select 'dev projects flagged' as check, count(*) n from public.projects where is_development = true;
select id, name, is_development from public.projects where is_development = true order by id limit 30;
select 'developers (expect 1: megan)' as check, count(*) n from public.user_profiles where is_developer = true;
select email, is_developer from public.user_profiles where is_developer = true;

commit;
