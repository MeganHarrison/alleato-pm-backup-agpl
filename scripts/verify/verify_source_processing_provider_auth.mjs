#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getRagDatabaseUrl,
} from "./app-db-connection.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), override: false, quiet: true });

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  args.set(arg.slice(2), next && !next.startsWith("--") ? next : "true");
}

const lookbackHours = numberArg("hours", "SOURCE_PROVIDER_AUTH_LOOKBACK_HOURS", 24);
const maxGatewayCreditsFloor = Number(process.env.AI_GATEWAY_MIN_CREDITS_USD || "5");
const backendUrl = (
  process.env.PYTHON_BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://alleato-backend-rbnj.onrender.com"
).replace(/\/$/, "");

function numberArg(name, envName, fallback) {
  const raw = args.get(name) ?? process.env[envName];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`--${name} must be a positive number.`);
    process.exit(1);
  }
  return value;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function verifyGateway() {
  const failures = [];
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) {
    failures.push("AI_GATEWAY_API_KEY is not set in local verification env.");
    return { failures, credits: null, backendHealth: null };
  }

  const credits = await fetchJson("https://ai-gateway.vercel.sh/v1/credits", {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!credits.response.ok) {
    failures.push(
      `AI Gateway credit probe failed HTTP ${credits.response.status}: ${credits.payload?.error?.message ?? "unknown error"}`,
    );
  } else {
    const balance = Number(credits.payload.balance);
    if (!Number.isFinite(balance)) {
      failures.push("AI Gateway credit probe did not return a numeric balance.");
    } else if (balance < maxGatewayCreditsFloor) {
      failures.push(
        `AI Gateway credits below floor: balance=$${balance.toFixed(4)}, floor=$${maxGatewayCreditsFloor.toFixed(2)}.`,
      );
    }
  }

  const backendHealth = await fetchJson(`${backendUrl}/health`, {
    headers: { accept: "application/json" },
  }).catch((error) => ({
    response: { ok: false, status: "network" },
    payload: { error: error instanceof Error ? error.message : String(error) },
  }));
  if (!backendHealth.response.ok) {
    failures.push(
      `Backend health failed at ${backendUrl}/health: ${backendHealth.response.status} ${backendHealth.payload?.error ?? ""}`,
    );
  } else if (backendHealth.payload.ai_gateway_configured !== true) {
    failures.push("Backend health does not report ai_gateway_configured=true.");
  } else if (backendHealth.payload.embedding_provider_configured !== true) {
    failures.push("Backend health does not report embedding_provider_configured=true.");
  }

  return {
    failures,
    credits: credits.payload,
    backendHealth: backendHealth.payload,
  };
}

async function fetchUnresolvedAuthFailures() {
  const ragDatabaseUrl = getRagDatabaseUrl();
  if (!ragDatabaseUrl) {
    throw new Error("RAG_DATABASE_URL is required for source-processing auth verification.");
  }

  const pool = new pg.Pool({
    connectionString: await buildAppDatabaseConnectionString(ragDatabaseUrl, {
      includeSslMode: false,
      rewriteSupabaseDirectHost: false,
    }),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const { rows } = await pool.query(
      `
        with provider_events as (
          select
            source_document_id,
            source_system,
            status,
            updated_at,
            error_code,
            left(coalesce(error_message, ''), 240) as error_message,
            case
              when (
                error_code in ('AuthenticationError', 'authentication_error')
                or coalesce(error_message, '') ilike '%Authentication failed%'
                or coalesce(error_message, '') ilike '%AI_GATEWAY_API_KEY%'
              ) then 'auth_failure'
              else 'processing_success'
            end as event_kind
          from public.source_processing_jobs
          where updated_at >= now() - ($1::text || ' hours')::interval
            and (
              error_code in ('AuthenticationError', 'authentication_error')
              or coalesce(error_message, '') ilike '%Authentication failed%'
              or coalesce(error_message, '') ilike '%AI_GATEWAY_API_KEY%'
              or status in ('complete', 'indexed_for_rag', 'actions_routed', 'project_intelligence_updated')
            )

          union all

          select
            source_document_id,
            'source_intelligence_jobs' as source_system,
            status,
            updated_at,
            null as error_code,
            left(coalesce(last_error, ''), 240) as error_message,
            case
              when (
                coalesce(last_error, '') ilike '%Authentication failed%'
                or coalesce(last_error, '') ilike '%AI_GATEWAY_API_KEY%'
              ) then 'auth_failure'
              else 'processing_success'
            end as event_kind
          from public.source_intelligence_jobs
          where updated_at >= now() - ($1::text || ' hours')::interval
            and (
              status = 'succeeded'
              or coalesce(last_error, '') ilike '%Authentication failed%'
              or coalesce(last_error, '') ilike '%AI_GATEWAY_API_KEY%'
            )
        ),
        latest as (
          select distinct on (source_document_id)
            *
          from provider_events
          where source_document_id is not null
          order by source_document_id, updated_at desc
        )
        select
          source_document_id,
          source_system,
          status,
          updated_at,
          error_code,
          error_message
        from latest
        where event_kind = 'auth_failure'
        order by updated_at desc
      `,
      [lookbackHours],
    );
    return rows;
  } finally {
    await pool.end();
  }
}

const gateway = await verifyGateway();
const authFailures = await fetchUnresolvedAuthFailures();
const failures = [...gateway.failures];

if (authFailures.length > 0) {
  failures.push(
    `${authFailures.length} recent source_processing_jobs still have provider authentication failures.`,
  );
}

const summary = {
  ok: failures.length === 0,
  lookbackHours,
  backendUrl,
  aiGatewayBalance:
    gateway.credits && gateway.credits.balance !== undefined
      ? Number(gateway.credits.balance)
      : null,
  backendHealth: gateway.backendHealth
    ? {
        status: gateway.backendHealth.status,
        ai_provider_path: gateway.backendHealth.ai_provider_path,
        ai_gateway_configured: gateway.backendHealth.ai_gateway_configured,
        embedding_provider_configured: gateway.backendHealth.embedding_provider_configured,
      }
    : null,
  authFailures,
  failures,
};

if (failures.length > 0) {
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(summary, null, 2));
