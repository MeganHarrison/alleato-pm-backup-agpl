-- =============================================================================
-- Migration: Wrap bare auth.uid() in (select auth.uid()) across all RLS policies
-- =============================================================================
-- Purpose: Performance optimization — the subquery form (select auth.uid()) is
--          evaluated once per query, whereas bare auth.uid() is re-evaluated per
--          row. For tables with many rows this can be a significant speedup.
--
-- Scope:   public schema only. System schemas (auth, storage, realtime, vault)
--          are intentionally skipped.
--
-- Safety:  Each policy is dropped and recreated with IDENTICAL logic, roles,
--          and clauses — only auth.uid() is replaced with (select auth.uid()).
--
-- Apply:   psql or Supabase dashboard → SQL Editor. Review before applying.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Table: admin_feedback_comments
-- -----------------------------------------------------------------------------

drop policy if exists "Admin users can manage feedback comments" on public.admin_feedback_comments;
create policy "Admin users can manage feedback comments"
  on public.admin_feedback_comments
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))));

-- -----------------------------------------------------------------------------
-- Table: ai_feedback_events
-- -----------------------------------------------------------------------------

drop policy if exists "ai_feedback_events_insert_own" on public.ai_feedback_events;
create policy "ai_feedback_events_insert_own"
  on public.ai_feedback_events
  FOR INSERT
  to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "ai_feedback_events_select" on public.ai_feedback_events;
create policy "ai_feedback_events_select"
  on public.ai_feedback_events
  FOR SELECT
  to authenticated
  using ((current_is_app_admin() OR (user_id = (select auth.uid())) OR ((project_id IS NOT NULL) AND (event_family <> 'user_preference'::text) AND (COALESCE((metadata ->> 'visibility'::text), 'team'::text) <> 'private'::text) AND current_is_project_member((project_id)::bigint)) OR (EXISTS ( SELECT 1
   FROM intelligence_targets t
  WHERE ((t.id = ai_feedback_events.target_id) AND (t.target_type = 'client_project'::text) AND (t.project_id IS NOT NULL) AND (ai_feedback_events.event_family <> 'user_preference'::text) AND (COALESCE((t.metadata ->> 'visibility'::text), 'team'::text) <> 'private'::text) AND current_is_project_member((t.project_id)::bigint))))));

-- -----------------------------------------------------------------------------
-- Table: ai_memories
-- -----------------------------------------------------------------------------

drop policy if exists "Users can manage their own memories" on public.ai_memories;
create policy "Users can manage their own memories"
  on public.ai_memories
  FOR ALL
  to public
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- -----------------------------------------------------------------------------
-- Table: ai_retrieval_feedback
-- -----------------------------------------------------------------------------

drop policy if exists "ai_retrieval_feedback_insert_own" on public.ai_retrieval_feedback;
create policy "ai_retrieval_feedback_insert_own"
  on public.ai_retrieval_feedback
  FOR INSERT
  to authenticated
  with check ((user_id = (select auth.uid())));

drop policy if exists "ai_retrieval_feedback_select" on public.ai_retrieval_feedback;
create policy "ai_retrieval_feedback_select"
  on public.ai_retrieval_feedback
  FOR SELECT
  to authenticated
  using ((current_is_app_admin() OR (user_id = (select auth.uid())) OR ((project_id IS NOT NULL) AND (COALESCE((metadata ->> 'visibility'::text), 'team'::text) <> 'private'::text) AND current_is_project_member((project_id)::bigint)) OR (EXISTS ( SELECT 1
   FROM intelligence_targets t
  WHERE ((t.id = ai_retrieval_feedback.target_id) AND (t.target_type = 'client_project'::text) AND (t.project_id IS NOT NULL) AND (COALESCE((t.metadata ->> 'visibility'::text), 'team'::text) <> 'private'::text) AND current_is_project_member((t.project_id)::bigint))))));

-- -----------------------------------------------------------------------------
-- Table: ai_review_feedback
-- -----------------------------------------------------------------------------

drop policy if exists "Users can update their own review feedback" on public.ai_review_feedback;
create policy "Users can update their own review feedback"
  on public.ai_review_feedback
  FOR UPDATE
  to authenticated
  using ((created_by = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: ai_task_feedback
-- -----------------------------------------------------------------------------

drop policy if exists "admins can read all task feedback" on public.ai_task_feedback;
create policy "admins can read all task feedback"
  on public.ai_task_feedback
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))));

drop policy if exists "users can manage own task feedback" on public.ai_task_feedback;
create policy "users can manage own task feedback"
  on public.ai_task_feedback
  FOR ALL
  to public
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- -----------------------------------------------------------------------------
-- Table: bot_user_mappings
-- -----------------------------------------------------------------------------

drop policy if exists "Users can insert their own mappings" on public.bot_user_mappings;
create policy "Users can insert their own mappings"
  on public.bot_user_mappings
  FOR INSERT
  to public
  with check ((supabase_user_id = (select auth.uid())));

drop policy if exists "Users can read their own mappings" on public.bot_user_mappings;
create policy "Users can read their own mappings"
  on public.bot_user_mappings
  FOR SELECT
  to public
  using ((supabase_user_id = (select auth.uid())));

drop policy if exists "Users can update their own mappings" on public.bot_user_mappings;
create policy "Users can update their own mappings"
  on public.bot_user_mappings
  FOR UPDATE
  to public
  using ((supabase_user_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: budget_forecast_line_items
-- -----------------------------------------------------------------------------

drop policy if exists "budget_forecast_line_items_delete" on public.budget_forecast_line_items;
create policy "budget_forecast_line_items_delete"
  on public.budget_forecast_line_items
  FOR DELETE
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "budget_forecast_line_items_insert" on public.budget_forecast_line_items;
create policy "budget_forecast_line_items_insert"
  on public.budget_forecast_line_items
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "budget_forecast_line_items_select" on public.budget_forecast_line_items;
create policy "budget_forecast_line_items_select"
  on public.budget_forecast_line_items
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "budget_forecast_line_items_update" on public.budget_forecast_line_items;
create policy "budget_forecast_line_items_update"
  on public.budget_forecast_line_items
  FOR UPDATE
  to public
  using (((select auth.uid()) IS NOT NULL))
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: budget_line_forecasts
-- -----------------------------------------------------------------------------

drop policy if exists "budget_line_forecasts_delete_policy" on public.budget_line_forecasts;
create policy "budget_line_forecasts_delete_policy"
  on public.budget_line_forecasts
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM (((budget_lines bl
     JOIN project_directory_memberships pdm ON ((pdm.project_id = bl.project_id)))
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((bl.id = budget_line_forecasts.budget_line_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND (pdm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text]))))));

drop policy if exists "budget_line_forecasts_insert_policy" on public.budget_line_forecasts;
create policy "budget_line_forecasts_insert_policy"
  on public.budget_line_forecasts
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM (((budget_lines bl
     JOIN project_directory_memberships pdm ON ((pdm.project_id = bl.project_id)))
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((bl.id = budget_line_forecasts.budget_line_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND (pdm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'member'::text]))))));

drop policy if exists "budget_line_forecasts_select_policy" on public.budget_line_forecasts;
create policy "budget_line_forecasts_select_policy"
  on public.budget_line_forecasts
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (((budget_lines bl
     JOIN project_directory_memberships pdm ON ((pdm.project_id = bl.project_id)))
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((bl.id = budget_line_forecasts.budget_line_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "budget_line_forecasts_update_policy" on public.budget_line_forecasts;
create policy "budget_line_forecasts_update_policy"
  on public.budget_line_forecasts
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (((budget_lines bl
     JOIN project_directory_memberships pdm ON ((pdm.project_id = bl.project_id)))
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((bl.id = budget_line_forecasts.budget_line_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND (pdm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'member'::text]))))));

-- -----------------------------------------------------------------------------
-- Table: budget_modification_lines
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view budget modification lines" on public.budget_modification_lines;
create policy "Users can view budget modification lines"
  on public.budget_modification_lines
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: budget_snapshots
-- -----------------------------------------------------------------------------

drop policy if exists "budget_snapshots_delete_policy" on public.budget_snapshots;
create policy "budget_snapshots_delete_policy"
  on public.budget_snapshots
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = budget_snapshots.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND (pdm.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

drop policy if exists "budget_snapshots_insert_policy" on public.budget_snapshots;
create policy "budget_snapshots_insert_policy"
  on public.budget_snapshots
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = budget_snapshots.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND (pdm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text]))))));

drop policy if exists "budget_snapshots_select_policy" on public.budget_snapshots;
create policy "budget_snapshots_select_policy"
  on public.budget_snapshots
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = budget_snapshots.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "budget_snapshots_update_policy" on public.budget_snapshots;
create policy "budget_snapshots_update_policy"
  on public.budget_snapshots
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = budget_snapshots.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND (pdm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text]))))));

