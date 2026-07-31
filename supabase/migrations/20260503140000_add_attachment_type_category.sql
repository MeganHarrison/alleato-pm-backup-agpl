alter table email_attachments
  add column if not exists attachment_type text,
  add column if not exists attachment_category text;
