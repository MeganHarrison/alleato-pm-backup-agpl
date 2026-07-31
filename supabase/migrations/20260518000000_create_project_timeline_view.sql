CREATE OR REPLACE VIEW project_timeline_events AS

-- Project created
SELECT
  created_at::timestamptz                                     AS occurred_at,
  'project_created'::text                                     AS kind,
  COALESCE(name, 'Project')                                   AS title,
  NULL::text                                                  AS summary,
  stage                                                       AS status,
  id::text                                                    AS entity_id,
  id                                                          AS project_id
FROM projects

UNION ALL

-- Construction start (only when start date is set)
SELECT
  "start date"::timestamptz                                   AS occurred_at,
  'project_start'::text                                       AS kind,
  'Construction start'                                        AS title,
  NULL::text                                                  AS summary,
  stage                                                       AS status,
  id::text                                                    AS entity_id,
  id                                                          AS project_id
FROM projects
WHERE "start date" IS NOT NULL

UNION ALL

-- Meetings (document_metadata where type = 'meeting')
SELECT
  date::timestamptz                                           AS occurred_at,
  'meeting'::text                                             AS kind,
  COALESCE(title, file_name, 'Meeting')                       AS title,
  overview                                                    AS summary,
  NULL::text                                                  AS status,
  id::text                                                    AS entity_id,
  project_id
FROM document_metadata
WHERE type = 'meeting'
  AND deleted_at IS NULL
  AND date IS NOT NULL
  AND project_id IS NOT NULL

UNION ALL

-- RFIs (subject is the short title; question is the full text)
SELECT
  COALESCE(date_initiated::timestamptz, created_at::timestamptz) AS occurred_at,
  'rfi'::text                                                 AS kind,
  'RFI #' || number::text || CASE
    WHEN subject IS NOT NULL AND subject <> '' THEN ': ' || LEFT(subject, 80)
    ELSE ''
  END                                                         AS title,
  NULL::text                                                  AS summary,
  status                                                      AS status,
  id::text                                                    AS entity_id,
  project_id::integer
FROM rfis

UNION ALL

-- Submittals
SELECT
  created_at::timestamptz                                     AS occurred_at,
  'submittal'::text                                           AS kind,
  'Submittal ' || submittal_number || ': ' || title           AS title,
  NULL::text                                                  AS summary,
  status                                                      AS status,
  id::text                                                    AS entity_id,
  project_id
FROM submittals
WHERE deleted_at IS NULL

UNION ALL

-- Commitments: creation event
SELECT
  created_at::timestamptz                                     AS occurred_at,
  'commitment'::text                                          AS kind,
  COALESCE(title, 'Commitment ' || contract_number)           AS title,
  NULL::text                                                  AS summary,
  status                                                      AS status,
  id::text                                                    AS entity_id,
  project_id
FROM commitments_unified
WHERE deleted_at IS NULL

UNION ALL

-- Commitments: execution event (contract_date = when the contract was dated/executed)
SELECT
  contract_date::timestamptz                                  AS occurred_at,
  'commitment_executed'::text                                 AS kind,
  COALESCE(title, 'Commitment ' || contract_number) || ' — executed'  AS title,
  NULL::text                                                  AS summary,
  status                                                      AS status,
  id::text                                                    AS entity_id,
  project_id
FROM commitments_unified
WHERE executed = true
  AND contract_date IS NOT NULL
  AND deleted_at IS NULL

UNION ALL

-- Change Events
SELECT
  created_at::timestamptz                                     AS occurred_at,
  'change_event'::text                                        AS kind,
  'CE #' || number || CASE
    WHEN title IS NOT NULL AND title <> '' THEN ': ' || LEFT(title, 80)
    WHEN scope IS NOT NULL AND scope <> '' THEN ': ' || LEFT(scope, 80)
    ELSE ''
  END                                                         AS title,
  description                                                 AS summary,
  status                                                      AS status,
  id::text                                                    AS entity_id,
  project_id::integer
FROM change_events
WHERE deleted_at IS NULL

UNION ALL

-- Change Orders
SELECT
  created_at::timestamptz                                     AS occurred_at,
  'change_order'::text                                        AS kind,
  CASE
    WHEN number IS NOT NULL THEN 'CO #' || number::text || ': ' || title
    ELSE title
  END                                                         AS title,
  description                                                 AS summary,
  status                                                      AS status,
  id::text                                                    AS entity_id,
  project_id
FROM change_orders

UNION ALL

-- Prime Contracts: creation event
SELECT
  created_at::timestamptz                                     AS occurred_at,
  'prime_contract'::text                                      AS kind,
  'Prime Contract ' || contract_number                        AS title,
  description                                                 AS summary,
  CASE WHEN executed THEN 'executed' ELSE 'draft' END         AS status,
  id::text                                                    AS entity_id,
  project_id
FROM prime_contracts

UNION ALL

-- Prime Contracts: execution event
SELECT
  executed_at::timestamptz                                    AS occurred_at,
  'prime_contract_executed'::text                             AS kind,
  'Prime Contract ' || contract_number || ' — executed'       AS title,
  NULL::text                                                  AS summary,
  'executed'                                                  AS status,
  id::text                                                    AS entity_id,
  project_id
FROM prime_contracts
WHERE executed = true
  AND executed_at IS NOT NULL;

GRANT SELECT ON project_timeline_events TO authenticated;
GRANT SELECT ON project_timeline_events TO anon;
