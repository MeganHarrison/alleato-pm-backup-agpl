-- Migration: seed_document_type_taxonomy
-- Phase 4 Day 1 — Initial taxonomy rows (23 entries)
-- Applied via Supabase MCP on 2026-05-20.

insert into public.document_type_taxonomy
  (type_key, display_name, category, applies_to, source_system, sort_order)
values
  ('executed_contract',    'Executed Contract',              'contract',      array['commitment','prime_contract'],       null,                10),
  ('contract_proposal',    'Contract Proposal',              'contract',      array['commitment','prime_contract'],       null,                20),
  ('change_order_executed','Executed Change Order',          'contract',      array['change_order','commitment'],         null,                30),
  ('insurance_certificate','Insurance Certificate (COI)',    'compliance',    array['commitment','company'],              null,                40),
  ('lien_waiver_progress', 'Progress Lien Waiver',          'compliance',    array['invoice','commitment'],              null,                50),
  ('lien_waiver_final',    'Final Lien Waiver',             'compliance',    array['invoice','commitment','closeout'],   null,                60),
  ('w9',                   'W-9',                           'compliance',    array['company'],                           null,                70),
  ('closeout_manual',      'Closeout O&M Manual',           'closeout',      array['project','submittal'],               null,                80),
  ('closeout_warranty',    'Closeout Warranty',             'closeout',      array['project','submittal'],               null,                90),
  ('closeout_asbuilt',     'As-Built Drawings',             'closeout',      array['project','drawing'],                 null,               100),
  ('permit',               'Permit',                        'permit',        array['project'],                           null,               110),
  ('permit_inspection',    'Permit Inspection Report',      'permit',        array['project'],                           null,               120),
  ('drawing_revision',     'Drawing Revision',              'drawing',       array['drawing','project'],                 null,               130),
  ('progress_photo',       'Progress Photo',                'photo',         array['project','daily_report'],            null,               140),
  ('email_message',        'Email',                         'communication', array['project'],                           'graph_email',      150),
  ('teams_message',        'Teams Message',                 'communication', array['project'],                           'graph_teams',      160),
  ('meeting_transcript',   'Meeting Transcript',            'communication', array['project','meeting'],                 'fireflies',        170),
  ('invoice_document',     'Invoice Document',              'financial',     array['invoice'],                           null,               180),
  ('submittal',            'Submittal',                     'other',         array['submittal','project'],               null,               190),
  ('rfi_response',         'RFI Response',                  'other',         array['rfi','project'],                     null,               200),
  ('daily_report',         'Daily Report',                  'other',         array['project','daily_report'],            null,               210),
  ('email_attachment',     'Email Attachment',              'communication', array['project','email'],                   'graph_attachment', 220),
  ('other',                'Other',                         'other',         array['project'],                           null,               999)
on conflict (type_key) do nothing;