-- -----------------------------------------------------------------------------
-- Table: cco_attachments
-- -----------------------------------------------------------------------------

drop policy if exists "cco_attachments_delete" on public.cco_attachments;
create policy "cco_attachments_delete"
  on public.cco_attachments
  FOR DELETE
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "cco_attachments_insert" on public.cco_attachments;
create policy "cco_attachments_insert"
  on public.cco_attachments
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "cco_attachments_select" on public.cco_attachments;
create policy "cco_attachments_select"
  on public.cco_attachments
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: change_events_documents_links
-- -----------------------------------------------------------------------------

drop policy if exists "change_events_documents_links_delete" on public.change_events_documents_links;
create policy "change_events_documents_links_delete"
  on public.change_events_documents_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "change_events_documents_links_insert" on public.change_events_documents_links;
create policy "change_events_documents_links_insert"
  on public.change_events_documents_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: change_workflow_comments
-- -----------------------------------------------------------------------------

drop policy if exists "cwc_delete" on public.change_workflow_comments;
create policy "cwc_delete"
  on public.change_workflow_comments
  FOR DELETE
  to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "cwc_update" on public.change_workflow_comments;
create policy "cwc_update"
  on public.change_workflow_comments
  FOR UPDATE
  to authenticated
  using ((author_id = (select auth.uid())))
  with check ((author_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: change_workflow_notifications
-- -----------------------------------------------------------------------------

drop policy if exists "cwn_select" on public.change_workflow_notifications;
create policy "cwn_select"
  on public.change_workflow_notifications
  FOR SELECT
  to authenticated
  using ((recipient_id = (select auth.uid())));

drop policy if exists "cwn_update" on public.change_workflow_notifications;
create policy "cwn_update"
  on public.change_workflow_notifications
  FOR UPDATE
  to authenticated
  using ((recipient_id = (select auth.uid())))
  with check ((recipient_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: collaboration_comments
-- -----------------------------------------------------------------------------

drop policy if exists "collaboration_comments_insert_authenticated" on public.collaboration_comments;
create policy "collaboration_comments_insert_authenticated"
  on public.collaboration_comments
  FOR INSERT
  to authenticated
  with check (((select auth.uid()) = author_id));

drop policy if exists "collaboration_comments_update_author" on public.collaboration_comments;
create policy "collaboration_comments_update_author"
  on public.collaboration_comments
  FOR UPDATE
  to authenticated
  using (((select auth.uid()) = author_id))
  with check (((select auth.uid()) = author_id));

-- -----------------------------------------------------------------------------
-- Table: collaboration_notifications
-- -----------------------------------------------------------------------------

drop policy if exists "collaboration_notifications_select_owner" on public.collaboration_notifications;
create policy "collaboration_notifications_select_owner"
  on public.collaboration_notifications
  FOR SELECT
  to authenticated
  using ((((select auth.uid()) = user_id) AND (deleted_at IS NULL)));

drop policy if exists "collaboration_notifications_update_owner" on public.collaboration_notifications;
create policy "collaboration_notifications_update_owner"
  on public.collaboration_notifications
  FOR UPDATE
  to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- -----------------------------------------------------------------------------
-- Table: commitment_change_order_lines
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view commitment change order lines" on public.commitment_change_order_lines;
create policy "Users can view commitment change order lines"
  on public.commitment_change_order_lines
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: commitment_related_items
-- -----------------------------------------------------------------------------

drop policy if exists "commitment_related_items_delete" on public.commitment_related_items;
create policy "commitment_related_items_delete"
  on public.commitment_related_items
  FOR DELETE
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "commitment_related_items_insert" on public.commitment_related_items;
create policy "commitment_related_items_insert"
  on public.commitment_related_items
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: contract_views
-- -----------------------------------------------------------------------------

drop policy if exists "Users can create their own views" on public.contract_views;
create policy "Users can create their own views"
  on public.contract_views
  FOR INSERT
  to public
  with check ((user_id = (select auth.uid())));

drop policy if exists "Users can delete their own views" on public.contract_views;
create policy "Users can delete their own views"
  on public.contract_views
  FOR DELETE
  to public
  using ((user_id = (select auth.uid())));

drop policy if exists "Users can update their own views" on public.contract_views;
create policy "Users can update their own views"
  on public.contract_views
  FOR UPDATE
  to public
  using ((user_id = (select auth.uid())));

drop policy if exists "Users can view their own views" on public.contract_views;
create policy "Users can view their own views"
  on public.contract_views
  FOR SELECT
  to public
  using ((user_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: conversations
-- -----------------------------------------------------------------------------

drop policy if exists "Users can insert their own conversations" on public.conversations;
create policy "Users can insert their own conversations"
  on public.conversations
  FOR INSERT
  to public
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can update their own conversations" on public.conversations;
create policy "Users can update their own conversations"
  on public.conversations
  FOR UPDATE
  to public
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can view their own conversations" on public.conversations;
create policy "Users can view their own conversations"
  on public.conversations
  FOR SELECT
  to public
  using (((select auth.uid()) = user_id));

-- -----------------------------------------------------------------------------
-- Table: daily_logs_project_photos_links
-- -----------------------------------------------------------------------------

drop policy if exists "daily_logs_project_photos_links_delete" on public.daily_logs_project_photos_links;
create policy "daily_logs_project_photos_links_delete"
  on public.daily_logs_project_photos_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "daily_logs_project_photos_links_insert" on public.daily_logs_project_photos_links;
create policy "daily_logs_project_photos_links_insert"
  on public.daily_logs_project_photos_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: design_violations
-- -----------------------------------------------------------------------------

drop policy if exists "Users manage own violations" on public.design_violations;
create policy "Users manage own violations"
  on public.design_violations
  FOR ALL
  to public
  using (((select auth.uid()) = submitted_by))
  with check (((select auth.uid()) = submitted_by));

-- -----------------------------------------------------------------------------
-- Table: dev_annotations
-- -----------------------------------------------------------------------------

drop policy if exists "Users can manage own annotations" on public.dev_annotations;
create policy "Users can manage own annotations"
  on public.dev_annotations
  FOR ALL
  to public
  using (((select auth.uid()) = created_by))
  with check (((select auth.uid()) = created_by));

-- -----------------------------------------------------------------------------
-- Table: dev_panel_comments
-- -----------------------------------------------------------------------------

drop policy if exists "dev_panel_comments_delete" on public.dev_panel_comments;
create policy "dev_panel_comments_delete"
  on public.dev_panel_comments
  FOR DELETE
  to public
  using (((select auth.uid()) = author_id));

drop policy if exists "dev_panel_comments_insert" on public.dev_panel_comments;
create policy "dev_panel_comments_insert"
  on public.dev_panel_comments
  FOR INSERT
  to public
  with check ((((select auth.uid()) = author_id) OR (author_id IS NULL)));

drop policy if exists "dev_panel_comments_update" on public.dev_panel_comments;
create policy "dev_panel_comments_update"
  on public.dev_panel_comments
  FOR UPDATE
  to public
  using (((select auth.uid()) = author_id));

-- -----------------------------------------------------------------------------
-- Table: distribution_groups
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view groups in their projects" on public.distribution_groups;
create policy "Users can view groups in their projects"
  on public.distribution_groups
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = distribution_groups.project_id) AND (pdm.status = 'active'::text) AND (ua.auth_user_id = (select auth.uid()))))));

drop policy if exists "Users with directory:admin can manage groups" on public.distribution_groups;
create policy "Users with directory:admin can manage groups"
  on public.distribution_groups
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((pdm.project_id = distribution_groups.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND ((pt.rules_json -> 'directory'::text) ? 'admin'::text)))));

-- -----------------------------------------------------------------------------
-- Table: document_chunks
-- -----------------------------------------------------------------------------

drop policy if exists "document_chunks_select" on public.document_chunks;
create policy "document_chunks_select"
  on public.document_chunks
  FOR SELECT
  to authenticated
  using ((current_is_app_admin() OR (EXISTS ( SELECT 1
   FROM document_metadata dm
  WHERE ((dm.id = document_chunks.document_id) AND (COALESCE(dm.category, ''::text) <> ALL (ARRAY['email'::text, 'teams_message'::text])) AND (((dm.project_id IS NOT NULL) AND current_is_project_member(dm.project_id)) OR (dm.access_level = 'team'::text) OR (EXISTS ( SELECT 1
           FROM document_user_access dua
          WHERE ((dua.document_id = dm.id) AND (dua.user_id = (select auth.uid())))))))))));

-- -----------------------------------------------------------------------------
-- Table: document_metadata
-- -----------------------------------------------------------------------------

