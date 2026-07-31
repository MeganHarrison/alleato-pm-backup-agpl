-- Seed company_process intelligence targets for domain-level (non-project)
-- synthesis. Each row becomes a packet target the compiler can refresh and the
-- AI assistant can pull via the getDomainIntelligence tool.
--
-- Domains chosen to align with the existing C-Suite specialist agents
-- (CFO, COO, VPBD, CHRO) so cross-project questions like "what's going on
-- with accounting?" have a pre-built synthesis to read from.
--
-- Idempotent via `on conflict (slug) do nothing` — safe to re-run.

insert into public.intelligence_targets (target_type, name, slug, description, status, priority, metadata)
values
  (
    'company_process',
    'Accounting Function',
    'accounting',
    'AP, AR, billing, WIP reporting, accounting software, financial controls. Cross-project view of the accounting function as an operating system.',
    'active',
    'high',
    jsonb_build_object(
      'specialist_agent', 'cfo',
      'source_filters', jsonb_build_object(
        'keywords', jsonb_build_array('accounting','accounts payable','accounts receivable','AP','AR','invoice','billing','pay app','WIP','Acumatica','QuickBooks','retention','retainage'),
        'meeting_titles', jsonb_build_array('Accounting','AP','AR','Billing','Weekly Accounting')
      )
    )
  ),
  (
    'company_process',
    'Operations',
    'operations',
    'Field operations, project execution, scheduling, safety, quality, and superintendent coordination across the portfolio.',
    'active',
    'high',
    jsonb_build_object(
      'specialist_agent', 'coo',
      'source_filters', jsonb_build_object(
        'keywords', jsonb_build_array('operations','field','superintendent','safety','schedule','OAC','site walk','punch list','closeout')
      )
    )
  ),
  (
    'company_process',
    'Business Development',
    'business-development',
    'Pipeline, pursuits, owner relationships, proposals, and new-work origination across all markets.',
    'active',
    'medium',
    jsonb_build_object(
      'specialist_agent', 'vpbd',
      'source_filters', jsonb_build_object(
        'keywords', jsonb_build_array('pursuit','proposal','RFP','pipeline','lead','BD','business development','owner meeting','pre-construction')
      )
    )
  ),
  (
    'company_process',
    'People & Talent',
    'people-talent',
    'Hiring, onboarding, retention, performance, compensation, and organizational structure.',
    'active',
    'medium',
    jsonb_build_object(
      'specialist_agent', 'chro',
      'source_filters', jsonb_build_object(
        'keywords', jsonb_build_array('hire','hiring','onboarding','interview','candidate','PTO','benefits','review','performance','offer letter','salary','headcount','HR')
      )
    )
  )
on conflict (slug) do nothing;

-- Verification: log how many domain targets are present.
do $$
declare
  domain_count integer;
begin
  select count(*) into domain_count
    from public.intelligence_targets
    where target_type = 'company_process' and status = 'active';
  raise notice 'company_process intelligence_targets active: %', domain_count;
end $$;
