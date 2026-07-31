#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(command, args) {
  const executable = process.platform === "win32" && command === "npx"
    ? process.env.ComSpec || "cmd.exe"
    : command;
  const executableArgs = process.platform === "win32" && command === "npx"
    ? ["/d", "/s", "/c", "npx", ...args]
    : args;
  return execFileSync(executable, executableArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function versionFromInput(value) {
  const base = path.basename(value);
  const match = base.match(/^(\d{14})(?:_|$)/);
  return match?.[1] || null;
}

function localMigrationFiles() {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
}

function assertNoDuplicateLocalMigrationVersions(files) {
  const byVersion = new Map();
  for (const file of files) {
    const version = versionFromInput(file);
    if (!version) continue;
    if (!byVersion.has(version)) byVersion.set(version, []);
    byVersion.get(version).push(file);
  }

  const duplicates = [...byVersion.entries()].filter(([, names]) => names.length > 1);
  if (duplicates.length === 0) return;

  console.error("Supabase migration ledger check failed.");
  console.error("Duplicate local migration versions found:");
  for (const [version, names] of duplicates) {
    console.error(`- ${version}: ${names.join(", ")}`);
  }
  console.error("");
  console.error("Each migration file must have a unique timestamp prefix.");
  process.exit(1);
}

function hydrateEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function hydrateEnvFromStandardFiles() {
  for (const filePath of [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "frontend", ".env.local"),
    path.join(process.cwd(), "backend", ".env"),
  ]) {
    hydrateEnvFromFile(filePath);
  }
}

function changedMigrationVersions() {
  const status = run("git", ["status", "--porcelain", "--", "supabase/migrations"]);
  return status
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^..\s+/, ""))
    .map(versionFromInput)
    .filter(Boolean);
}

function hydrateSupabaseDbPasswordFromDatabaseUrl() {
  if (process.env.SUPABASE_DB_PASSWORD || !process.env.DATABASE_URL) return;

  try {
    const url = new URL(process.env.DATABASE_URL);
    if (url.password) {
      process.env.SUPABASE_DB_PASSWORD = decodeURIComponent(url.password);
    }
  } catch {
    // The Supabase CLI will print its normal credential guidance below.
  }
}

function projectRefFromEnv() {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const host = url.hostname;
      const match = host.match(/^([^.]+)\.supabase\.co$/);
      if (match?.[1]) return match[1];
    } catch {
      // Ignore malformed URLs and let the caller fall back to CLI output.
    }
  }

  return null;
}

async function loadRemoteVersionsViaManagementApi() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = projectRefFromEnv();

  if (!accessToken || !projectRef) {
    throw new Error("Management API fallback is unavailable: missing SUPABASE_ACCESS_TOKEN or project ref.");
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "select version from supabase_migrations.schema_migrations order by version",
        read_only: true,
      }),
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Management API remote ledger query failed (${response.status}): ${text}`);
  }

  const rows = text ? JSON.parse(text) : [];
  return new Set(
    rows
      .map((row) => row.version)
      .filter((value) => typeof value === "string" && value.length > 0)
  );
}

function loadRemoteVersionsViaDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Database URL fallback is unavailable: missing DATABASE_URL.");
  }

  const output = run("psql", [
    process.env.DATABASE_URL,
    "-At",
    "-c",
    "select version from supabase_migrations.schema_migrations order by version",
  ]);

  return new Set(
    output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value) => /^\d{14}$/.test(value))
  );
}

const args = process.argv.slice(2);
const assertClean = args.includes("--all") || args.includes("--assert-clean");
const localFiles = localMigrationFiles();
assertNoDuplicateLocalMigrationVersions(localFiles);
hydrateEnvFromStandardFiles();
hydrateSupabaseDbPasswordFromDatabaseUrl();

const explicitVersions = args.map(versionFromInput).filter(Boolean);
const localVersions = [...new Set(localFiles.map(versionFromInput).filter(Boolean))];
const versions = [
  ...new Set(
    assertClean
      ? localVersions
      : explicitVersions.length > 0
        ? explicitVersions
        : changedMigrationVersions(),
  ),
];

if (versions.length === 0) {
  console.log("No changed Supabase migration files found.");
  process.exit(0);
}

let remoteVersions = new Set();
let localRows = new Set();

try {
  const listOutput = run("npx", ["supabase", "migration", "list", "--linked"]);
  for (const line of listOutput.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{14})\s+\|\s*(\d{14})?\s+\|/);
    if (match?.[1]) {
      localRows.add(match[1]);
    }
    if (match?.[2]) {
      remoteVersions.add(match[2]);
    }

    if (line.trim().startsWith("{")) {
      try {
        const payload = JSON.parse(line);
        for (const migration of payload.migrations ?? []) {
          if (typeof migration.local === "string" && migration.local) {
            localRows.add(migration.local);
          }
          if (typeof migration.remote === "string" && migration.remote) {
            remoteVersions.add(migration.remote);
          }
        }
      } catch {
        // Keep parsing the stable table format when this line is not JSON output.
      }
    }
  }
} catch (error) {
  try {
    remoteVersions = loadRemoteVersionsViaDatabaseUrl();
    localRows = new Set(localVersions);
    console.warn(
      "Supabase CLI linked migration list failed; used DATABASE_URL fallback for remote migration ledger."
    );
  } catch (fallbackError) {
    try {
      remoteVersions = await loadRemoteVersionsViaManagementApi();
      localRows = new Set(localVersions);
      console.warn(
        "Supabase CLI linked migration list failed; used Management API fallback for remote migration ledger."
      );
    } catch (managementFallbackError) {
      process.stderr.write(error.stderr || error.message);
      process.stderr.write("\n");
      process.stderr.write(fallbackError.message);
      process.stderr.write("\n");
      process.stderr.write(managementFallbackError.message);
      process.stderr.write("\n");
      process.exit(1);
    }
  }
}

if (versions.some((version) => !remoteVersions.has(version))) {
  try {
    const managementApiRemoteVersions = await loadRemoteVersionsViaManagementApi();
    for (const version of managementApiRemoteVersions) {
      remoteVersions.add(version);
    }
  } catch {
    // Fall through to the best available ledger source.
  }
}

if (assertClean) {
  const remoteOnly = [...remoteVersions].filter((version) => !localRows.has(version));
  if (remoteOnly.length > 0) {
    console.error("Supabase migration ledger check failed.");
    console.error("These remote migration versions do not exist locally:");
    for (const version of remoteOnly) {
      console.error(`- ${version}`);
    }
    console.error("");
    console.error("Recover the local migration files or repair intentionally superseded remote ledger entries.");
    process.exit(1);
  }
}

const missing = versions.filter((version) => !remoteVersions.has(version));

if (missing.length > 0) {
  console.error("Supabase migration ledger check failed.");
  console.error("These local migrations are not applied on the linked remote database:");
  for (const version of missing) {
    console.error(`- ${version}`);
  }
  console.error("");
  console.error("Apply the migration or explicitly document why it is intentionally deferred.");
  process.exit(1);
}

if (assertClean) {
  console.log(`Supabase migration ledger check passed: ${versions.length} local migration versions aligned with remote.`);
} else {
  console.log(`Supabase migration ledger check passed: ${versions.join(", ")}`);
}
