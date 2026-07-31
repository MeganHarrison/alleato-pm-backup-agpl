#!/usr/bin/env node

import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL or SUPABASE_DB_URL.");
  process.exit(1);
}

const connectionUrl = new URL(databaseUrl);
connectionUrl.searchParams.delete("sslmode");

const client = new Client({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
  statement_timeout: 15000,
  query_timeout: 15000,
});

const failures = [];

try {
  await client.connect();

  const pipelineConfig = await client.query(`
    select value
    from public.pipeline_config
    where key = 'pipeline_url'
    limit 1
  `);

  const pipelineUrl = pipelineConfig.rows[0]?.value?.trim() ?? "";
  if (pipelineUrl) {
    failures.push(
      "public.pipeline_config.pipeline_url still exists. Pipeline dispatch must use the Vercel Workflow ingress.",
    );
  }

  const documentPipelineTriggers = await client.query(`
    select
      t.tgname,
      t.tgenabled,
      pg_get_triggerdef(t.oid, true) as trigger_def,
      pg_get_functiondef(p.oid) as function_def
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public'
      and c.relname = 'document_metadata'
      and not t.tgisinternal
      and (
        t.tgname like '%pipeline%'
        or t.tgname like '%ingestion_job%'
        or t.tgname like '%rag_job%'
      )
  `);

  const oldDispatcher = documentPipelineTriggers.rows.find(
    (row) =>
      row.tgname === "trg_enqueue_document_metadata_rag_job" ||
      row.function_def?.includes("net.http_post"),
  );
  if (oldDispatcher) {
    failures.push(
      `document_metadata trigger ${oldDispatcher.tgname} still owns network pipeline dispatch.`,
    );
  }
  const bookkeepingTrigger = documentPipelineTriggers.rows.find(
    (row) =>
      row.tgname ===
      "trg_record_document_metadata_ingestion_job",
  );
  if (!bookkeepingTrigger || bookkeepingTrigger.tgenabled !== "O") {
    failures.push(
      "document_metadata ingestion-job bookkeeping trigger is missing or disabled.",
    );
  }

  const staleStorageWebhook = await client.query(`
    select t.tgenabled, pg_get_triggerdef(t.oid, true) as trigger_def
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and t.tgname = 'meeting-upload-trigger'
      and not t.tgisinternal
    limit 1
  `);

  const webhookFunction = await client.query(`
    select
      case
        when to_regprocedure('supabase_functions.http_request()') is null
          then null
        else pg_get_functiondef(
          to_regprocedure('supabase_functions.http_request()')
        )
      end as definition
  `);

  const storageTrigger = staleStorageWebhook.rows[0];
  const httpRequestDefinition = webhookFunction.rows[0]?.definition ?? "";
  const retiredFirefliesUrl = "https://fireflies-pipeline.megan-d14.workers.dev/webhook/supabase-storage";
  const hasRetiredFirefliesCircuitBreaker =
    httpRequestDefinition.includes(retiredFirefliesUrl) &&
    httpRequestDefinition.includes("RETURN NEW");

  if (
    storageTrigger?.tgenabled !== "D" &&
    storageTrigger?.trigger_def?.includes(retiredFirefliesUrl) &&
    !hasRetiredFirefliesCircuitBreaker
  ) {
    failures.push(
      "storage.objects meeting-upload-trigger points at the retired Cloudflare Fireflies worker without a DB-side circuit breaker.",
    );
  }
} finally {
  await client.end().catch(() => {});
}

if (failures.length > 0) {
  console.error("DB pg_net suspension guardrail failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("DB pg_net suspension guardrail passed.");