drop policy if exists "document_metadata_select" on public.document_metadata;
create policy "document_metadata_select"
  on public.document_metadata
  FOR SELECT
  to authenticated
  using ((current_is_app_admin() OR ((COALESCE(category, ''::text) <> ALL (ARRAY['email'::text, 'teams_message'::text])) AND (((project_id IS NOT NULL) AND current_is_project_member(project_id)) OR (access_level = 'team'::text) OR (EXISTS ( SELECT 1
   FROM document_user_access dua
  WHERE ((dua.document_id = document_metadata.id) AND (dua.user_id = (select auth.uid())))))))));

-- -----------------------------------------------------------------------------
-- Table: document_rows
-- -----------------------------------------------------------------------------

drop policy if exists "document_rows_select" on public.document_rows;
create policy "document_rows_select"
  on public.document_rows
  FOR SELECT
  to authenticated
  using ((current_is_app_admin() OR (EXISTS ( SELECT 1
   FROM document_metadata dm
  WHERE ((dm.id = document_rows.dataset_id) AND (COALESCE(dm.category, ''::text) <> ALL (ARRAY['email'::text, 'teams_message'::text])) AND (((dm.project_id IS NOT NULL) AND current_is_project_member(dm.project_id)) OR (dm.access_level = 'team'::text) OR (EXISTS ( SELECT 1
           FROM document_user_access dua
          WHERE ((dua.document_id = dm.id) AND (dua.user_id = (select auth.uid())))))))))));

-- -----------------------------------------------------------------------------
-- Table: documents_rfis_links
-- -----------------------------------------------------------------------------

drop policy if exists "documents_rfis_links_delete" on public.documents_rfis_links;
create policy "documents_rfis_links_delete"
  on public.documents_rfis_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "documents_rfis_links_insert" on public.documents_rfis_links;
create policy "documents_rfis_links_insert"
  on public.documents_rfis_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: documents_submittals_links
-- -----------------------------------------------------------------------------

drop policy if exists "documents_submittals_links_delete" on public.documents_submittals_links;
create policy "documents_submittals_links_delete"
  on public.documents_submittals_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "documents_submittals_links_insert" on public.documents_submittals_links;
create policy "documents_submittals_links_insert"
  on public.documents_submittals_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: drawing_areas
-- -----------------------------------------------------------------------------

drop policy if exists "drawing_areas_delete" on public.drawing_areas;
create policy "drawing_areas_delete"
  on public.drawing_areas
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_areas_insert" on public.drawing_areas;
create policy "drawing_areas_insert"
  on public.drawing_areas
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_areas_select" on public.drawing_areas;
create policy "drawing_areas_select"
  on public.drawing_areas
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_areas_update" on public.drawing_areas;
create policy "drawing_areas_update"
  on public.drawing_areas
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: drawing_change_history
-- -----------------------------------------------------------------------------

drop policy if exists "Authenticated users can insert drawing change history" on public.drawing_change_history;
create policy "Authenticated users can insert drawing change history"
  on public.drawing_change_history
  FOR INSERT
  to public
  with check (((select auth.uid()) = changed_by));

-- -----------------------------------------------------------------------------
-- Table: drawing_downloads
-- -----------------------------------------------------------------------------

drop policy if exists "drawing_downloads_insert" on public.drawing_downloads;
create policy "drawing_downloads_insert"
  on public.drawing_downloads
  FOR INSERT
  to public
  with check ((downloaded_by = (select auth.uid())));

