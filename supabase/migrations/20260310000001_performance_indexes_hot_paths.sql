-- Performance index optimization for high-traffic Supabase query paths.
-- Safe-by-default: every change is guarded by table existence checks and IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
DO $$
BEGIN
  -- Drawings: list/filter/search and duplicate checks
  IF to_regclass('public.drawings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawings_project_number ON public.drawings (project_id, drawing_number)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawings_project_area ON public.drawings (project_id, area_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawings_project_discipline ON public.drawings (project_id, discipline)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawings_project_type ON public.drawings (project_id, drawing_type)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_drawings_project_number ON public.drawings (project_id, drawing_number)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawings_number_trgm ON public.drawings USING gin (drawing_number gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawings_title_trgm ON public.drawings USING gin (title gin_trgm_ops)';
  END IF;

  -- Drawing revisions: latest revisions by drawing
  IF to_regclass('public.drawing_revisions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing_created_desc ON public.drawing_revisions (drawing_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing_rev_desc ON public.drawing_revisions (drawing_id, revision_number DESC)';
  END IF;

  -- Drawing related items: uniqueness checks + list by drawing
  IF to_regclass('public.drawing_related_items') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_drawing_related_items_unique_link ON public.drawing_related_items (drawing_id, related_type, related_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawing_related_items_drawing_created_desc ON public.drawing_related_items (drawing_id, created_at DESC)';
  END IF;

  -- Sketches/downloads: list by revision ordered by time
  IF to_regclass('public.drawing_sketches') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawing_sketches_revision_created_desc ON public.drawing_sketches (drawing_revision_id, created_at DESC)';
  END IF;

  IF to_regclass('public.drawing_downloads') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drawing_downloads_revision_downloaded_desc ON public.drawing_downloads (drawing_revision_id, downloaded_at DESC)';
  END IF;

  -- Punch items: project-scoped list, filters, and next-number lookup
  IF to_regclass('public.punch_items') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_punch_items_project_deleted_number_desc ON public.punch_items (project_id, is_deleted, number DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_punch_items_project_status_priority ON public.punch_items (project_id, status, priority)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_punch_items_project_assignee ON public.punch_items (project_id, assignee_id)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_punch_items_project_number ON public.punch_items (project_id, number)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_punch_items_title_trgm ON public.punch_items USING gin (title gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_punch_items_description_trgm ON public.punch_items USING gin (description gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_punch_items_location_trgm ON public.punch_items USING gin (location gin_trgm_ops)';
  END IF;

  -- Specifications: project list/filter/order + area/revision joins
  IF to_regclass('public.specification_sections') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_sections_project_status_number ON public.specification_sections (project_id, status, section_number)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_sections_project_created_desc ON public.specification_sections (project_id, created_at DESC)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_sections_project_number ON public.specification_sections (project_id, section_number)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_sections_number_trgm ON public.specification_sections USING gin (section_number gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_sections_title_trgm ON public.specification_sections USING gin (title gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_sections_description_trgm ON public.specification_sections USING gin (description gin_trgm_ops)';
  END IF;

  IF to_regclass('public.specification_area_sections') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_area_sections_area_section ON public.specification_area_sections (area_id, section_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_area_sections_section_area ON public.specification_area_sections (section_id, area_id)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_area_sections_link ON public.specification_area_sections (area_id, section_id)';
  END IF;

  IF to_regclass('public.specification_areas') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_areas_project_sort ON public.specification_areas (project_id, sort_order)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_areas_project_name ON public.specification_areas (project_id, name)';
  END IF;

  IF to_regclass('public.specification_section_revisions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spec_revisions_section_rev_desc ON public.specification_section_revisions (section_id, revision_number DESC)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_revisions_section_revision ON public.specification_section_revisions (section_id, revision_number)';
  END IF;

  -- Directory-related hot paths
  IF to_regclass('public.project_companies') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_project_companies_project_status_type ON public.project_companies (project_id, status, company_type)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_project_companies_project_company ON public.project_companies (project_id, company_id)';
  END IF;

  IF to_regclass('public.distribution_groups') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_distribution_groups_project_status_name ON public.distribution_groups (project_id, status, name)';
  END IF;

  IF to_regclass('public.user_activity_log') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_activity_log_project_performed_desc ON public.user_activity_log (project_id, performed_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_activity_log_project_person_performed_desc ON public.user_activity_log (project_id, person_id, performed_at DESC)';
  END IF;

  -- Meetings/documents: extremely frequent type='meeting' + date ordering
  IF to_regclass('public.document_metadata') IS NOT NULL THEN
    EXECUTE $idx$
      CREATE INDEX IF NOT EXISTS idx_document_metadata_meeting_date_desc
      ON public.document_metadata (date DESC)
      WHERE type = 'meeting'
    $idx$;

    EXECUTE $idx$
      CREATE INDEX IF NOT EXISTS idx_document_metadata_project_meeting_date_desc
      ON public.document_metadata (project_id, date DESC)
      WHERE type = 'meeting'
    $idx$;
  END IF;
END
$$;
