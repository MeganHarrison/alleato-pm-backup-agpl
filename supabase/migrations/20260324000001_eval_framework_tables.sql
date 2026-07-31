-- Eval Framework Tables
-- Supports: (1) raw scenario mining from emails/transcripts
--           (2) structured test cases for the Business Strategist Agent
--           (3) eval run results with LLM-as-judge scoring

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Raw scenarios mined from historical data (Phase 1 output)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eval_scenarios_raw (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project TEXT,
    problem_type TEXT CHECK (problem_type IN (
        'cost_overrun', 'timeline_delay', 'client_escalation',
        'scope_creep', 'margin_compression', 'resource_conflict',
        'safety_issue', 'quality_issue', 'other'
    )),
    description TEXT NOT NULL,
    date_range TEXT,
    early_warning_signals JSONB DEFAULT '[]'::jsonb,
    ideal_agent_action TEXT,
    data_sources_needed JSONB DEFAULT '[]'::jsonb,
    source TEXT DEFAULT 'email_mining',
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    curated BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE eval_scenarios_raw IS 'Raw problem scenarios mined from emails/transcripts for eval set bootstrapping';
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Structured eval test cases (Phase 2 input)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eval_test_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'data_retrieval', 'insight_quality', 'recommendation',
        'proactive_alert', 'cross_source_synthesis', 'financial_analysis'
    )),
    query TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    should_identify JSONB DEFAULT '[]'::jsonb,
    should_recommend JSONB DEFAULT '[]'::jsonb,
    should_not_miss JSONB DEFAULT '[]'::jsonb,
    scoring_method TEXT DEFAULT 'llm_judge' CHECK (scoring_method IN ('llm_judge', 'human_review', 'both')),
    pass_threshold NUMERIC(3,2) DEFAULT 0.70,
    source_scenario_id UUID REFERENCES eval_scenarios_raw(id),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE eval_test_cases IS 'Structured test cases for Business Strategist Agent evaluation';
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Eval run results (Phase 2 output)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eval_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_name TEXT,
    agent_version TEXT,
    model TEXT,
    total_cases INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    avg_score NUMERIC(4,3),
    summary JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);
COMMENT ON TABLE eval_runs IS 'Top-level eval run metadata and aggregate scores';
CREATE TABLE IF NOT EXISTS eval_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES eval_test_cases(id),
    agent_response TEXT,
    score NUMERIC(4,3),
    passed BOOLEAN,
    missed_items JSONB DEFAULT '[]'::jsonb,
    judge_reasoning TEXT,
    latency_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE eval_results IS 'Per-test-case results from an eval run';
-- Indexes
CREATE INDEX IF NOT EXISTS idx_eval_scenarios_raw_curated ON eval_scenarios_raw(curated) WHERE curated = TRUE;
CREATE INDEX IF NOT EXISTS idx_eval_scenarios_raw_problem_type ON eval_scenarios_raw(problem_type);
CREATE INDEX IF NOT EXISTS idx_eval_test_cases_category ON eval_test_cases(category);
CREATE INDEX IF NOT EXISTS idx_eval_test_cases_enabled ON eval_test_cases(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_eval_results_run_id ON eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_test_case_id ON eval_results(test_case_id);
