-- A project owns one explicit working-week calendar. Exceptions support both
-- holidays and intentional weekend work without hard-coding either in CPM.
CREATE TABLE IF NOT EXISTS public.project_schedule_calendars (
  project_id integer PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  working_weekdays smallint[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_schedule_calendars_weekdays_check CHECK (
    cardinality(working_weekdays) > 0
    AND working_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
  )
);

CREATE TABLE IF NOT EXISTS public.project_schedule_calendar_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  is_working boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_schedule_calendar_exceptions_unique UNIQUE (project_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_project_schedule_calendar_exceptions_project_date
  ON public.project_schedule_calendar_exceptions(project_id, exception_date);

CREATE TRIGGER project_schedule_calendars_updated_at
  BEFORE UPDATE ON public.project_schedule_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER project_schedule_calendar_exceptions_updated_at
  BEFORE UPDATE ON public.project_schedule_calendar_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_schedule_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_schedule_calendar_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_schedule_calendars_authenticated_access
  ON public.project_schedule_calendars FOR ALL TO authenticated
  USING (public.current_is_app_admin() OR public.current_is_project_member(project_id))
  WITH CHECK (public.current_is_app_admin() OR public.current_is_project_member(project_id));

CREATE POLICY project_schedule_calendar_exceptions_authenticated_access
  ON public.project_schedule_calendar_exceptions FOR ALL TO authenticated
  USING (public.current_is_app_admin() OR public.current_is_project_member(project_id))
  WITH CHECK (public.current_is_app_admin() OR public.current_is_project_member(project_id));
