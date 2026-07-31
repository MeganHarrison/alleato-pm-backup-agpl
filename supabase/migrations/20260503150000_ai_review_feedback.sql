-- AI document review feedback table — learning loop for document intelligence agent.
-- Every finding from the Document Intelligence Agent writes a row here.
-- Human corrections update it, building the training signal over time.

create table if not exists ai_review_feedback (
  id                      uuid primary key default gen_random_uuid(),
  project_id              integer references projects(id) on delete set null,
  document_id             text,
  review_type             text not null check (review_type in (
                            'submittal_review',
                            'spec_comparison',
                            'drawing_check',
                            'change_detection'
                          )),
  ai_finding              text not null,
  ai_status               text not null check (ai_status in (
                            'Match', 'Missing', 'Conflict', 'Unclear', 'Not Applicable'
                          )),
  ai_confidence           float check (ai_confidence >= 0 and ai_confidence <= 1),
  spec_section            text,
  requirement_type        text,
  human_feedback          text,
  feedback_category       text check (feedback_category in (
                            'correct',
                            'missed_requirement',
                            'wrong_document_match',
                            'bad_interpretation',
                            'hallucinated_issue',
                            'too_vague',
                            'useful_low_priority',
                            'needs_expert_review'
                          )),
  corrected_status        text,
  corrected_reason        text,
  source_of_truth_ref     text,
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create index on ai_review_feedback (project_id);
create index on ai_review_feedback (document_id);
create index on ai_review_feedback (feedback_category);
create index on ai_review_feedback (review_type);
create index on ai_review_feedback (created_at desc);

-- RLS: all authenticated users can read; only the creator can update their own rows
alter table ai_review_feedback enable row level security;

create policy "Authenticated users can read review feedback"
  on ai_review_feedback for select
  to authenticated
  using (true);

create policy "Authenticated users can insert review feedback"
  on ai_review_feedback for insert
  to authenticated
  with check (true);

create policy "Users can update their own review feedback"
  on ai_review_feedback for update
  to authenticated
  using (created_by = auth.uid());
