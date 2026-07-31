-- ============================================================================
-- Two-Tier PCO Tables: Prime Contract PCOs + Commitment PCOs
-- Implements the intermediate "Potential Change Order" step between
-- Change Events and official Change Orders.
-- ============================================================================

-- -------------------------------------------------------
-- 1. Prime Contract Potential Change Orders
-- -------------------------------------------------------
CREATE TABLE public.prime_contract_pcos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    prime_contract_id UUID NOT NULL REFERENCES public.prime_contracts(id) ON DELETE CASCADE,
    pco_number TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'approved', 'void')),
    description TEXT,
    total_amount NUMERIC(14, 2) DEFAULT 0,
    schedule_impact INTEGER,
    designated_reviewer_id UUID,
    due_date TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    promoted_to_co_id BIGINT REFERENCES public.prime_contract_change_orders(id),
    promoted_at TIMESTAMPTZ
);
CREATE INDEX idx_prime_contract_pcos_project ON public.prime_contract_pcos(project_id);
CREATE INDEX idx_prime_contract_pcos_contract ON public.prime_contract_pcos(prime_contract_id);
CREATE INDEX idx_prime_contract_pcos_status ON public.prime_contract_pcos(status);
-- -------------------------------------------------------
-- 2. Commitment Potential Change Orders
-- -------------------------------------------------------
CREATE TABLE public.commitment_pcos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    commitment_id UUID NOT NULL,
    commitment_type TEXT NOT NULL
        CHECK (commitment_type IN ('subcontract', 'purchase_order')),
    pco_number TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'approved', 'void')),
    description TEXT,
    total_amount NUMERIC(14, 2) DEFAULT 0,
    schedule_impact INTEGER,
    designated_reviewer_id UUID,
    due_date TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    promoted_to_co_id UUID REFERENCES public.contract_change_orders(id),
    promoted_at TIMESTAMPTZ
);
CREATE INDEX idx_commitment_pcos_project ON public.commitment_pcos(project_id);
CREATE INDEX idx_commitment_pcos_commitment ON public.commitment_pcos(commitment_id);
CREATE INDEX idx_commitment_pcos_status ON public.commitment_pcos(status);
-- -------------------------------------------------------
-- 3. PCO Line Items (shared for both types)
-- -------------------------------------------------------
CREATE TABLE public.pco_line_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pco_id UUID NOT NULL,
    pco_type TEXT NOT NULL
        CHECK (pco_type IN ('prime', 'commitment')),
    change_event_id UUID REFERENCES public.change_events(id),
    change_event_line_item_id UUID REFERENCES public.change_event_line_items(id),
    budget_code_id UUID,
    description TEXT,
    quantity NUMERIC DEFAULT 1,
    unit_of_measure TEXT,
    unit_cost NUMERIC(14, 2) DEFAULT 0,
    amount NUMERIC(14, 2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pco_line_items_pco ON public.pco_line_items(pco_id, pco_type);
CREATE INDEX idx_pco_line_items_change_event ON public.pco_line_items(change_event_id);
-- -------------------------------------------------------
-- 4. Change Event ↔ PCO Links (many-to-many)
-- -------------------------------------------------------
CREATE TABLE public.change_event_pco_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    change_event_id UUID NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
    pco_id UUID NOT NULL,
    pco_type TEXT NOT NULL
        CHECK (pco_type IN ('prime', 'commitment')),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    linked_by UUID
);
CREATE UNIQUE INDEX idx_change_event_pco_links_unique
    ON public.change_event_pco_links(change_event_id, pco_id, pco_type);
CREATE INDEX idx_change_event_pco_links_pco ON public.change_event_pco_links(pco_id, pco_type);
-- -------------------------------------------------------
-- 5. Add tracking columns to change_events
-- -------------------------------------------------------
ALTER TABLE public.change_events
    ADD COLUMN IF NOT EXISTS sent_to_prime_pco BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS sent_to_commitment_pco BOOLEAN DEFAULT false;
-- -------------------------------------------------------
-- 6. RLS Policies
-- -------------------------------------------------------
ALTER TABLE public.prime_contract_pcos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_pcos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pco_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_event_pco_links ENABLE ROW LEVEL SECURITY;
-- Allow authenticated users full access (project-level auth handled in app layer)
CREATE POLICY "Authenticated users can manage prime_contract_pcos"
    ON public.prime_contract_pcos FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage commitment_pcos"
    ON public.commitment_pcos FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage pco_line_items"
    ON public.pco_line_items FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage change_event_pco_links"
    ON public.change_event_pco_links FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);
-- Service role bypass
CREATE POLICY "Service role full access to prime_contract_pcos"
    ON public.prime_contract_pcos FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to commitment_pcos"
    ON public.commitment_pcos FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to pco_line_items"
    ON public.pco_line_items FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to change_event_pco_links"
    ON public.change_event_pco_links FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);
-- -------------------------------------------------------
-- 7. Auto-number function for PCOs
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_pco_number(
    p_project_id INTEGER,
    p_type TEXT -- 'prime' or 'commitment'
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_num INTEGER;
    prefix TEXT;
BEGIN
    prefix := CASE p_type
        WHEN 'prime' THEN 'PPCO'
        WHEN 'commitment' THEN 'CPCO'
        ELSE 'PCO'
    END;

    IF p_type = 'prime' THEN
        SELECT COALESCE(MAX(
            CASE WHEN pco_number ~ ('^' || prefix || '-\d+$')
                 THEN CAST(SUBSTRING(pco_number FROM '\d+$') AS INTEGER)
                 ELSE 0
            END
        ), 0) + 1 INTO next_num
        FROM public.prime_contract_pcos
        WHERE project_id = p_project_id;
    ELSE
        SELECT COALESCE(MAX(
            CASE WHEN pco_number ~ ('^' || prefix || '-\d+$')
                 THEN CAST(SUBSTRING(pco_number FROM '\d+$') AS INTEGER)
                 ELSE 0
            END
        ), 0) + 1 INTO next_num
        FROM public.commitment_pcos
        WHERE project_id = p_project_id;
    END IF;

    RETURN prefix || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$;
