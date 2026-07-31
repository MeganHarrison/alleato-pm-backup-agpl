alter table public.user_email_notifications
  add column if not exists drawings_default boolean default false;

comment on column public.user_email_notifications.drawings_default
  is 'Whether the user is subscribed to drawing update notifications for this project.';
