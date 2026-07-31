-- Match the database contract to the application rule: the planned follow-up
-- date is exactly the selected 30, 60, or 90 days after the check-in.

begin;

alter table public.training_skill_checkin
  drop constraint if exists training_skill_checkin_next_date_check;

alter table public.training_skill_checkin
  add constraint training_skill_checkin_next_date_check
    check (next_checkin_date = checkin_date + rescore_days);

commit;
