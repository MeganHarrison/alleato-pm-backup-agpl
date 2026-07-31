-- Migration: backfill_user_profiles
-- Purpose: Insert a user_profiles row for every auth.users row that has no
--          matching profile. This is Phase 1.1 of the auth waterfall fix and
--          must run before the JWT custom-claim hook (Phase 1.3) can read
--          is_admin reliably.
--
-- Required NOT NULL columns with no DB default:
--   id    uuid  (FK → auth.users.id)
--   email text
--
-- All other columns use their DB defaults:
--   is_admin                → false
--   is_active               → true
--   role                    → 'team'
--   created_at / updated_at → CURRENT_TIMESTAMP
--   full_name               → nullable; populated from raw_user_meta_data when present
--   onboarding_completed_at → nullable; left null

insert into public.user_profiles (id, email, full_name)
select
  u.id,
  u.email,
  nullif(trim(u.raw_user_meta_data->>'full_name'), '') as full_name
from auth.users u
left join public.user_profiles p on p.id = u.id
where p.id is null
  and u.email is not null
on conflict (id) do nothing;