drop policy if exists "drawing_downloads_select" on public.drawing_downloads;
create policy "drawing_downloads_select"
  on public.drawing_downloads
  FOR SELECT
  to public
  using ((downloaded_by = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: drawing_markup_pins
-- -----------------------------------------------------------------------------

drop policy if exists "Pin creator can delete drawing pins" on public.drawing_markup_pins;
create policy "Pin creator can delete drawing pins"
  on public.drawing_markup_pins
  FOR DELETE
  to authenticated
  using ((created_by = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: drawing_related_items
-- -----------------------------------------------------------------------------

drop policy if exists "drawing_related_items_all" on public.drawing_related_items;
create policy "drawing_related_items_all"
  on public.drawing_related_items
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM ((drawings d
     JOIN project_directory_memberships pdm ON ((pdm.project_id = d.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((d.id = drawing_related_items.drawing_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_related_items_select" on public.drawing_related_items;
create policy "drawing_related_items_select"
  on public.drawing_related_items
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM ((drawings d
     JOIN project_directory_memberships pdm ON ((pdm.project_id = d.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((d.id = drawing_related_items.drawing_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: drawing_revisions
-- -----------------------------------------------------------------------------

drop policy if exists "drawing_revisions_all" on public.drawing_revisions;
create policy "drawing_revisions_all"
  on public.drawing_revisions
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM ((drawings d
     JOIN project_directory_memberships pdm ON ((pdm.project_id = d.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((d.id = drawing_revisions.drawing_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_revisions_select" on public.drawing_revisions;
create policy "drawing_revisions_select"
  on public.drawing_revisions
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM ((drawings d
     JOIN project_directory_memberships pdm ON ((pdm.project_id = d.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((d.id = drawing_revisions.drawing_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: drawing_sets
-- -----------------------------------------------------------------------------

drop policy if exists "drawing_sets_delete_membership" on public.drawing_sets;
create policy "drawing_sets_delete_membership"
  on public.drawing_sets
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_sets.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_sets_select" on public.drawing_sets;
create policy "drawing_sets_select"
  on public.drawing_sets
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_sets.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_sets_select_membership" on public.drawing_sets;
create policy "drawing_sets_select_membership"
  on public.drawing_sets
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_sets.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_sets_update_membership" on public.drawing_sets;
create policy "drawing_sets_update_membership"
  on public.drawing_sets
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawing_sets.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: drawing_sketches
-- -----------------------------------------------------------------------------

drop policy if exists "drawing_sketches_all" on public.drawing_sketches;
create policy "drawing_sketches_all"
  on public.drawing_sketches
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM (((drawing_revisions dr
     JOIN drawings d ON ((d.id = dr.drawing_id)))
     JOIN project_directory_memberships pdm ON ((pdm.project_id = d.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((dr.id = drawing_sketches.drawing_revision_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawing_sketches_select" on public.drawing_sketches;
create policy "drawing_sketches_select"
  on public.drawing_sketches
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (((drawing_revisions dr
     JOIN drawings d ON ((d.id = dr.drawing_id)))
     JOIN project_directory_memberships pdm ON ((pdm.project_id = d.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((dr.id = drawing_sketches.drawing_revision_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: drawings
-- -----------------------------------------------------------------------------

drop policy if exists "drawings_all" on public.drawings;
create policy "drawings_all"
  on public.drawings
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawings.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "drawings_select" on public.drawings;
create policy "drawings_select"
  on public.drawings
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = drawings.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: drawings_rfis_links
-- -----------------------------------------------------------------------------

drop policy if exists "drawings_rfis_links_delete" on public.drawings_rfis_links;
create policy "drawings_rfis_links_delete"
  on public.drawings_rfis_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "drawings_rfis_links_insert" on public.drawings_rfis_links;
create policy "drawings_rfis_links_insert"
  on public.drawings_rfis_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: email_events
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view their own email events" on public.email_events;
create policy "Users can view their own email events"
  on public.email_events
  FOR SELECT
  to public
  using ((user_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: memories
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view their own memories" on public.memories;
create policy "Users can view their own memories"
  on public.memories
  FOR SELECT
  to public
  using (((select auth.uid()) = user_id));

-- -----------------------------------------------------------------------------
-- Table: messages
-- -----------------------------------------------------------------------------

drop policy if exists "Users can insert messages in their conversations" on public.messages;
create policy "Users can insert messages in their conversations"
  on public.messages
  FOR INSERT
  to public
  with check (((select auth.uid()) = computed_session_user_id));

drop policy if exists "Users can view their own messages" on public.messages;
create policy "Users can view their own messages"
  on public.messages
  FOR SELECT
  to public
  using (((select auth.uid()) = computed_session_user_id));

-- -----------------------------------------------------------------------------
-- Table: observations_project_photos_links
-- -----------------------------------------------------------------------------

drop policy if exists "observations_project_photos_links_delete" on public.observations_project_photos_links;
create policy "observations_project_photos_links_delete"
  on public.observations_project_photos_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "observations_project_photos_links_insert" on public.observations_project_photos_links;
create policy "observations_project_photos_links_insert"
  on public.observations_project_photos_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: organization_members
-- -----------------------------------------------------------------------------

drop policy if exists "org_members_delete" on public.organization_members;
create policy "org_members_delete"
  on public.organization_members
  FOR DELETE
  to authenticated
  using ((("userId" = ( SELECT (select auth.uid()) AS uid)) OR is_org_member("organizationId", ARRAY['owner'::text, 'admin'::text])));

drop policy if exists "org_members_insert" on public.organization_members;
create policy "org_members_insert"
  on public.organization_members
  FOR INSERT
  to authenticated
  with check ((("userId" = ( SELECT (select auth.uid()) AS uid)) OR is_org_member("organizationId", ARRAY['owner'::text, 'admin'::text])));

-- -----------------------------------------------------------------------------
-- Table: organizations
-- -----------------------------------------------------------------------------

drop policy if exists "org_insert" on public.organizations;
create policy "org_insert"
  on public.organizations
  FOR INSERT
  to authenticated
  with check ((( SELECT (select auth.uid()) AS uid) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: owner_invoice_line_items
-- -----------------------------------------------------------------------------

drop policy if exists "owner_invoice_line_items_delete" on public.owner_invoice_line_items;
create policy "owner_invoice_line_items_delete"
  on public.owner_invoice_line_items
  FOR DELETE
  to authenticated
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "owner_invoice_line_items_insert" on public.owner_invoice_line_items;
create policy "owner_invoice_line_items_insert"
  on public.owner_invoice_line_items
  FOR INSERT
  to authenticated
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "owner_invoice_line_items_select" on public.owner_invoice_line_items;
create policy "owner_invoice_line_items_select"
  on public.owner_invoice_line_items
  FOR SELECT
  to authenticated
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "owner_invoice_line_items_update" on public.owner_invoice_line_items;
create policy "owner_invoice_line_items_update"
  on public.owner_invoice_line_items
  FOR UPDATE
  to authenticated
  using (((select auth.uid()) IS NOT NULL))
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: owner_invoices
-- -----------------------------------------------------------------------------

drop policy if exists "owner_invoices_delete" on public.owner_invoices;
create policy "owner_invoices_delete"
  on public.owner_invoices
  FOR DELETE
  to authenticated
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "owner_invoices_insert" on public.owner_invoices;
create policy "owner_invoices_insert"
  on public.owner_invoices
  FOR INSERT
  to authenticated
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "owner_invoices_select" on public.owner_invoices;
create policy "owner_invoices_select"
  on public.owner_invoices
  FOR SELECT
  to authenticated
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "owner_invoices_update" on public.owner_invoices;
create policy "owner_invoices_update"
  on public.owner_invoices
  FOR UPDATE
  to authenticated
  using (((select auth.uid()) IS NOT NULL))
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: pcco_attachments
-- -----------------------------------------------------------------------------

drop policy if exists "pcco_attachments_delete" on public.pcco_attachments;
create policy "pcco_attachments_delete"
  on public.pcco_attachments
  FOR DELETE
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "pcco_attachments_insert" on public.pcco_attachments;
create policy "pcco_attachments_insert"
  on public.pcco_attachments
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "pcco_attachments_select" on public.pcco_attachments;
create policy "pcco_attachments_select"
  on public.pcco_attachments
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: people
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view all people in their projects" on public.people;
create policy "Users can view all people in their projects"
  on public.people
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM project_directory_memberships pdm1
  WHERE ((pdm1.person_id = people.id) AND (pdm1.status = 'active'::text) AND (EXISTS ( SELECT 1
           FROM (project_directory_memberships pdm2
             JOIN users_auth ua ON ((ua.person_id = pdm2.person_id)))
          WHERE ((pdm2.project_id = pdm1.project_id) AND (pdm2.status = 'active'::text) AND (ua.auth_user_id = (select auth.uid())))))))));

drop policy if exists "Users with directory:write can create people" on public.people;
create policy "Users with directory:write can create people"
  on public.people
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND ((pt.rules_json -> 'directory'::text) ? 'write'::text)))));

drop policy if exists "Users with directory:write can update people" on public.people;
create policy "Users with directory:write can update people"
  on public.people
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND ((pt.rules_json -> 'directory'::text) ? 'write'::text)))));

-- -----------------------------------------------------------------------------
-- Table: permission_audit_log
-- -----------------------------------------------------------------------------

drop policy if exists "pal_insert" on public.permission_audit_log;
create policy "pal_insert"
  on public.permission_audit_log
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT pdm.project_id
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))) OR (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true))))));

drop policy if exists "pal_select" on public.permission_audit_log;
create policy "pal_select"
  on public.permission_audit_log
  FOR SELECT
  to authenticated
  using ((project_id IN ( SELECT pdm.project_id
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: permission_templates
-- -----------------------------------------------------------------------------

drop policy if exists "pt_delete" on public.permission_templates;
create policy "pt_delete"
  on public.permission_templates
  FOR DELETE
  to authenticated
  using (((is_system = false) AND (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true))))));

drop policy if exists "pt_insert" on public.permission_templates;
create policy "pt_insert"
  on public.permission_templates
  FOR INSERT
  to authenticated
  with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))));

drop policy if exists "pt_update" on public.permission_templates;
create policy "pt_update"
  on public.permission_templates
  FOR UPDATE
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))))
  with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))));

-- -----------------------------------------------------------------------------
-- Table: prime_contract_change_order_related_items
-- -----------------------------------------------------------------------------

drop policy if exists "prime_co_related_items_delete" on public.prime_contract_change_order_related_items;
create policy "prime_co_related_items_delete"
  on public.prime_contract_change_order_related_items
  FOR DELETE
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "prime_co_related_items_insert" on public.prime_contract_change_order_related_items;
create policy "prime_co_related_items_insert"
  on public.prime_contract_change_order_related_items
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: prime_contract_payment_applications
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete payment applications for their projects" on public.prime_contract_payment_applications;
create policy "Users can delete payment applications for their projects"
  on public.prime_contract_payment_applications
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payment_applications.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can insert payment applications for their projects" on public.prime_contract_payment_applications;
create policy "Users can insert payment applications for their projects"
  on public.prime_contract_payment_applications
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payment_applications.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can update payment applications for their projects" on public.prime_contract_payment_applications;
create policy "Users can update payment applications for their projects"
  on public.prime_contract_payment_applications
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payment_applications.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can view payment applications for their projects" on public.prime_contract_payment_applications;
create policy "Users can view payment applications for their projects"
  on public.prime_contract_payment_applications
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payment_applications.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: prime_contract_payments
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete payments for their projects" on public.prime_contract_payments;
create policy "Users can delete payments for their projects"
  on public.prime_contract_payments
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payments.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can insert payments for their projects" on public.prime_contract_payments;
create policy "Users can insert payments for their projects"
  on public.prime_contract_payments
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payments.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can update payments for their projects" on public.prime_contract_payments;
create policy "Users can update payments for their projects"
  on public.prime_contract_payments
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payments.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can view payments for their projects" on public.prime_contract_payments;
create policy "Users can view payments for their projects"
  on public.prime_contract_payments
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_payments.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: prime_contract_pco_attachments
-- -----------------------------------------------------------------------------

drop policy if exists "prime_contract_pco_attachments_delete" on public.prime_contract_pco_attachments;
create policy "prime_contract_pco_attachments_delete"
  on public.prime_contract_pco_attachments
  FOR DELETE
  to authenticated
  using ((((select auth.uid()) IS NOT NULL) AND (current_is_app_admin() OR (EXISTS ( SELECT 1
   FROM prime_contract_pcos p
  WHERE ((p.id = prime_contract_pco_attachments.pco_id) AND current_is_project_member((p.project_id)::bigint)))))));

drop policy if exists "prime_contract_pco_attachments_insert" on public.prime_contract_pco_attachments;
create policy "prime_contract_pco_attachments_insert"
  on public.prime_contract_pco_attachments
  FOR INSERT
  to authenticated
  with check ((((select auth.uid()) IS NOT NULL) AND ((uploaded_by IS NULL) OR (uploaded_by = (select auth.uid()))) AND (current_is_app_admin() OR (EXISTS ( SELECT 1
   FROM prime_contract_pcos p
  WHERE ((p.id = prime_contract_pco_attachments.pco_id) AND current_is_project_member((p.project_id)::bigint)))))));

drop policy if exists "prime_contract_pco_attachments_select" on public.prime_contract_pco_attachments;
create policy "prime_contract_pco_attachments_select"
  on public.prime_contract_pco_attachments
  FOR SELECT
  to authenticated
  using ((((select auth.uid()) IS NOT NULL) AND (current_is_app_admin() OR (EXISTS ( SELECT 1
   FROM prime_contract_pcos p
  WHERE ((p.id = prime_contract_pco_attachments.pco_id) AND current_is_project_member((p.project_id)::bigint)))))));

-- -----------------------------------------------------------------------------
-- Table: prime_contract_project_settings
-- -----------------------------------------------------------------------------

drop policy if exists "Project members can insert prime contract settings" on public.prime_contract_project_settings;
create policy "Project members can insert prime contract settings"
  on public.prime_contract_project_settings
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_project_settings.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Project members can update prime contract settings" on public.prime_contract_project_settings;
create policy "Project members can update prime contract settings"
  on public.prime_contract_project_settings
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_project_settings.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Project members can view prime contract settings" on public.prime_contract_project_settings;
create policy "Project members can view prime contract settings"
  on public.prime_contract_project_settings
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = prime_contract_project_settings.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: project_budget_codes
-- -----------------------------------------------------------------------------

drop policy if exists "project_budget_codes_delete" on public.project_budget_codes;
create policy "project_budget_codes_delete"
  on public.project_budget_codes
  FOR DELETE
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_budget_codes_insert" on public.project_budget_codes;
create policy "project_budget_codes_insert"
  on public.project_budget_codes
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_budget_codes_select" on public.project_budget_codes;
create policy "project_budget_codes_select"
  on public.project_budget_codes
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_budget_codes_update" on public.project_budget_codes;
create policy "project_budget_codes_update"
  on public.project_budget_codes
  FOR UPDATE
  to public
  using (((select auth.uid()) IS NOT NULL))
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: project_budget_settings
-- -----------------------------------------------------------------------------

drop policy if exists "project_budget_settings_insert" on public.project_budget_settings;
create policy "project_budget_settings_insert"
  on public.project_budget_settings
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_budget_settings_select" on public.project_budget_settings;
create policy "project_budget_settings_select"
  on public.project_budget_settings
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_budget_settings_update" on public.project_budget_settings;
create policy "project_budget_settings_update"
  on public.project_budget_settings
  FOR UPDATE
  to public
  using (((select auth.uid()) IS NOT NULL))
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: project_companies
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view companies in their projects" on public.project_companies;
create policy "Users can view companies in their projects"
  on public.project_companies
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = project_companies.project_id) AND (pdm.status = 'active'::text) AND (ua.auth_user_id = (select auth.uid()))))));

drop policy if exists "Users with directory:write can manage project companies" on public.project_companies;
create policy "Users with directory:write can manage project companies"
  on public.project_companies
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((pdm.project_id = project_companies.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND ((pt.rules_json -> 'directory'::text) ? 'write'::text)))));

-- -----------------------------------------------------------------------------
-- Table: project_photos_punch_items_links
-- -----------------------------------------------------------------------------

drop policy if exists "project_photos_punch_items_links_delete" on public.project_photos_punch_items_links;
create policy "project_photos_punch_items_links_delete"
  on public.project_photos_punch_items_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "project_photos_punch_items_links_insert" on public.project_photos_punch_items_links;
create policy "project_photos_punch_items_links_insert"
  on public.project_photos_punch_items_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: project_progress_report_photos
-- -----------------------------------------------------------------------------

drop policy if exists "project_progress_report_photos_delete" on public.project_progress_report_photos;
create policy "project_progress_report_photos_delete"
  on public.project_progress_report_photos
  FOR DELETE
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_progress_report_photos_insert" on public.project_progress_report_photos;
create policy "project_progress_report_photos_insert"
  on public.project_progress_report_photos
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_progress_report_photos_select" on public.project_progress_report_photos;
create policy "project_progress_report_photos_select"
  on public.project_progress_report_photos
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_progress_report_photos_update" on public.project_progress_report_photos;
create policy "project_progress_report_photos_update"
  on public.project_progress_report_photos
  FOR UPDATE
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: project_progress_reports
-- -----------------------------------------------------------------------------

drop policy if exists "project_progress_reports_insert" on public.project_progress_reports;
create policy "project_progress_reports_insert"
  on public.project_progress_reports
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_progress_reports_select" on public.project_progress_reports;
create policy "project_progress_reports_select"
  on public.project_progress_reports
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "project_progress_reports_update" on public.project_progress_reports;
create policy "project_progress_reports_update"
  on public.project_progress_reports
  FOR UPDATE
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: project_role_members
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can manage role members" on public.project_role_members;
create policy "Admins can manage role members"
  on public.project_role_members
  FOR ALL
  to public
  using (((EXISTS ( SELECT 1
   FROM ((project_roles pr
     JOIN project_directory_memberships pdm ON ((pdm.project_id = pr.project_id)))
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((pr.id = project_role_members.project_role_id) AND (pdm.status = 'active'::text) AND (pdm.person_id = (select auth.uid())) AND ((pt.rules_json -> 'directory'::text) ? 'admin'::text)))) OR (auth.role() = 'service_role'::text)));

drop policy if exists "Users can view role members in their projects" on public.project_role_members;
create policy "Users can view role members in their projects"
  on public.project_role_members
  FOR SELECT
  to public
  using (((EXISTS ( SELECT 1
   FROM (project_roles pr
     JOIN project_directory_memberships pdm ON ((pdm.project_id = pr.project_id)))
  WHERE ((pr.id = project_role_members.project_role_id) AND (pdm.status = 'active'::text) AND (pdm.person_id = (select auth.uid()))))) OR (auth.role() = 'service_role'::text)));

-- -----------------------------------------------------------------------------
-- Table: project_roles
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can manage project roles" on public.project_roles;
create policy "Admins can manage project roles"
  on public.project_roles
  FOR ALL
  to public
  using (((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((pdm.project_id = project_roles.project_id) AND (pdm.status = 'active'::text) AND (pdm.person_id = (select auth.uid())) AND ((pt.rules_json -> 'directory'::text) ? 'admin'::text)))) OR (auth.role() = 'service_role'::text)));

drop policy if exists "Users can view roles in their projects" on public.project_roles;
create policy "Users can view roles in their projects"
  on public.project_roles
  FOR SELECT
  to public
  using (((EXISTS ( SELECT 1
   FROM project_directory_memberships pdm
  WHERE ((pdm.project_id = project_roles.project_id) AND (pdm.status = 'active'::text) AND (pdm.person_id = (select auth.uid()))))) OR (auth.role() = 'service_role'::text)));

-- -----------------------------------------------------------------------------
-- Table: psr_comments
-- -----------------------------------------------------------------------------

drop policy if exists "psr_comments_insert" on public.psr_comments;
create policy "psr_comments_insert"
  on public.psr_comments
  FOR INSERT
  to public
  with check (((select auth.uid()) IS NOT NULL));

drop policy if exists "psr_comments_select" on public.psr_comments;
create policy "psr_comments_select"
  on public.psr_comments
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "psr_comments_update" on public.psr_comments;
create policy "psr_comments_update"
  on public.psr_comments
  FOR UPDATE
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: punch_item_comments
-- -----------------------------------------------------------------------------

drop policy if exists "punch_item_comments_delete" on public.punch_item_comments;
create policy "punch_item_comments_delete"
  on public.punch_item_comments
  FOR DELETE
  to public
  using ((created_by = (select auth.uid())));

drop policy if exists "punch_item_comments_insert" on public.punch_item_comments;
create policy "punch_item_comments_insert"
  on public.punch_item_comments
  FOR INSERT
  to public
  with check (((created_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
  WHERE ((p.auth_user_id = (select auth.uid())) AND (pdm.project_id = punch_item_comments.project_id))))));

drop policy if exists "punch_item_comments_select" on public.punch_item_comments;
create policy "punch_item_comments_select"
  on public.punch_item_comments
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
  WHERE ((p.auth_user_id = (select auth.uid())) AND (pdm.project_id = punch_item_comments.project_id)))));

drop policy if exists "punch_item_comments_update" on public.punch_item_comments;
create policy "punch_item_comments_update"
  on public.punch_item_comments
  FOR UPDATE
  to public
  using ((created_by = (select auth.uid())))
  with check ((created_by = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: punch_item_template_categories
-- -----------------------------------------------------------------------------

drop policy if exists "Users can manage template categories for their projects" on public.punch_item_template_categories;
create policy "Users can manage template categories for their projects"
  on public.punch_item_template_categories
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
  WHERE ((pdm.project_id = punch_item_template_categories.project_id) AND (p.auth_user_id = (select auth.uid()))))));

drop policy if exists "Users can view template categories for their projects" on public.punch_item_template_categories;
create policy "Users can view template categories for their projects"
  on public.punch_item_template_categories
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
  WHERE ((pdm.project_id = punch_item_template_categories.project_id) AND (p.auth_user_id = (select auth.uid()))))));

