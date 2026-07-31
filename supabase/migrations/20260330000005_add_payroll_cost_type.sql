-- Add Payroll to direct_costs cost_type constraint
-- Procore supports Payroll as a direct cost type alongside Invoice, Expense, Subcontractor Invoice

ALTER TABLE public.direct_costs
DROP CONSTRAINT IF EXISTS direct_costs_cost_type_check;
ALTER TABLE public.direct_costs
ADD CONSTRAINT direct_costs_cost_type_check
CHECK (
  cost_type = ANY (
    ARRAY[
      'Expense'::text,
      'Invoice'::text,
      'Payroll'::text,
      'Subcontractor Invoice'::text
    ]
  )
);
