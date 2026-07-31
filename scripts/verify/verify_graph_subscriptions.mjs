#!/usr/bin/env node

/**
 * Microsoft Graph webhook subscription readiness verifier.
 *
 * Scheduled sync can be healthy while webhook monitoring is down. This verifier
 * fails loudly when Outlook has no active Graph subscriptions so production
 * readiness cannot be inferred from polling/cache checks alone.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_SOURCE = "outlook_email";

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

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    minActive: null,
    requireConfiguredTargets: true,
    json: false,
  };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--no-require-configured-targets") options.requireConfiguredTargets = false;
    else if (arg.startsWith("--source=")) options.source = arg.split("=")[1] || DEFAULT_SOURCE;
    else if (arg.startsWith("--min-active=")) options.minActive = Number(arg.split("=")[1]);
  }
  if (options.minActive !== null && (!Number.isFinite(options.minActive) || options.minActive < 0)) {
    throw new Error("--min-active must be a non-negative number");
  }
  return options;
}

function configuredOutlookTargets() {
  return String(process.env.MICROSOFT_SYNC_USERS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function parseExpiration(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveRagSupabaseConfig() {
  return {
    url:
      process.env.RAG_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL,
    key:
      process.env.RAG_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.RAG_SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY,
  };
}

async function supabaseRest(url, key) {
  const response = await fetch(url, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 500);
  }
  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}`);
    error.body = body;
    throw error;
  }
  return body;
}

async function main() {
  loadRuntimeEnv();
  const options = parseArgs(process.argv.slice(2));
  const { url, key } = resolveRagSupabaseConfig();
  if (!url || !key) {
    throw new Error("Missing RAG Supabase URL or service-role key.");
  }

  const encodedSource = encodeURIComponent(options.source);
  const subscriptions = await supabaseRest(
    `${url}/rest/v1/graph_subscriptions?` +
      "select=source,resource_id,resource_name,status,expiration_at,last_notification_at,last_renewed_at,last_error_message,updated_at" +
      `&source=eq.${encodedSource}` +
      "&order=updated_at.desc&limit=50",
    key,
  );
  const syncStates = await supabaseRest(
    `${url}/rest/v1/graph_sync_state?` +
      "select=source,resource_id,resource_name,sync_status,last_sync_at,items_synced,error_message,updated_at" +
      `&source=eq.${encodedSource}` +
      "&order=updated_at.desc&limit=50",
    key,
  );

  const now = new Date();
  const activeSubscriptions = subscriptions.filter((row) => row.status === "active");
  const expiredActiveSubscriptions = activeSubscriptions.filter((row) => {
    const expiration = parseExpiration(row.expiration_at);
    return !expiration || expiration <= now;
  });
  const validActiveSubscriptions = activeSubscriptions.filter((row) => {
    const expiration = parseExpiration(row.expiration_at);
    return expiration && expiration > now;
  });
  const staleSubscriptions = subscriptions.filter((row) => !["active", "removed"].includes(row.status));
  const erroredSyncStates = syncStates.filter((row) => row.sync_status === "error" || row.error_message);
  const expectedTargets = options.source === "outlook_email" && options.requireConfiguredTargets
    ? configuredOutlookTargets()
    : [];
  const activeByResourceId = new Set(
    validActiveSubscriptions.map((row) => String(row.resource_id || "").toLowerCase()).filter(Boolean),
  );
  const missingActiveTargets = expectedTargets.filter((resourceId) => !activeByResourceId.has(resourceId));
  const expectedTargetSet = new Set(expectedTargets);
  const unconfiguredSubscriptions = expectedTargets.length > 0
    ? subscriptions.filter((row) => {
      const resourceId = String(row.resource_id || "").toLowerCase();
      return resourceId && !expectedTargetSet.has(resourceId) && row.status !== "removed";
    })
    : [];
  const minActiveSubscriptions = options.minActive ?? (expectedTargets.length > 0 ? expectedTargets.length : 1);
  const ok = (
    validActiveSubscriptions.length >= minActiveSubscriptions &&
    missingActiveTargets.length === 0 &&
    expiredActiveSubscriptions.length === 0 &&
    staleSubscriptions.length === 0 &&
    unconfiguredSubscriptions.length === 0
  );
  const payload = {
    ok,
    checkedAt: new Date().toISOString(),
    source: options.source,
    minActiveSubscriptions,
    expectedTargetCount: expectedTargets.length,
    missingActiveTargets,
    subscriptionCount: subscriptions.length,
    activeSubscriptionCount: activeSubscriptions.length,
    validActiveSubscriptionCount: validActiveSubscriptions.length,
    expiredActiveSubscriptionCount: expiredActiveSubscriptions.length,
    staleSubscriptionCount: staleSubscriptions.length,
    unconfiguredSubscriptionCount: unconfiguredSubscriptions.length,
    syncStateCount: syncStates.length,
    erroredSyncStateCount: erroredSyncStates.length,
    subscriptions,
    expiredActiveSubscriptions,
    staleSubscriptions,
    unconfiguredSubscriptions,
    syncStates,
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (ok) {
    console.log(
      `Graph subscriptions: PASS (${validActiveSubscriptions.length}/${subscriptions.length} unexpired active ${options.source} subscription(s); ${syncStates.length} sync state row(s))`,
    );
  } else {
    console.error("Graph subscriptions: FAIL");
    console.error(
      `Expected at least ${minActiveSubscriptions} unexpired active ${options.source} subscription(s), found ${validActiveSubscriptions.length}.`,
    );
    if (missingActiveTargets.length > 0) {
      console.error(`Missing active subscriptions for configured target(s): ${missingActiveTargets.join(", ")}.`);
    }
    if (expiredActiveSubscriptions.length > 0) {
      console.error(`Expired active subscription row(s): ${expiredActiveSubscriptions.length}.`);
    }
    if (staleSubscriptions.length > 0) {
      console.error(`Stale subscription row(s): ${staleSubscriptions.length}.`);
    }
    if (unconfiguredSubscriptions.length > 0) {
      console.error(`Unconfigured active subscription row(s): ${unconfiguredSubscriptions.length}.`);
    }
    console.error(`Subscription rows: ${subscriptions.length}; sync state rows: ${syncStates.length}; errored sync states: ${erroredSyncStates.length}.`);
    for (const row of subscriptions.slice(0, 5)) {
      console.error(
        ` - ${row.resource_name || row.resource_id}: status=${row.status || "<missing>"} expiration=${row.expiration_at || "<missing>"} error=${row.last_error_message || "<none>"}`,
      );
    }
    for (const row of expiredActiveSubscriptions.slice(0, 5)) {
      console.error(
        ` - expired ${row.resource_name || row.resource_id}: expiration=${row.expiration_at || "<missing>"}`,
      );
    }
  }

  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(`Graph subscriptions: ERROR ${error.message}`);
  if (error.body) console.error(JSON.stringify(error.body, null, 2));
  process.exit(1);
});
