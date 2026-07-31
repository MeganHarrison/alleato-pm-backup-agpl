import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lgveqfnpkxvzbnnwuled.supabase.co';
const serviceKey = 'sb_secret_fDpzY_Eu0StzNOZsVKegRQ_d-G5k-Jf';
const managementToken = 'sbp_v0_dc89028c89d9d59e7999e775756f547343bee7d1';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(sql, description) {
  console.log(`\n🔄 Executing: ${description}...`);

  const response = await fetch(`https://api.supabase.com/v1/projects/lgveqfnpkxvzbnnwuled/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${managementToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const result = await response.json();

  if (result.error) {
    console.log(`❌ Failed: ${result.error.message}`);
    return false;
  } else {
    console.log(`✅ Success: ${description}`);
    return true;
  }
}

async function applyViews() {
  console.log('=== APPLYING BUDGET CALCULATION VIEWS ===\n');
  console.log('This will create the calculation views needed for budget rollup.\n');

  // Step 1: Create or replace the helper function first
  const updateFunctionSQL = `
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';`;

  await executeSql(updateFunctionSQL, 'Create update_updated_at function');

  // Step 2: Create the budget rollup view
  const rollupViewSQL = `
CREATE OR REPLACE VIEW v_budget_rollup AS
SELECT
    bl.id as budget_line_id,
    bl.project_id,
    bl.cost_code_id,
    bl.cost_type_id,
    bl.sub_job_id,
    bl.description,
    bl.original_amount as original_budget_amount,

    -- Budget Modifications (from existing budget_mod_lines)
    COALESCE(budget_mods.total_modifications, 0) as budget_modifications,

    -- Approved Change Orders (from existing change_event_line_items)
    COALESCE(approved_cos.total_approved_cos, 0) as approved_cos,

    -- Revised Budget = Original + Modifications + Approved COs
    bl.original_amount +
    COALESCE(budget_mods.total_modifications, 0) +
    COALESCE(approved_cos.total_approved_cos, 0) as revised_budget,

    -- Committed Costs (from existing commitment_change_order_lines)
    COALESCE(committed.total_committed, 0) as committed_costs,

    -- Direct Costs (from existing direct_costs table)
    COALESCE(direct_costs.total_direct_costs, 0) as direct_costs,

    -- Job to Date Cost = Direct Costs
    COALESCE(direct_costs.total_direct_costs, 0) as job_to_date_cost,

    -- Forecast to Complete (from new budget_line_forecasts or calculated)
    COALESCE(forecasts.forecast_to_complete,
        GREATEST(0, bl.original_amount - COALESCE(direct_costs.total_direct_costs, 0))
    ) as forecast_to_complete,

    -- Projected Costs = Job to Date + Forecast to Complete
    COALESCE(direct_costs.total_direct_costs, 0) +
    COALESCE(forecasts.forecast_to_complete,
        GREATEST(0, bl.original_amount - COALESCE(direct_costs.total_direct_costs, 0))
    ) as projected_costs,

    -- Projected Over/Under = Revised Budget - Projected Costs
    (bl.original_amount +
     COALESCE(budget_mods.total_modifications, 0) +
     COALESCE(approved_cos.total_approved_cos, 0)) -
    (COALESCE(direct_costs.total_direct_costs, 0) +
     COALESCE(forecasts.forecast_to_complete,
        GREATEST(0, bl.original_amount - COALESCE(direct_costs.total_direct_costs, 0))
     )) as projected_over_under

FROM budget_lines bl

-- Budget Modifications aggregation
LEFT JOIN (
    SELECT
        bml.cost_code_id,
        bml.project_id,
        bml.sub_job_id,
        bml.cost_type_id,
        SUM(bml.amount) as total_modifications
    FROM budget_mod_lines bml
    INNER JOIN budget_modifications bm ON bml.budget_modification_id = bm.id
    WHERE bm.status = 'approved'
    GROUP BY bml.cost_code_id, bml.project_id, bml.sub_job_id, bml.cost_type_id
) budget_mods ON budget_mods.cost_code_id = bl.cost_code_id
    AND budget_mods.project_id = bl.project_id
    AND (budget_mods.sub_job_id IS NULL AND bl.sub_job_id IS NULL OR budget_mods.sub_job_id = bl.sub_job_id)
    AND (budget_mods.cost_type_id IS NULL AND bl.cost_type_id IS NULL OR budget_mods.cost_type_id = bl.cost_type_id)

-- Approved Change Orders aggregation
LEFT JOIN (
    SELECT
        cel.cost_code_id,
        ce.project_id,
        SUM(COALESCE(cel.amount, 0)) as total_approved_cos
    FROM change_event_line_items cel
    INNER JOIN change_events ce ON cel.change_event_id = ce.id
    WHERE ce.status = 'closed'
    GROUP BY cel.cost_code_id, ce.project_id
) approved_cos ON approved_cos.cost_code_id = bl.cost_code_id
    AND approved_cos.project_id = bl.project_id

-- Committed Costs aggregation
LEFT JOIN (
    SELECT
        ccol.cost_code_id,
        bl_inner.project_id,
        SUM(ccol.amount) as total_committed
    FROM commitment_change_order_lines ccol
    INNER JOIN budget_lines bl_inner ON ccol.budget_line_id = bl_inner.id
    GROUP BY ccol.cost_code_id, bl_inner.project_id
) committed ON committed.cost_code_id = bl.cost_code_id
    AND committed.project_id = bl.project_id

-- Direct Costs aggregation
LEFT JOIN (
    SELECT
        dc.project_id,
        dc.cost_type as cost_code_id,
        SUM(dc.total_amount) as total_direct_costs
    FROM direct_costs dc
    WHERE dc.status = 'approved'
    GROUP BY dc.project_id, dc.cost_type
) direct_costs ON direct_costs.cost_code_id = bl.cost_code_id
    AND direct_costs.project_id = bl.project_id

-- Latest Forecasts
LEFT JOIN (
    SELECT
        blf.budget_line_id,
        blf.forecast_to_complete,
        ROW_NUMBER() OVER (PARTITION BY blf.budget_line_id ORDER BY blf.forecast_date DESC) as rn
    FROM budget_line_forecasts blf
) forecasts ON forecasts.budget_line_id = bl.id AND forecasts.rn = 1`;

  const viewCreated = await executeSql(rollupViewSQL, 'v_budget_rollup view');

  // Step 3: Create materialized view
  if (viewCreated) {
    const materializedViewSQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_budget_rollup AS
SELECT * FROM v_budget_rollup`;

    const mvCreated = await executeSql(materializedViewSQL, 'mv_budget_rollup materialized view');

    // Step 4: Create indexes on materialized view
    if (mvCreated) {
      await executeSql(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_budget_rollup_unique ON mv_budget_rollup(budget_line_id)`,
        'Unique index on mv_budget_rollup'
      );

      await executeSql(
        `CREATE INDEX IF NOT EXISTS idx_mv_budget_rollup_project ON mv_budget_rollup(project_id)`,
        'Project index on mv_budget_rollup'
      );

      await executeSql(
        `CREATE INDEX IF NOT EXISTS idx_mv_budget_rollup_cost_code ON mv_budget_rollup(cost_code_id)`,
        'Cost code index on mv_budget_rollup'
      );
    }
  }

  // Step 5: Create grand totals view
  const grandTotalsSQL = `
CREATE OR REPLACE VIEW v_budget_grand_totals AS
SELECT
    project_id,
    COUNT(*) as total_budget_lines,
    SUM(original_budget_amount) as total_original_budget,
    SUM(budget_modifications) as total_budget_modifications,
    SUM(approved_cos) as total_approved_cos,
    SUM(revised_budget) as total_revised_budget,
    SUM(committed_costs) as total_committed_costs,
    SUM(direct_costs) as total_direct_costs,
    SUM(job_to_date_cost) as total_job_to_date_cost,
    SUM(forecast_to_complete) as total_forecast_to_complete,
    SUM(projected_costs) as total_projected_costs,
    SUM(projected_over_under) as total_projected_over_under,

    -- Performance metrics
    CASE
        WHEN SUM(revised_budget) > 0
        THEN (SUM(projected_costs) / SUM(revised_budget)) * 100
        ELSE 0
    END as budget_utilization_percent,

    CASE
        WHEN SUM(projected_over_under) >= 0 THEN 'on_budget'
        ELSE 'over_budget'
    END as budget_status

FROM mv_budget_rollup
GROUP BY project_id`;

  await executeSql(grandTotalsSQL, 'v_budget_grand_totals view');

  // Step 6: Create helper functions
  const refreshFunctionSQL = `
CREATE OR REPLACE FUNCTION refresh_budget_rollup(p_project_id INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- Refresh materialized view concurrently to avoid locking
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_budget_rollup;

EXCEPTION
    WHEN OTHERS THEN
        -- If concurrent refresh fails, try regular refresh
        REFRESH MATERIALIZED VIEW mv_budget_rollup;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER`;

  await executeSql(refreshFunctionSQL, 'refresh_budget_rollup function');

  const snapshotFunctionSQL = `
CREATE OR REPLACE FUNCTION create_budget_snapshot(
    p_project_id INTEGER,
    p_name TEXT,
    p_type TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT NULL,
    p_set_as_baseline BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
    snapshot_id UUID;
BEGIN
    -- Clear previous baseline if setting new one
    IF p_set_as_baseline THEN
        UPDATE budget_snapshots
        SET is_baseline = false
        WHERE project_id = p_project_id AND is_baseline = true;
    END IF;

    -- Create snapshot record
    INSERT INTO budget_snapshots (
        project_id, name, snapshot_type, description,
        is_baseline, line_items, grand_totals, created_by
    )
    SELECT
        p_project_id,
        p_name,
        p_type,
        p_description,
        p_set_as_baseline,
        COALESCE(jsonb_agg(jsonb_build_object(
            'budget_line_id', budget_line_id,
            'cost_code_id', cost_code_id,
            'description', description,
            'original_budget', original_budget_amount,
            'revised_budget', revised_budget,
            'projected_costs', projected_costs,
            'over_under', projected_over_under,
            'forecast_to_complete', forecast_to_complete
        )), '[]'::jsonb) as line_items,
        (SELECT COALESCE(jsonb_build_object(
            'total_original_budget', total_original_budget,
            'total_revised_budget', total_revised_budget,
            'total_projected_costs', total_projected_costs,
            'total_over_under', total_projected_over_under,
            'budget_utilization_percent', budget_utilization_percent,
            'budget_status', budget_status
        ), '{}'::jsonb) FROM v_budget_grand_totals WHERE project_id = p_project_id) as grand_totals,
        auth.uid()
    FROM mv_budget_rollup
    WHERE project_id = p_project_id
    RETURNING id INTO snapshot_id;

    RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER`;

  await executeSql(snapshotFunctionSQL, 'create_budget_snapshot function');

  // Step 7: Grant permissions
  await executeSql('GRANT SELECT ON v_budget_rollup TO authenticated', 'Grant SELECT on v_budget_rollup');
  await executeSql('GRANT SELECT ON mv_budget_rollup TO authenticated', 'Grant SELECT on mv_budget_rollup');
  await executeSql('GRANT SELECT ON v_budget_grand_totals TO authenticated', 'Grant SELECT on v_budget_grand_totals');
  await executeSql('GRANT EXECUTE ON FUNCTION refresh_budget_rollup TO authenticated', 'Grant EXECUTE on refresh_budget_rollup');
  await executeSql('GRANT EXECUTE ON FUNCTION create_budget_snapshot TO authenticated', 'Grant EXECUTE on create_budget_snapshot');

  // Step 8: Refresh the materialized view with initial data
  await executeSql('REFRESH MATERIALIZED VIEW mv_budget_rollup', 'Initial refresh of materialized view');

  console.log('\n=== SUMMARY ===');
  console.log('Budget calculation views have been created.');
  console.log('The budget system is now fully operational.');
}

applyViews().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});