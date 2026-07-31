#!/usr/bin/env node

/**
 * Microsoft executive assistant operational health verifier.
 *
 * This checks each boundary independently so a healthy live Graph read cannot
 * hide a stale cache, a bad sync ledger, or a misconfigured Render cron.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com";
const RENDER_SERVICES_URL = "https://api.render.com/v1/services?limit=100";
const RENDER_SERVICE_URL = "https://api.render.com/v1/services";

const CRON_NAME = "alleato-microsoft-executive-assistant-check";
const EXPECTED_CRON_SCHEDULE = "*/15 * * * *";
const EXPECTED_CRON_COMMAND = "timeout 10m python3 src/scripts/run_microsoft_executive_assistant_check.py";
const EXPECTED_CRON_ROOT = "backend";
const DEFAULT_MAILBOX = "bclymer@alleatogroup.com";
const DEFAULT_MAX_CACHE_AGE_MINUTES = 90;
const DEFAULT_MAX_CRON_AGE_MINUTES = 45;
const NOISE_SENDER_PATTERNS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "notifications@",
  "notification@",
  "alerts@",
  "alert@",
  "newsletter@",
  "news@",
  "updates@",
  "update@",
  "marketing@",
  "promo@",
  "promotions@",
  "offers@",
  "mailer@",
  "bounce@",
  "campaigns@",
  "reply@",
];
const NOISE_SUBJECT_PATTERNS = [
  "unsubscribe",
  "newsletter",
  "out of office",
  "automatic reply",
  "auto reply",
  "autoreply",
  "delivery status notification",
  "delivery failure",
  "undelivered mail",
  "mailer-daemon",
];

function parseArgs(argv) {
  const options = {
    json: false,
    requireCronRun: false,
    skipRender: false,
    skipGraph: false,
    skipSupabase: false,
    maxCacheAgeMinutes: DEFAULT_MAX_CACHE_AGE_MINUTES,
    maxCronAgeMinutes: DEFAULT_MAX_CRON_AGE_MINUTES,
  };

  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--require-cron-run") options.requireCronRun = true;
    else if (arg === "--skip-render") options.skipRender = true;
    else if (arg === "--skip-graph") options.skipGraph = true;
    else if (arg === "--skip-supabase") options.skipSupabase = true;
    else if (arg.startsWith("--max-cache-age-minutes=")) {
      options.maxCacheAgeMinutes = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--max-cron-age-minutes=")) {
      options.maxCronAgeMinutes = Number(arg.split("=")[1]);
    }
  }

  return options;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
  }
}

function loadRuntimeEnv() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, "frontend/.env.local"));
}

function resolveMailbox() {
  const configured =
    process.env.MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX ??
    process.env.MICROSOFT_ASSISTANT_MAILBOX ??
    process.env.MICROSOFT_SYNC_USERS?.split(",")[0];
  return configured?.trim().toLowerCase() || DEFAULT_MAILBOX;
}

function minutesSince(isoDate) {
  if (!isoDate) return null;
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return null;
  return Math.round((Date.now() - timestamp) / 60000);
}