-- -----------------------------------------------------------------------------
-- Table: punch_item_templates
-- -----------------------------------------------------------------------------

drop policy if exists "Users can manage templates for their projects" on public.punch_item_templates;
create policy "Users can manage templates for their projects"
  on public.punch_item_templates
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
  WHERE ((pdm.project_id = punch_item_templates.project_id) AND (p.auth_user_id = (select auth.uid()))))));

drop policy if exists "Users can view templates for their projects" on public.punch_item_templates;
create policy "Users can view templates for their projects"
  on public.punch_item_templates
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
  WHERE ((pdm.project_id = punch_item_templates.project_id) AND (p.auth_user_id = (select auth.uid()))))));

-- -----------------------------------------------------------------------------
-- Table: punch_items
-- -----------------------------------------------------------------------------

drop policy if exists "punch_items_delete_policy" on public.punch_items;
create policy "punch_items_delete_policy"
  on public.punch_items
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = (select auth.uid()))))));

drop policy if exists "punch_items_insert_policy" on public.punch_items;
create policy "punch_items_insert_policy"
  on public.punch_items
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = (select auth.uid()))))));

drop policy if exists "punch_items_select_policy" on public.punch_items;
create policy "punch_items_select_policy"
  on public.punch_items
  FOR SELECT
  to public
  using (((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = (select auth.uid()))))) AND ((NOT is_private) OR (EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.role = ANY (ARRAY['admin'::text, 'Project Admin'::text, 'Project Manager'::text]))))))));

