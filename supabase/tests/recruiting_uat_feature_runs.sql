begin;

select plan(8);

select has_table(
  'public',
  'recruiting_uat_feature_runs',
  'UAT feature runs are persisted separately from production provider tables'
);

select col_is_pk(
  'public',
  'recruiting_uat_feature_runs',
  'id',
  'UAT feature runs have a stable identifier'
);

select col_not_null(
  'public',
  'recruiting_uat_feature_runs',
  'submission_id',
  'Every UAT feature run is attached to a synthetic submission'
);

select col_not_null(
  'public',
  'recruiting_uat_feature_runs',
  'result',
  'Every UAT feature run records its safe result'
);

select has_index(
  'public',
  'recruiting_uat_feature_runs',
  'recruiting_uat_feature_runs_submission_idx',
  'Submission history has a focused lookup index'
);

select policies_are(
  'public',
  'recruiting_uat_feature_runs',
  array['recruiting_uat_feature_runs_select'],
  'Only the explicit read policy is present'
);

select function_privs_are(
  'public',
  'recruiting_bind_uat_feature_run_expiry',
  array[]::text[],
  'anon',
  array[]::text[],
  'Anonymous users cannot invoke the expiry binding trigger'
);

select function_privs_are(
  'public',
  'recruiting_bind_uat_feature_run_expiry',
  array[]::text[],
  'authenticated',
  array[]::text[],
  'Authenticated users cannot invoke the expiry binding trigger directly'
);

select * from finish();
rollback;
