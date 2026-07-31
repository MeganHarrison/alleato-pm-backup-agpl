-- Optimize global vendor directory filters and sort paths.
-- These are partial indexes because /api/directory/vendors always scopes to
-- companies.is_vendor = true before applying status/class/payment filters.

CREATE INDEX IF NOT EXISTS idx_companies_vendor_name
  ON public.companies (name)
  WHERE is_vendor = true;

CREATE INDEX IF NOT EXISTS idx_companies_vendor_status_name
  ON public.companies (status, name)
  WHERE is_vendor = true;

CREATE INDEX IF NOT EXISTS idx_companies_vendor_class_name
  ON public.companies (vendor_class, name)
  WHERE is_vendor = true
    AND vendor_class IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_vendor_payment_method_name
  ON public.companies (payment_method, name)
  WHERE is_vendor = true
    AND payment_method IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_vendor_acumatica_id
  ON public.companies (acumatica_vendor_id)
  WHERE is_vendor = true
    AND acumatica_vendor_id IS NOT NULL;
