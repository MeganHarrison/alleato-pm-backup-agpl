-- Add Agentation-specific fields to dev_annotations.
-- agentation_id: unique ID from the Agentation toolbar — used for dedup and MCP status sync.
-- metadata: stores Agentation context (intent, severity, sessionId, reactComponents, etc.)

alter table dev_annotations
  add column if not exists agentation_id text unique,
  add column if not exists metadata jsonb;

create index if not exists dev_annotations_agentation_id_idx on dev_annotations (agentation_id);
