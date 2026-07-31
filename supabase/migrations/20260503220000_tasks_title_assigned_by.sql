alter table tasks
  add column if not exists title text,
  add column if not exists assigned_by text;

comment on column tasks.title is 'Short summary of the task (1 sentence)';
comment on column tasks.assigned_by is 'Name of the person who assigned the task (e.g. Brandon)';
