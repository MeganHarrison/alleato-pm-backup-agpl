create table roadmap_items (
  id uuid primary key default gen_random_uuid(),
  phase text not null check (phase in ('in_progress', 'immediate', 'high_priority', 'future')),
  title text not null,
  description text,
  bullet_points text[] default '{}',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed from ROADMAP.md content
insert into roadmap_items (phase, title, description, bullet_points, sort_order) values
(
  'in_progress',
  'Integrated dev environment (AI coding bridge)',
  'Collapses Claude.ai chat, Claude Code in terminal, and Alleato in browser into one workflow. Megan clicks a floating "Report Issue" button, submits a note, and Claude Code diagnoses and replies — all without leaving the app.',
  array[
    'Dev annotation overlay (dev mode only)',
    'Screenshot + URL + element info captured on submit',
    'Claude Code polls for new annotations and posts replies'
  ],
  0
),
(
  'immediate',
  'Client feedback system (triage inbox)',
  'Before any client gets access to Alleato, there needs to be a way for them to report issues and for Megan to manage them. Clients annotate → Megan reviews in triage inbox → Megan decides what happens.',
  array[
    'Client-facing "Leave feedback" button on client-dashboard pages',
    'Internal triage inbox at /feedback with one-click actions',
    'Slack notification on new feedback'
  ],
  0
),
(
  'immediate',
  'Subcontractor invoice & billing submission',
  'Subcontractors submit invoices and sign commitment terms via a magic-link approach — no account creation, no password, no learning curve. Works like DocuSign or Typeform.',
  array[
    'Magic link scoped to commitment (UUID token)',
    'Typed signature + timestamp capture',
    'Admin view: submission status per subcontractor'
  ],
  1
),
(
  'immediate',
  'Nightly proactive intelligence scan',
  'The AI only responds when asked. This makes it proactive — surfacing budget variances, overdue RFIs, and pending COs before anyone thinks to ask.',
  array[
    'Cron job scanning budget variance >8%, overdue RFIs, stale COs',
    'Stores results in proactive_alerts table',
    'Daily digest via email or in-app notification'
  ],
  2
),
(
  'immediate',
  'RFI, RFQ, and submittal workflow',
  'Workflow status progression, notification triggers, and dashboards for RFIs (questions to architects), RFQs (quotes from subs), and submittals (shop drawing approvals).',
  array[
    'Status progression: who does what, in what order',
    'Email/notification triggers at each stage',
    'Dashboard: open RFIs by ball-in-court, overdue submittals by project'
  ],
  3
),
(
  'high_priority',
  'Meeting → project update automation',
  'After a Fireflies meeting is ingested, automatically draft a status update, flag new risks from the transcript, and create tasks from action items — then ask for review before saving.',
  array[
    'Trigger on new meeting transcript ingested',
    'AI extracts risks, action items, and decisions',
    'Review UI: approve/dismiss per item before saving'
  ],
  0
),
(
  'high_priority',
  'Voice-in → action-out (mobile)',
  'Press-hold to record a voice note while driving to a jobsite. AI recognizes intent and creates the right Alleato record.',
  array[
    'Mobile-friendly press-hold voice input in chat',
    'Transcribed via Whisper API',
    'AI calls the appropriate action tool to create the record'
  ],
  1
),
(
  'high_priority',
  'Predictive budget variance model',
  'Owners pay a premium for forward-looking financial visibility. Query historical budget data, find patterns, and show a confidence range for how current projects will trend.',
  array[
    'Pattern: at what % complete do COs typically spike?',
    'Compare current project against comparable completed projects',
    'Output: confidence range displayed in financial dashboard'
  ],
  2
),
(
  'future',
  'Client-facing dashboard (scoped read-only + AI)',
  'Clients log in to see their project in real time and ask the AI questions — no internal notes, no margin data, no subcontractor pricing visible.',
  array[
    'Scoped: client sees ONLY their project',
    'AI filtered: no internal or pricing data',
    'Read-only: no actions for clients'
  ],
  0
),
(
  'future',
  'Agent-to-agent autonomous workflows',
  'Multiple AI agents coordinate to handle end-to-end construction workflows without manual intervention.',
  array[
    'Agents hand off tasks between each other',
    'Human-in-the-loop checkpoints for critical decisions',
    'Full audit trail of agent actions'
  ],
  1
);;