drop policy if exists "punch_items_update_policy" on public.punch_items;
create policy "punch_items_update_policy"
  on public.punch_items
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
     JOIN users_auth ua ON ((ua.person_id = p.id)))
  WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = (select auth.uid()))))));

-- -----------------------------------------------------------------------------
-- Table: requests
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view their own requests" on public.requests;
create policy "Users can view their own requests"
  on public.requests
  FOR SELECT
  to public
  using (((select auth.uid()) = user_id));

-- -----------------------------------------------------------------------------
-- Table: rfis_submittals_links
-- -----------------------------------------------------------------------------

drop policy if exists "rfis_submittals_links_delete" on public.rfis_submittals_links;
create policy "rfis_submittals_links_delete"
  on public.rfis_submittals_links
  FOR DELETE
  to authenticated
  using ((created_by = ( SELECT (select auth.uid()) AS uid)));

drop policy if exists "rfis_submittals_links_insert" on public.rfis_submittals_links;
create policy "rfis_submittals_links_insert"
  on public.rfis_submittals_links
  FOR INSERT
  to authenticated
  with check (((project_id IN ( SELECT projects.id
   FROM projects)) AND (created_by = ( SELECT (select auth.uid()) AS uid))));

-- -----------------------------------------------------------------------------
-- Table: specification_area_sections
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete area_sections in their projects" on public.specification_area_sections;
create policy "Users can delete area_sections in their projects"
  on public.specification_area_sections
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_area_sections.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can insert area_sections in their projects" on public.specification_area_sections;
create policy "Users can insert area_sections in their projects"
  on public.specification_area_sections
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_area_sections.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can view area_sections in their projects" on public.specification_area_sections;
create policy "Users can view area_sections in their projects"
  on public.specification_area_sections
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_area_sections.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: specification_areas
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete areas in their projects" on public.specification_areas;
create policy "Users can delete areas in their projects"
  on public.specification_areas
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can insert areas in their projects" on public.specification_areas;
create policy "Users can insert areas in their projects"
  on public.specification_areas
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can update areas in their projects" on public.specification_areas;
create policy "Users can update areas in their projects"
  on public.specification_areas
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can view areas in their projects" on public.specification_areas;
create policy "Users can view areas in their projects"
  on public.specification_areas
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_areas.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: specification_section_revisions
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete revisions in their projects" on public.specification_section_revisions;
create policy "Users can delete revisions in their projects"
  on public.specification_section_revisions
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_section_revisions.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can insert revisions in their projects" on public.specification_section_revisions;
create policy "Users can insert revisions in their projects"
  on public.specification_section_revisions
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_section_revisions.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can update revisions in their projects" on public.specification_section_revisions;
create policy "Users can update revisions in their projects"
  on public.specification_section_revisions
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_section_revisions.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can view revisions in their projects" on public.specification_section_revisions;
create policy "Users can view revisions in their projects"
  on public.specification_section_revisions
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_section_revisions.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: specification_sections
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete specifications in their projects" on public.specification_sections;
create policy "Users can delete specifications in their projects"
  on public.specification_sections
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_sections.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can insert specifications with write access" on public.specification_sections;
create policy "Users can insert specifications with write access"
  on public.specification_sections
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_sections.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can update specifications in their projects" on public.specification_sections;
create policy "Users can update specifications in their projects"
  on public.specification_sections
  FOR UPDATE
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_sections.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can view specifications in their projects" on public.specification_sections;
create policy "Users can view specifications in their projects"
  on public.specification_sections
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = specification_sections.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: specification_subscribers
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete subscribers in their projects" on public.specification_subscribers;
create policy "Users can delete subscribers in their projects"
  on public.specification_subscribers
  FOR DELETE
  to public
  using ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_subscribers.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can insert subscribers in their projects" on public.specification_subscribers;
create policy "Users can insert subscribers in their projects"
  on public.specification_subscribers
  FOR INSERT
  to public
  with check ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_subscribers.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "Users can view subscribers in their projects" on public.specification_subscribers;
