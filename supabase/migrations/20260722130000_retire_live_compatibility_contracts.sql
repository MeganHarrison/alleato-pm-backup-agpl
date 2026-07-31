-- Canonicalize promoted Outlook attachments and snapshot totals.
UPDATE public.document_metadata
SET source = 'microsoft_graph', source_system = 'outlook_attachment'
WHERE source_system = 'email_attachment_legacy';

UPDATE public.budget_snapshots
SET grand_totals = grand_totals - 'total_budget' - 'total_costs' - 'variance'
  || jsonb_build_object(
    'originalBudgetAmount', COALESCE((grand_totals->>'total_budget')::numeric, 0),
    'budgetModifications', 0, 'approvedCOs', 0,
    'revisedBudget', COALESCE((grand_totals->>'total_budget')::numeric, 0),
    'jobToDateCostDetail', 0, 'directCosts', 0, 'pendingChanges', 0,
    'projectedBudget', COALESCE((grand_totals->>'total_budget')::numeric, 0),
    'committedCosts', 0, 'pendingCostChanges', 0,
    'projectedCosts', COALESCE((grand_totals->>'total_costs')::numeric, 0),
    'forecastToComplete', 0,
    'estimatedCostAtCompletion', COALESCE((grand_totals->>'total_costs')::numeric, 0),
    'projectedOverUnder', COALESCE((grand_totals->>'total_budget')::numeric, 0) - COALESCE((grand_totals->>'total_costs')::numeric, 0)
  )
WHERE grand_totals ? 'total_budget' OR grand_totals ? 'total_costs' OR grand_totals ? 'variance';