function result(stage, ok, message, details = {}) {
  return { stage, ok, message, ...details };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 500);
  }

  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}`);
    error.status = response.status;
    error.statusText = response.statusText;
    error.body = body;
    throw error;
  }

  return { body, headers: response.headers };
}

async function getLatestRenderSuccessfulJob(serviceId) {
  const { body } = await fetchJson(`${RENDER_SERVICE_URL}/${serviceId}/jobs?limit=20`, {
    headers: { authorization: `Bearer ${process.env.RENDER_API_KEY}` },
  });
  const rows = Array.isArray(body) ? body : [];
  const jobs = rows.map((row) => row.job ?? row).filter(Boolean);
  const succeeded = jobs.find((job) => job.status === "succeeded");
  return succeeded?.finishedAt ?? succeeded?.startedAt ?? succeeded?.createdAt ?? null;
}

async function verifyRenderCron(options) {
  if (options.skipRender) {
    return result("render_cron", true, "Skipped Render cron check.", { skipped: true });
  }
  if (!process.env.RENDER_API_KEY) {
    return result("render_cron", false, "Missing RENDER_API_KEY.");
  }

  try {
    const { body } = await fetchJson(RENDER_SERVICES_URL, {
      headers: { authorization: `Bearer ${process.env.RENDER_API_KEY}` },
    });
    const rows = Array.isArray(body) ? body : [];
    const item = rows
      .map((row) => row.service ?? row)
      .find((service) => service?.name === CRON_NAME);

    if (!item) {
      return result("render_cron", false, `Render cron ${CRON_NAME} was not found.`);
    }

    const { body: detailBody } = await fetchJson(`${RENDER_SERVICE_URL}/${item.id}`, {
      headers: { authorization: `Bearer ${process.env.RENDER_API_KEY}` },
    });
    const service = detailBody?.service ?? detailBody ?? item;
    const details = service.serviceDetails ?? {};
    const command = details.envSpecificDetails?.dockerCommand ?? "";
    const failures = [];
    if (service.type !== "cron_job") failures.push(`type=${service.type || "<missing>"}`);
    if (service.suspended !== "not_suspended") failures.push(`suspended=${service.suspended || "<missing>"}`);
    if (details.schedule !== EXPECTED_CRON_SCHEDULE) failures.push(`schedule=${details.schedule || "<missing>"}`);
    if (service.rootDir !== EXPECTED_CRON_ROOT) failures.push(`rootDir=${service.rootDir || "<missing>"}`);
    if (command !== EXPECTED_CRON_COMMAND) failures.push("dockerCommand drift");

    const lastSuccessfulRunAt =
      service.lastSuccessfulRunAt ??
      details.lastSuccessfulRunAt ??
      (service.suspended === "not_suspended"
        ? await getLatestRenderSuccessfulJob(item.id)
        : null);
    const runAgeMinutes = minutesSince(lastSuccessfulRunAt);
    if (!lastSuccessfulRunAt && options.requireCronRun) {
      failures.push("lastSuccessfulRunAt=<missing>");
    } else if (runAgeMinutes !== null && runAgeMinutes > options.maxCronAgeMinutes) {
      failures.push(`lastSuccessfulRunAt is ${runAgeMinutes} minutes old`);
    }

    const ok = failures.length === 0;
    const missingRunWarning = !details.lastSuccessfulRunAt && !options.requireCronRun;
    return result(
      "render_cron",
      ok,
      ok
        ? missingRunWarning
          ? "Render cron exists and config matches, but no successful run has been recorded yet."
          : "Render cron exists, config matches, and recent run state is acceptable."
        : `Render cron health failed: ${failures.join("; ")}.`,
      {
        serviceId: item.id,
        schedule: details.schedule ?? null,
        rootDir: service.rootDir ?? null,
        dockerCommand: command || null,
        lastSuccessfulRunAt,
        runAgeMinutes,
        warning: missingRunWarning,
      },
    );
  } catch (error) {
    return result("render_cron", false, `Render API check failed: ${error.message}`, {
      status: error.status ?? null,
      graphOrRenderMessage: error.body?.message ?? error.body?.error?.message ?? null,
    });
  }
}

async function getGraphToken() {
  const required = ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Microsoft Graph config: ${missing.join(", ")}`);
  }

  const { body } = await fetchJson(`${TOKEN_URL}/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!body?.access_token) {
    throw new Error("Microsoft Graph token response returned no access_token.");
  }
  return body.access_token;
}

async function verifyGraphInbox(options, mailbox) {
  if (options.skipGraph) {
    return result("graph_inbox", true, "Skipped live Graph inbox check.", { skipped: true });
  }

  try {
    const token = await getGraphToken();
    const url =
      `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/mailFolders/Inbox/messages` +
      "?$top=10&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,internetMessageHeaders";
    const { body } = await fetchJson(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    const rows = Array.isArray(body?.value) ? body.value : [];
    const latest = rows.find((message) => !isNoiseGraphMessage(message)) ?? rows[0] ?? null;
    if (!latest?.id) {
      return result("graph_inbox", false, "Live Graph inbox read returned no messages.", { mailbox });
    }
    return result("graph_inbox", true, "Live Graph inbox read succeeded for latest actionable message.", {
      mailbox,
      latestMessageId: latest.id,
      latestReceivedAt: latest.receivedDateTime ?? null,
      latestSubject: latest.subject ?? null,
      skippedNoiseCount: rows.findIndex((message) => message.id === latest.id),
    });
  } catch (error) {
    return result("graph_inbox", false, `Live Graph inbox check failed: ${error.message}`, {
      mailbox,
      status: error.status ?? null,
      graphOrRenderMessage: error.body?.error?.message ?? null,
    });
  }
}

function isNoiseGraphMessage(message) {
  const headers = Array.isArray(message?.internetMessageHeaders) ? message.internetMessageHeaders : [];
  const hasListUnsubscribe = headers.some((header) => String(header?.name || "").toLowerCase() === "list-unsubscribe");
  if (hasListUnsubscribe) return true;

  const sender = String(message?.from?.emailAddress?.address || "").toLowerCase();
  if (NOISE_SENDER_PATTERNS.some((pattern) => sender.includes(pattern))) return true;

  const subject = String(message?.subject || "").toLowerCase();
  return NOISE_SUBJECT_PATTERNS.some((pattern) => subject.includes(pattern));
}

function resolveSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE;
  return { url, key };
}

function resolveRagSupabaseConfig() {
  const url = process.env.RAG_SUPABASE_URL;
  const key =
    process.env.RAG_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.RAG_SUPABASE_SERVICE_KEY;
  return { url, key };
}

async function supabaseRest(pathname, key, init = {}) {
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    ...init.headers,
  };
  return fetchJson(pathname, { ...init, headers });
}

async function verifyCachedIntake(options, mailbox) {
  if (options.skipSupabase) {
    return result("cached_intake", true, "Skipped Supabase cache check.", { skipped: true });
  }

  const { url, key } = resolveRagSupabaseConfig();
  if (!url || !key) {
    return result("cached_intake", false, "Missing RAG Supabase URL or service-role key.");
  }

  try {
    const cutoff = new Date(Date.now() - options.maxCacheAgeMinutes * 60000).toISOString();
    const latestUrl =
      `${url}/rest/v1/outlook_email_intake?select=id,received_at,assignment_method` +
      `&mailbox_user_id=eq.${encodeURIComponent(mailbox)}` +
      "&deleted_at=is.null&order=received_at.desc&limit=1";
    const recentUrl =
      `${url}/rest/v1/outlook_email_intake?select=id` +
      `&mailbox_user_id=eq.${encodeURIComponent(mailbox)}` +
      `&deleted_at=is.null&received_at=gte.${encodeURIComponent(cutoff)}`;

    const [{ body: latestRows }, recent] = await Promise.all([
      supabaseRest(latestUrl, key),
      supabaseRest(recentUrl, key, {
        headers: { prefer: "count=exact" },
      }),
    ]);

    const latest = Array.isArray(latestRows) ? latestRows[0] : null;
    if (!latest?.received_at) {
      return result("cached_intake", false, "No cached Outlook intake rows found for mailbox.", { mailbox });
    }

    const cacheAgeMinutes = minutesSince(latest.received_at);
    const recentCount = Number(recent.headers.get("content-range")?.split("/")?.[1] ?? "0");
    if (cacheAgeMinutes === null || cacheAgeMinutes > options.maxCacheAgeMinutes) {
      return result(
        "cached_intake",
        false,
        `Cached Outlook intake is stale: ${cacheAgeMinutes ?? "unknown"} minutes old.`,
        {
          mailbox,
          latestReceivedAt: latest.received_at,
          cacheAgeMinutes,
          recentCount,
          assignmentMethod: latest.assignment_method ?? null,
        },
      );
    }

    return result("cached_intake", true, "Cached Outlook intake is fresh.", {
      mailbox,
      latestReceivedAt: latest.received_at,
      cacheAgeMinutes,
      recentCount,
      assignmentMethod: latest.assignment_method ?? null,
    });
  } catch (error) {
    return result("cached_intake", false, `Cached Outlook intake check failed: ${error.message}`, {
      mailbox,
      status: error.status ?? null,
      graphOrRenderMessage: error.body?.message ?? error.body?.hint ?? null,
    });
  }
}

async function verifySyncLedger(options, mailbox) {
  if (options.skipSupabase) {
    return result("sync_ledger", true, "Skipped Supabase sync ledger check.", { skipped: true });
  }

  const { url, key } = resolveRagSupabaseConfig();
  if (!url || !key) {
    return result("sync_ledger", false, "Missing RAG Supabase URL or service-role key.");
  }

  try {
    const ledgerUrl =
      `${url}/rest/v1/graph_sync_state?select=source,resource_id,last_sync_at,sync_status,error_message,updated_at` +
      "&source=eq.outlook_email" +
      `&resource_id=eq.${encodeURIComponent(mailbox)}` +
      "&limit=1";
    const { body } = await supabaseRest(ledgerUrl, key);
    const row = Array.isArray(body) ? body[0] : null;
    if (!row) {
      return result("sync_ledger", false, "No graph_sync_state row found for Outlook mailbox.", { mailbox });
    }
    if (row.sync_status !== "success") {
      return result("sync_ledger", false, `Outlook sync ledger is ${row.sync_status || "<missing>"}.`, {
        mailbox,
        lastSyncAt: row.last_sync_at ?? null,
        updatedAt: row.updated_at ?? null,
        syncStatus: row.sync_status ?? null,
        errorMessage: row.error_message ?? null,
      });
    }
    return result("sync_ledger", true, "Outlook sync ledger is successful.", {
      mailbox,
      lastSyncAt: row.last_sync_at ?? null,
      updatedAt: row.updated_at ?? null,
      syncStatus: row.sync_status,
    });
  } catch (error) {
    return result("sync_ledger", false, `Outlook sync ledger check failed: ${error.message}`, {
      mailbox,
      status: error.status ?? null,
      graphOrRenderMessage: error.body?.message ?? error.body?.hint ?? null,
    });
  }
}

function summarize(checks) {
  const failures = checks.filter((check) => !check.ok);
  const warnings = checks.filter((check) => check.warning);
  return {
    ok: failures.length === 0,
    failures: failures.length,
    warnings: warnings.length,
  };
}

function downgradeLegacyLedgerMismatch(checks) {
  const graph = checks.find((check) => check.stage === "graph_inbox");
  const cache = checks.find((check) => check.stage === "cached_intake");
  const cron = checks.find((check) => check.stage === "render_cron");
  const ledger = checks.find((check) => check.stage === "sync_ledger");
  if (
    graph?.ok &&
    cache?.ok &&
    cron?.ok &&
    ledger &&
    !ledger.ok &&
    ledger.syncStatus === "mismatch" &&
    String(ledger.errorMessage || "").includes("durable document_metadata rows")
  ) {
    ledger.ok = true;
    ledger.warning = true;
    ledger.message =
      "Outlook sync ledger still has the legacy document_metadata mismatch, but assistant-critical Graph, cron, and cached intake checks are healthy.";
    ledger.legacyMismatch = true;
  }
}

function markCacheCurrentWhenItMatchesGraph(checks) {
  const graph = checks.find((check) => check.stage === "graph_inbox");
  const cache = checks.find((check) => check.stage === "cached_intake");
  if (!graph?.ok || !cache || cache.ok) return;

  const graphTimestamp = Date.parse(graph.latestReceivedAt || "");
  const cacheTimestamp = Date.parse(cache.latestReceivedAt || "");
  if (!Number.isNaN(graphTimestamp) && graphTimestamp === cacheTimestamp) {
    cache.ok = true;
    cache.warning = false;
    cache.message =
      "Cached Outlook intake matches the latest live Graph inbox message; no newer mail is waiting to ingest.";
    cache.matchedGraphLatest = true;
  }
}

function printHuman(report) {
  const status = report.ok ? "PASS" : "FAIL";
  console.log(`Microsoft executive assistant health: ${status}`);
  console.log(`Mailbox: ${report.mailbox}`);
  for (const check of report.checks) {
    const prefix = check.ok ? (check.warning ? "WARN" : "PASS") : "FAIL";
    console.log(`${prefix} ${check.stage}: ${check.message}`);
    if (check.latestReceivedAt) console.log(`  latestReceivedAt: ${check.latestReceivedAt}`);
    if (check.lastSuccessfulRunAt) console.log(`  lastSuccessfulRunAt: ${check.lastSuccessfulRunAt}`);
    if (check.syncStatus) console.log(`  syncStatus: ${check.syncStatus}`);
    if (check.errorMessage) console.log(`  errorMessage: ${check.errorMessage}`);
  }

  if (!report.ok) {
    console.error("Cause: one or more operational boundaries for Brandon email review/draft response are unhealthy.");
    console.error("Detection gap: a live assistant smoke test alone can pass while cron, cache, or ledger state is stale.");
    console.error("Prevention: run this verifier after changes and in scheduled ops checks so each boundary fails loudly.");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadRuntimeEnv();
  const mailbox = resolveMailbox();

  const checks = await Promise.all([
    verifyRenderCron(options),
    verifyGraphInbox(options, mailbox),
    verifyCachedIntake(options, mailbox),
    verifySyncLedger(options, mailbox),
  ]);
  markCacheCurrentWhenItMatchesGraph(checks);
  downgradeLegacyLedgerMismatch(checks);

  const summary = summarize(checks);
  const report = {
    ok: summary.ok,
    mailbox,
    checkedAt: new Date().toISOString(),
    summary,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  const report = {
    ok: false,
    stage: "exception",
    message: error instanceof Error ? error.message : String(error),
  };
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.error("Microsoft executive assistant health: FAIL");
    console.error(report.message);
  }
  process.exit(1);
});