create policy "Users can view subscribers in their projects"
  on public.specification_subscribers
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM ((specification_sections ss
     JOIN project_directory_memberships pdm ON ((pdm.project_id = ss.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ss.id = specification_subscribers.section_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: sub_jobs
-- -----------------------------------------------------------------------------

drop policy if exists "sub_jobs_read" on public.sub_jobs;
create policy "sub_jobs_read"
  on public.sub_jobs
  FOR SELECT
  to public
  using (((select auth.uid()) IS NOT NULL));

drop policy if exists "sub_jobs_write" on public.sub_jobs;
create policy "sub_jobs_write"
  on public.sub_jobs
  FOR ALL
  to public
  using (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: subcontractor_sov_items
-- -----------------------------------------------------------------------------

drop policy if exists "Project members can access subcontractor SOV items" on public.subcontractor_sov_items;
create policy "Project members can access subcontractor SOV items"
  on public.subcontractor_sov_items
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM ((subcontractor_sov_submissions s
     JOIN project_directory_memberships pdm ON ((pdm.project_id = s.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((s.id = subcontractor_sov_items.submission_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: subcontractor_sov_submissions
-- -----------------------------------------------------------------------------

drop policy if exists "Project members can access subcontractor SOV submissions" on public.subcontractor_sov_submissions;
create policy "Project members can access subcontractor SOV submissions"
  on public.subcontractor_sov_submissions
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = subcontractor_sov_submissions.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

-- -----------------------------------------------------------------------------
-- Table: submittal_attachments
-- -----------------------------------------------------------------------------

drop policy if exists "submittal_attachments_access" on public.submittal_attachments;
create policy "submittal_attachments_access"
  on public.submittal_attachments
  FOR ALL
  to public
  using (((submittal_id IN ( SELECT submittals.id
   FROM submittals
  WHERE (submittals.project_id IN ( SELECT pdm.project_id
           FROM (project_directory_memberships pdm
             JOIN people p ON ((p.id = pdm.person_id)))
          WHERE (p.auth_user_id = (select auth.uid())))))) OR (response_id IN ( SELECT submittal_responses.id
   FROM submittal_responses
  WHERE (submittal_responses.submittal_id IN ( SELECT submittals.id
           FROM submittals
          WHERE (submittals.project_id IN ( SELECT pdm.project_id
                   FROM (project_directory_memberships pdm
                     JOIN people p ON ((p.id = pdm.person_id)))
                  WHERE (p.auth_user_id = (select auth.uid()))))))))));

-- -----------------------------------------------------------------------------
-- Table: submittal_distribution_recipients
-- -----------------------------------------------------------------------------

drop policy if exists "submittal_dist_recipients_access" on public.submittal_distribution_recipients;
create policy "submittal_dist_recipients_access"
  on public.submittal_distribution_recipients
  FOR ALL
  to public
  using ((distribution_id IN ( SELECT submittal_distributions.id
   FROM submittal_distributions
  WHERE (submittal_distributions.submittal_id IN ( SELECT submittals.id
           FROM submittals
          WHERE (submittals.project_id IN ( SELECT pdm.project_id
                   FROM (project_directory_memberships pdm
                     JOIN people p ON ((p.id = pdm.person_id)))
                  WHERE (p.auth_user_id = (select auth.uid())))))))));

-- -----------------------------------------------------------------------------
-- Table: submittal_distributions
-- -----------------------------------------------------------------------------

drop policy if exists "submittal_distributions_access" on public.submittal_distributions;
create policy "submittal_distributions_access"
  on public.submittal_distributions
  FOR ALL
  to public
  using ((submittal_id IN ( SELECT submittals.id
   FROM submittals
  WHERE (submittals.project_id IN ( SELECT pdm.project_id
           FROM (project_directory_memberships pdm
             JOIN people p ON ((p.id = pdm.person_id)))
          WHERE (p.auth_user_id = (select auth.uid())))))));

-- -----------------------------------------------------------------------------
-- Table: submittal_history
-- -----------------------------------------------------------------------------

drop policy if exists "Authenticated users can insert submittal history" on public.submittal_history;
create policy "Authenticated users can insert submittal history"
  on public.submittal_history
  FOR INSERT
  to authenticated
  with check (((select auth.uid()) IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Table: submittal_linked_drawings
-- -----------------------------------------------------------------------------

drop policy if exists "submittal_linked_drawings_access" on public.submittal_linked_drawings;
create policy "submittal_linked_drawings_access"
  on public.submittal_linked_drawings
  FOR ALL
  to public
  using ((submittal_id IN ( SELECT submittals.id
   FROM submittals
  WHERE (submittals.project_id IN ( SELECT pdm.project_id
           FROM (project_directory_memberships pdm
             JOIN people p ON ((p.id = pdm.person_id)))
          WHERE (p.auth_user_id = (select auth.uid())))))));

-- -----------------------------------------------------------------------------
-- Table: submittal_packages
-- -----------------------------------------------------------------------------

drop policy if exists "submittal_packages_project_access" on public.submittal_packages;
create policy "submittal_packages_project_access"
  on public.submittal_packages
  FOR ALL
  to public
  using ((project_id IN ( SELECT pdm.project_id
   FROM (project_directory_memberships pdm
     JOIN people p ON ((p.id = pdm.person_id)))
  WHERE (p.auth_user_id = (select auth.uid())))));

-- -----------------------------------------------------------------------------
-- Table: submittal_responses
-- -----------------------------------------------------------------------------

drop policy if exists "submittal_responses_access" on public.submittal_responses;
create policy "submittal_responses_access"
  on public.submittal_responses
  FOR ALL
  to public
  using ((submittal_id IN ( SELECT submittals.id
   FROM submittals
  WHERE (submittals.project_id IN ( SELECT pdm.project_id
           FROM (project_directory_memberships pdm
             JOIN people p ON ((p.id = pdm.person_id)))
          WHERE (p.auth_user_id = (select auth.uid())))))));

-- -----------------------------------------------------------------------------
-- Table: submittal_workflow_steps
-- -----------------------------------------------------------------------------

drop policy if exists "submittal_workflow_steps_access" on public.submittal_workflow_steps;
create policy "submittal_workflow_steps_access"
  on public.submittal_workflow_steps
  FOR ALL
  to public
  using ((submittal_id IN ( SELECT submittals.id
   FROM submittals
  WHERE (submittals.project_id IN ( SELECT pdm.project_id
           FROM (project_directory_memberships pdm
             JOIN people p ON ((p.id = pdm.person_id)))
          WHERE (p.auth_user_id = (select auth.uid())))))));

-- -----------------------------------------------------------------------------
-- Table: system_alerts
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can read system alerts" on public.system_alerts;
create policy "Admins can read system alerts"
  on public.system_alerts
  FOR SELECT
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.is_admin = true)))));

-- -----------------------------------------------------------------------------
-- Table: task_comments
-- -----------------------------------------------------------------------------

drop policy if exists "task_comments_delete_own" on public.task_comments;
create policy "task_comments_delete_own"
  on public.task_comments
  FOR DELETE
  to authenticated
  using ((author_id = (select auth.uid())));

drop policy if exists "task_comments_insert_own" on public.task_comments;
create policy "task_comments_insert_own"
  on public.task_comments
  FOR INSERT
  to authenticated
  with check ((author_id = (select auth.uid())));

drop policy if exists "task_comments_update_own" on public.task_comments;
create policy "task_comments_update_own"
  on public.task_comments
  FOR UPDATE
  to authenticated
  using ((author_id = (select auth.uid())))
  with check ((author_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: team_chat_channels
-- -----------------------------------------------------------------------------

drop policy if exists "admins can create team chat channels" on public.team_chat_channels;
create policy "admins can create team chat channels"
  on public.team_chat_channels
  FOR INSERT
  to authenticated
  with check ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));

drop policy if exists "admins can delete team chat channels" on public.team_chat_channels;
create policy "admins can delete team chat channels"
  on public.team_chat_channels
  FOR DELETE
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_admin = true)))));

-- -----------------------------------------------------------------------------
-- Table: team_chat_messages
-- -----------------------------------------------------------------------------

drop policy if exists "team_chat_messages_admin_insert" on public.team_chat_messages;
create policy "team_chat_messages_admin_insert"
  on public.team_chat_messages
  FOR INSERT
  to authenticated
  with check ((current_is_app_admin() AND ((select auth.uid()) = user_id)));

-- -----------------------------------------------------------------------------
-- Table: teams_link_codes
-- -----------------------------------------------------------------------------

drop policy if exists "Users can insert their own teams link codes" on public.teams_link_codes;
create policy "Users can insert their own teams link codes"
  on public.teams_link_codes
  FOR INSERT
  to public
  with check ((user_id = (select auth.uid())));

drop policy if exists "Users can read their own teams link codes" on public.teams_link_codes;
create policy "Users can read their own teams link codes"
  on public.teams_link_codes
  FOR SELECT
  to public
  using ((user_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: telegram_link_codes
-- -----------------------------------------------------------------------------

drop policy if exists "Users can insert their own link codes" on public.telegram_link_codes;
create policy "Users can insert their own link codes"
  on public.telegram_link_codes
  FOR INSERT
  to public
  with check ((user_id = (select auth.uid())));

drop policy if exists "Users can read their own link codes" on public.telegram_link_codes;
create policy "Users can read their own link codes"
  on public.telegram_link_codes
  FOR SELECT
  to public
  using ((user_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: todos
-- -----------------------------------------------------------------------------

drop policy if exists "Individuals can create todos." on public.todos;
create policy "Individuals can create todos."
  on public.todos
  FOR INSERT
  to public
  with check (((select auth.uid()) = user_id));

drop policy if exists "Individuals can delete their own todos." on public.todos;
create policy "Individuals can delete their own todos."
  on public.todos
  FOR DELETE
  to public
  using ((( SELECT (select auth.uid()) AS uid) = user_id));

drop policy if exists "Individuals can update their own todos." on public.todos;
create policy "Individuals can update their own todos."
  on public.todos
  FOR UPDATE
  to public
  using ((( SELECT (select auth.uid()) AS uid) = user_id));

drop policy if exists "Individuals can view their own todos. " on public.todos;
create policy "Individuals can view their own todos. "
  on public.todos
  FOR SELECT
  to public
  using ((( SELECT (select auth.uid()) AS uid) = user_id));

-- -----------------------------------------------------------------------------
-- Table: user_directory_permissions
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can manage directory permissions" on public.user_directory_permissions;
create policy "Admins can manage directory permissions"
  on public.user_directory_permissions
  FOR ALL
  to public
  using (((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((pdm.project_id = user_directory_permissions.project_id) AND (pdm.status = 'active'::text) AND (pdm.person_id = (select auth.uid())) AND ((pt.rules_json -> 'directory'::text) ? 'admin'::text)))) OR (auth.role() = 'service_role'::text)));

drop policy if exists "Users can view directory permissions in their projects" on public.user_directory_permissions;
create policy "Users can view directory permissions in their projects"
  on public.user_directory_permissions
  FOR SELECT
  to public
  using (((EXISTS ( SELECT 1
   FROM project_directory_memberships pdm
  WHERE ((pdm.project_id = user_directory_permissions.project_id) AND (pdm.status = 'active'::text) AND (pdm.person_id = (select auth.uid()))))) OR (auth.role() = 'service_role'::text)));

-- -----------------------------------------------------------------------------
-- Table: user_email_notifications
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can manage any user email notifications" on public.user_email_notifications;
create policy "Admins can manage any user email notifications"
  on public.user_email_notifications
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((pdm.project_id = user_email_notifications.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND ((pt.rules_json -> 'directory'::text) ? 'admin'::text)))));

drop policy if exists "Users can manage their own email notifications" on public.user_email_notifications;
create policy "Users can manage their own email notifications"
  on public.user_email_notifications
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM users_auth ua
  WHERE ((ua.person_id = user_email_notifications.person_id) AND (ua.auth_user_id = (select auth.uid()))))));

drop policy if exists "Users can view email notifications in their projects" on public.user_email_notifications;
create policy "Users can view email notifications in their projects"
  on public.user_email_notifications
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = user_email_notifications.project_id) AND (pdm.status = 'active'::text) AND (ua.auth_user_id = (select auth.uid()))))));

-- -----------------------------------------------------------------------------
-- Table: user_granular_permission_overrides
-- -----------------------------------------------------------------------------

drop policy if exists "ugpo_select" on public.user_granular_permission_overrides;
create policy "ugpo_select"
  on public.user_granular_permission_overrides
  FOR SELECT
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))) OR (EXISTS ( SELECT 1
   FROM users_auth ua
  WHERE ((ua.person_id = user_granular_permission_overrides.person_id) AND (ua.auth_user_id = (select auth.uid()))))) OR ((project_id IS NOT NULL) AND (project_id IN ( SELECT pdm.project_id
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))))));

drop policy if exists "ugpo_write" on public.user_granular_permission_overrides;
create policy "ugpo_write"
  on public.user_granular_permission_overrides
  FOR ALL
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))))
  with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))));

-- -----------------------------------------------------------------------------
-- Table: user_module_permissions
-- -----------------------------------------------------------------------------

