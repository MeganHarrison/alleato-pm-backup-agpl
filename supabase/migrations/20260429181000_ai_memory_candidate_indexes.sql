-- Add narrow B-tree indexes for AI memory candidate selection.
--
-- Vector distance is only useful after the runtime has already narrowed to a
-- reasonable candidate set. These indexes keep verifier smoke queries and the
-- bounded memory RPCs from scanning wide embedding rows just to find recent or
-- high-importance candidates.

set statement_timeout = 0;
set lock_timeout = '5min';
create index if not exists idx_ai_memories_embedded_recent
  on public.ai_memories (created_at desc)
  where embedding is not null;
create index if not exists idx_ai_memories_user_candidate_rank
  on public.ai_memories (
    user_id,
    is_active,
    type,
    project_id,
    importance desc,
    last_accessed_at desc nulls last,
    created_at desc
  )
  where embedding is not null;
create index if not exists idx_ai_memories_team_candidate_rank
  on public.ai_memories (
    visibility,
    is_active,
    type,
    importance desc,
    last_accessed_at desc nulls last,
    created_at desc
  )
  where embedding is not null;
