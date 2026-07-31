-- Project vendors junction table
-- Vendors must be imported from Acumatica; this table links them to projects

CREATE TABLE IF NOT EXISTS public.project_vendors (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES public.people(id),
  notes text,
  CONSTRAINT project_vendors_pkey PRIMARY KEY (id),
  CONSTRAINT project_vendors_project_vendor_key UNIQUE (project_id, vendor_id)
);
CREATE INDEX IF NOT EXISTS idx_project_vendors_project ON public.project_vendors USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_project_vendors_vendor ON public.project_vendors USING btree (vendor_id);
