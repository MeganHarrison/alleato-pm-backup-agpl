#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function hydrateEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function hydrateStandardEnv() {
  for (const filePath of [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "frontend", ".env.local"),
  ]) {
    hydrateEnvFile(filePath);
  }
}

function resolveProjectRef() {
  for (const value of [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ]) {
    if (!value) continue;
    const match = new URL(value).hostname.match(/^([^.]+)\.supabase\.co$/);
    if (match?.[1]) return match[1];
  }

  throw new Error(
    "Project bootstrap role-trigger verification requires a Supabase project URL.",
  );
}

async function queryDatabase(query) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "Project bootstrap role-trigger verification requires SUPABASE_ACCESS_TOKEN.",
    );
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${resolveProjectRef()}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: true }),
    },
  );
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase project bootstrap role-trigger query failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  return text ? JSON.parse(text) : [];
}

hydrateStandardEnv();

const rows = await queryDatabase(`
  select
    p.prosecdef as security_definer,
    coalesce(
      'search_path=pg_catalog, pg_temp' = any(p.proconfig),
      false
    ) as hardened_search_path,
    has_function_privilege(
      'anon',
      'public.create_default_project_roles()',
      'execute'
    ) as anon_can_execute,
    has_function_privilege(
      'authenticated',
      'public.create_default_project_roles()',
      'execute'
    ) as authenticated_can_execute,
    has_function_privilege(
      'service_role',
      'public.create_default_project_roles()',
      'execute'
    ) as service_role_can_execute,
    exists (
      select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'projects'
        and t.tgname = 'trigger_create_default_project_roles'
        and t.tgfoid = p.oid
        and not t.tgisinternal
    ) as trigger_is_attached
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_default_project_roles'
    and p.pronargs = 0
`);

if (rows.length !== 1) {
  throw new Error(
    `Expected one public.create_default_project_roles() function; found ${rows.length}.`,
  );
}

const state = rows[0];
const failures = [
  ["security_definer", state.security_definer === true],
  ["hardened_search_path", state.hardened_search_path === true],
  ["anon_execute_revoked", state.anon_can_execute === false],
  ["authenticated_execute_revoked", state.authenticated_can_execute === false],
  ["service_role_execute_granted", state.service_role_can_execute === true],
  ["projects_trigger_attached", state.trigger_is_attached === true],
].filter(([, passed]) => !passed);

if (failures.length > 0) {
  throw new Error(
    [
      "Project bootstrap role-trigger verification failed.",
      ...failures.map(([name]) => `- ${name}`),
      "Project creation can fail when its default-role trigger reaches project_roles RLS.",
    ].join("\n"),
  );
}

console.log(
  "PASS project bootstrap default-role trigger is attached, security-definer hardened, and not directly executable by app roles.",
);
