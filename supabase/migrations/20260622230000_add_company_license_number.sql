ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS license_number text;

COMMENT ON COLUMN public.companies.license_number
  IS 'Contractor or professional license number displayed on commitments and company records.';