drop policy if exists "ump_select" on public.user_module_permissions;
create policy "ump_select"
  on public.user_module_permissions
  FOR SELECT
  to authenticated
  using ((project_id IN ( SELECT pdm.project_id
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text)))));

drop policy if exists "ump_write" on public.user_module_permissions;
create policy "ump_write"
  on public.user_module_permissions
  FOR ALL
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))))
  with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.is_admin = true)))));

-- -----------------------------------------------------------------------------
-- Table: user_profiles
-- -----------------------------------------------------------------------------

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles
  FOR UPDATE
  to public
  using (((select auth.uid()) = id))
  with check ((((select auth.uid()) = id) AND (NOT (is_admin IS DISTINCT FROM false))));

drop policy if exists "Users can view their own profile" on public.user_profiles;
create policy "Users can view their own profile"
  on public.user_profiles
  FOR SELECT
  to public
  using (((select auth.uid()) = id));

-- -----------------------------------------------------------------------------
-- Table: user_project_preferences
-- -----------------------------------------------------------------------------

drop policy if exists "Users can manage their own preferences" on public.user_project_preferences;
create policy "Users can manage their own preferences"
  on public.user_project_preferences
  FOR ALL
  to public
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Table: user_project_roles
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can manage user roles" on public.user_project_roles;
create policy "Admins can manage user roles"
  on public.user_project_roles
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM (((project_directory_memberships pdm
     JOIN project_directory_memberships pdm2 ON ((pdm2.project_id = pdm.project_id)))
     JOIN users_auth ua ON ((ua.person_id = pdm2.person_id)))
     JOIN permission_templates pt ON ((pt.id = pdm2.permission_template_id)))
  WHERE ((pdm.id = user_project_roles.membership_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm2.status = 'active'::text) AND ((pt.rules_json -> 'directory'::text) ? 'admin'::text)))));

drop policy if exists "Users can view roles in their projects" on public.user_project_roles;
create policy "Users can view roles in their projects"
  on public.user_project_roles
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.id = user_project_roles.membership_id) AND (pdm.status = 'active'::text) AND (ua.auth_user_id = (select auth.uid()))))));

-- -----------------------------------------------------------------------------
-- Table: user_schedule_notifications
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can manage any user schedule notifications" on public.user_schedule_notifications;
create policy "Admins can manage any user schedule notifications"
  on public.user_schedule_notifications
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM ((project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
     JOIN permission_templates pt ON ((pt.id = pdm.permission_template_id)))
  WHERE ((pdm.project_id = user_schedule_notifications.project_id) AND (ua.auth_user_id = (select auth.uid())) AND (pdm.status = 'active'::text) AND ((pt.rules_json -> 'directory'::text) ? 'admin'::text)))));

drop policy if exists "Users can manage their own schedule notifications" on public.user_schedule_notifications;
create policy "Users can manage their own schedule notifications"
  on public.user_schedule_notifications
  FOR ALL
  to public
  using ((EXISTS ( SELECT 1
   FROM users_auth ua
  WHERE ((ua.person_id = user_schedule_notifications.person_id) AND (ua.auth_user_id = (select auth.uid()))))));

drop policy if exists "Users can view schedule notifications in their projects" on public.user_schedule_notifications;
create policy "Users can view schedule notifications in their projects"
  on public.user_schedule_notifications
  FOR SELECT
  to public
  using ((EXISTS ( SELECT 1
   FROM (project_directory_memberships pdm
     JOIN users_auth ua ON ((ua.person_id = pdm.person_id)))
  WHERE ((pdm.project_id = user_schedule_notifications.project_id) AND (pdm.status = 'active'::text) AND (ua.auth_user_id = (select auth.uid()))))));

-- -----------------------------------------------------------------------------
-- Table: workspace_artifacts
-- -----------------------------------------------------------------------------

drop policy if exists "Users can delete their own artifacts" on public.workspace_artifacts;
create policy "Users can delete their own artifacts"
  on public.workspace_artifacts
  FOR DELETE
  to public
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can insert their own artifacts" on public.workspace_artifacts;
create policy "Users can insert their own artifacts"
  on public.workspace_artifacts
  FOR INSERT
  to public
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can read their own artifacts" on public.workspace_artifacts;
create policy "Users can read their own artifacts"
  on public.workspace_artifacts
  FOR SELECT
  to public
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can update their own artifacts" on public.workspace_artifacts;
create policy "Users can update their own artifacts"
  on public.workspace_artifacts
  FOR UPDATE
  to public
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));


-- =============================================================================
-- Summary
-- =============================================================================
--
-- Policies modified: 236
-- Policies flagged for manual review: 0
--
-- Count by table:
--   admin_feedback_comments: 1
--   ai_feedback_events: 2
--   ai_memories: 1
--   ai_retrieval_feedback: 2
--   ai_review_feedback: 1
--   ai_task_feedback: 2
--   bot_user_mappings: 3
--   budget_forecast_line_items: 4
--   budget_line_forecasts: 4
--   budget_modification_lines: 1
--   budget_snapshots: 4
--   cco_attachments: 3
--   change_events_documents_links: 2
--   change_workflow_comments: 2
--   change_workflow_notifications: 2
--   collaboration_comments: 2
--   collaboration_notifications: 2
--   commitment_change_order_lines: 1
--   commitment_related_items: 2
--   contract_views: 4
--   conversations: 3
--   daily_logs_project_photos_links: 2
--   design_violations: 1
--   dev_annotations: 1
--   dev_panel_comments: 3
--   distribution_groups: 2
--   document_chunks: 1
--   document_metadata: 1
--   document_rows: 1
--   documents_rfis_links: 2
--   documents_submittals_links: 2
--   drawing_areas: 4
--   drawing_change_history: 1
--   drawing_downloads: 2
--   drawing_markup_pins: 1
--   drawing_related_items: 2
--   drawing_revisions: 2
--   drawing_sets: 4
--   drawing_sketches: 2
--   drawings: 2
--   drawings_rfis_links: 2
--   email_events: 1
--   memories: 1
--   messages: 2
--   observations_project_photos_links: 2
--   organization_members: 2
--   organizations: 1
--   owner_invoice_line_items: 4
--   owner_invoices: 4
--   pcco_attachments: 3
--   people: 3
--   permission_audit_log: 2
--   permission_templates: 3
--   prime_contract_change_order_related_items: 2
--   prime_contract_payment_applications: 4
--   prime_contract_payments: 4
--   prime_contract_pco_attachments: 3
--   prime_contract_project_settings: 3
--   project_budget_codes: 4
--   project_budget_settings: 3
--   project_companies: 2
--   project_photos_punch_items_links: 2
--   project_progress_report_photos: 4
--   project_progress_reports: 3
--   project_role_members: 2
--   project_roles: 2
--   psr_comments: 3
--   punch_item_comments: 4
--   punch_item_template_categories: 2
--   punch_item_templates: 2
--   punch_items: 4
--   requests: 1
--   rfis_submittals_links: 2
--   specification_area_sections: 3
--   specification_areas: 4
--   specification_section_revisions: 4
--   specification_sections: 4
--   specification_subscribers: 3
--   sub_jobs: 2
--   subcontractor_sov_items: 1
--   subcontractor_sov_submissions: 1
--   submittal_attachments: 1
--   submittal_distribution_recipients: 1
--   submittal_distributions: 1
--   submittal_history: 1
--   submittal_linked_drawings: 1
--   submittal_packages: 1
--   submittal_responses: 1
--   submittal_workflow_steps: 1
--   system_alerts: 1
--   task_comments: 3
--   team_chat_channels: 2
--   team_chat_messages: 1
--   teams_link_codes: 2
--   telegram_link_codes: 2
--   todos: 4
--   user_directory_permissions: 2
--   user_email_notifications: 3
--   user_granular_permission_overrides: 2
--   user_module_permissions: 2
--   user_profiles: 2
--   user_project_preferences: 1
--   user_project_roles: 2
--   user_schedule_notifications: 3
--   workspace_artifacts: 4
--
-- Manual review required (complex expressions — edit by hand):
--   (none)
--
-- =============================================================================
-- Verification query — run AFTER applying to confirm no bare auth.uid() remain:
-- =============================================================================
--
-- select schemaname, tablename, policyname, cmd,
--        case when qual ~ 'auth\.uid\(\)' and qual !~ '\(select auth\.uid\(\)\)' then 'STILL BARE in qual' else 'ok' end as qual_status,
--        case when with_check ~ 'auth\.uid\(\)' and with_check !~ '\(select auth\.uid\(\)\)' then 'STILL BARE in with_check' else 'ok' end as wc_status
-- from pg_policies
-- where schemaname = 'public'
--   and (
--     (qual ~ 'auth\.uid\(\)' and qual !~ '\(select auth\.uid\(\)\)')
--     or (with_check ~ 'auth\.uid\(\)' and with_check !~ '\(select auth\.uid\(\)\)')
--   );
-- Expected: 0 rows returned.
-- =============================================================================

