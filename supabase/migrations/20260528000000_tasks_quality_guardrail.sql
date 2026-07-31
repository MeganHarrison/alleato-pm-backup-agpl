-- Guardrail: every new task row must have a usable title, and AI-generated
-- tasks must record which prompt/pipeline produced them.
--
-- Context: 671/969 historical fireflies tasks shipped with `title = null` and
-- `extraction_prompt_version = null`. The frontend then fell back to showing
-- the raw third-person Fireflies action-item text as the task heading, which
-- is what made tasks look nonsensical to assignees. Once the LLM rewriter is
-- in place, NEW rows can never repeat this regression — so guard at the DB.
--
-- Historical rows are left untouched (they're cleaned up via a separate
-- backfill migration). The trigger only fires on INSERT.

CREATE OR REPLACE FUNCTION public.tasks_enforce_quality_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ai_source_systems CONSTANT text[] := ARRAY[
    'fireflies',
    'teams_dm',
    'teams_dm_conversation',
    'teams_message',
    'outlook_email',
    'meeting'
  ];
BEGIN
  IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    RAISE EXCEPTION 'tasks.title is required (got NULL/empty). source_system=%, description=%',
      NEW.source_system,
      left(coalesce(NEW.description, ''), 120)
      USING HINT = 'AI extractors must derive an imperative title (<=10 words). Manual inserts must pass a non-empty title.';
  END IF;

  IF NEW.source_system = ANY (ai_source_systems)
     AND (NEW.extraction_prompt_version IS NULL OR length(trim(NEW.extraction_prompt_version)) = 0) THEN
    RAISE EXCEPTION 'tasks.extraction_prompt_version is required for AI source_system=%, description=%',
      NEW.source_system,
      left(coalesce(NEW.description, ''), 120)
      USING HINT = 'Run the task through fireflies_task_rewriter, task_extraction, or teams_compiler — never insert raw action-item text.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_enforce_quality ON public.tasks;
CREATE TRIGGER trg_tasks_enforce_quality
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_enforce_quality_on_insert();

COMMENT ON FUNCTION public.tasks_enforce_quality_on_insert IS
  'Guardrail added 2026-05-28: blocks NULL/empty title and missing extraction_prompt_version on AI-generated tasks. See docs/patterns/task-quality-prevention.md.';
