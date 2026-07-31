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
  if (pipelineUrl && process.env.ALLOW_DB_PIPELINE_TRIGGER !== "true") {
    failures.push(
      "public.pipeline_config.pipeline_url is enabled. Set ALLOW_DB_PIPELINE_TRIGGER=true only during a controlled replay window.",
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
    select pg_get_functiondef('supabase_functions.http_request()'::regprocedure) as definition
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
