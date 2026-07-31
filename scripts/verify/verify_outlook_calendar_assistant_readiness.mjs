#!/usr/bin/env node

/**
 * Outlook calendar assistant readiness verifier.
 *
 * This is intentionally non-destructive. It checks whether the configured
 * Microsoft Graph app token can support the AI assistant's
 * createOutlookCalendarInvite tool before any calendar event write is attempted.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com";
const CALENDAR_WRITE_PERMISSIONS = new Set([
  "Calendars.ReadWrite",
  "Calendars.ReadWrite.Shared",
]);

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

function resolveOrganizerEmail() {
  const configured =
    process.env.MICROSOFT_CALENDAR_USER ??
    process.env.OUTLOOK_CALENDAR_USER ??
    process.env.MICROSOFT_SYNC_USERS?.split(",")[0];
  return configured?.trim().toLowerCase() || null;
}

function requireConfig() {
  const required = [
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);
  const organizerEmail = resolveOrganizerEmail();
  if (!organizerEmail) missing.push("MICROSOFT_CALENDAR_USER or OUTLOOK_CALENDAR_USER or MICROSOFT_SYNC_USERS");
  if (missing.length > 0) {
    return {
      ok: false,
      stage: "config",
      message: `Missing required config: ${missing.join(", ")}`,
      missing,
    };
  }
  return { ok: true, organizerEmail };
}

async function getGraphToken() {
  const response = await fetch(`${TOKEN_URL}/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      stage: "token",
      message: `Microsoft Graph token request failed: ${response.status} ${response.statusText}`,
      status: response.status,
      statusText: response.statusText,
    };
  }

  const data = await response.json();
  if (!data.access_token) {
    return {
      ok: false,
      stage: "token",
      message: "Microsoft Graph token request returned no access_token.",
    };
  }
  return { ok: true, token: data.access_token };
}

function decodeTokenClaims(token) {
  const [, payload] = token.split(".");
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function getPermissionStatus(token) {
  const claims = decodeTokenClaims(token);
  const roles = Array.isArray(claims.roles)
    ? claims.roles.filter((role) => typeof role === "string")
    : [];
  const scopes = typeof claims.scp === "string"
    ? claims.scp.split(/\s+/).filter(Boolean)
    : [];
  const granted = new Set([...roles, ...scopes]);
  return {
    ok: [...CALENDAR_WRITE_PERMISSIONS].some((permission) => granted.has(permission)),
    roles,
    scopes,
    appId: typeof claims.appid === "string" ? claims.appid : null,
    tenantId: typeof claims.tid === "string" ? claims.tid : null,
  };
}

async function verifyCalendarMailboxAccess(token, organizerEmail) {
  const response = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(organizerEmail)}/calendar?$select=id,name,owner`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const bodyText = await response.text();
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText.slice(0, 500);
  }

  if (!response.ok) {
    return {
      ok: false,
      stage: "calendar_read",
      message: `Microsoft Graph calendar read failed: ${response.status} ${response.statusText}`,
      status: response.status,
      statusText: response.statusText,
      body,
    };
  }

  return {
    ok: true,
    calendarName: body?.name ?? null,
    ownerAddress: body?.owner?.address ?? null,
  };
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    console.log("Outlook calendar assistant readiness: PASS");
    console.log(`Organizer: ${result.organizerEmail}`);
    console.log(`App ID: ${result.appId ?? "unknown"}`);
    console.log(`Calendar: ${result.calendarName ?? "unknown"}`);
    return;
  }

  console.error("Outlook calendar assistant readiness: FAIL");
  console.error(`Stage: ${result.stage}`);
  console.error(result.message);
  if (result.organizerEmail) console.error(`Organizer: ${result.organizerEmail}`);
  if (result.roles) console.error(`Detected Graph roles: ${result.roles.join(", ") || "none"}`);
  if (result.body?.error?.code) console.error(`Graph error: ${result.body.error.code}`);
  if (result.body?.error?.message) console.error(`Graph message: ${result.body.error.message}`);
  console.error("Cause: the assistant calendar tool requires Microsoft Graph calendar write access before it can create Outlook invites.");
  console.error("Prevention: grant Calendars.ReadWrite application permission and admin consent, then rerun this verifier before live invite testing.");
}

async function main() {
  const json = process.argv.includes("--json");
  loadRuntimeEnv();

  const config = requireConfig();
  if (!config.ok) {
    printResult(config, json);
    process.exit(1);
  }

  const tokenResult = await getGraphToken();
  if (!tokenResult.ok) {
    printResult({ ...tokenResult, organizerEmail: config.organizerEmail }, json);
    process.exit(1);
  }

  const permissionStatus = getPermissionStatus(tokenResult.token);
  if (!permissionStatus.ok) {
    printResult(
      {
        ok: false,
        stage: "calendar_permission",
        message: "Microsoft Graph token does not include Calendars.ReadWrite.",
        organizerEmail: config.organizerEmail,
        ...permissionStatus,
      },
      json,
    );
    process.exit(1);
  }

  const mailboxAccess = await verifyCalendarMailboxAccess(tokenResult.token, config.organizerEmail);
  if (!mailboxAccess.ok) {
    printResult(
      {
        ...mailboxAccess,
        organizerEmail: config.organizerEmail,
        ...permissionStatus,
      },
      json,
    );
    process.exit(1);
  }

  printResult(
    {
      ok: true,
      organizerEmail: config.organizerEmail,
      ...permissionStatus,
      ...mailboxAccess,
    },
    json,
  );
}

main().catch((error) => {
  printResult(
    {
      ok: false,
      stage: "exception",
      message: error instanceof Error ? error.message : String(error),
    },
    process.argv.includes("--json"),
  );
  process.exit(1);
});
