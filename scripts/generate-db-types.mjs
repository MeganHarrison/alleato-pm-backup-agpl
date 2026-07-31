#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.join(import.meta.dirname, "..");
const TYPES_PATH = path.join(REPO_ROOT, "frontend", "src", "types", "database.types.ts");
const PROJECT_ID = "lgveqfnpkxvzbnnwuled";
const SCHEMA = "public";
const POSTGRES_META_VERSION = "0.96.6";
const USE_PACKAGE_SHELL = process.platform === "win32";

function loadEnvFile(relativePath) {
  const filePath = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (process.env[key] !== undefined) continue;
    let value = rest.join("=").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function ensureEnvLoaded() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
  loadEnvFile("frontend/.env");
  loadEnvFile("frontend/.env.local");
}

function generateViaSupabaseCli() {
  const env = { ...process.env };
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    env.SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
  }
  return execFileSync(
    "npx",
    ["supabase", "gen", "types", "typescript", "--project-id", PROJECT_ID, "--schema", SCHEMA],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
      env,
      shell: USE_PACKAGE_SHELL,
    },
  );
}

function generateViaPostgresMeta() {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    throw new Error("DATABASE_URL or SUPABASE_DB_URL is required for postgres-meta fallback.");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "alleato-postgres-meta-"));
  try {
    execFileSync("npm", ["init", "-y"], {
      cwd: tempDir,
      stdio: "ignore",
      shell: USE_PACKAGE_SHELL,
    });
    execFileSync("npm", ["install", `@supabase/postgres-meta@${POSTGRES_META_VERSION}`], {
      cwd: tempDir,
      stdio: "ignore",
      shell: USE_PACKAGE_SHELL,
    });
    return execFileSync("node", ["node_modules/@supabase/postgres-meta/dist/server/server.js"], {
      cwd: tempDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        PG_META_DB_URL: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
        PG_META_GENERATE_TYPES: "typescript",
        PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS: SCHEMA,
      },
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function generateTypes() {
  try {
    const generated = generateViaSupabaseCli();
    return { generated: generated.replace(/\n+$/u, "\n"), strategy: "supabase-cli" };
  } catch (error) {
    const stdout = String(error?.stdout ?? "");
    const stderr = String(error?.stderr ?? "");
    const summary = `${stdout}\n${stderr}`.trim();
    if (!/Unauthorized|LegacyGenTypesUnexpectedStatusError|failed to connect to the docker API/i.test(summary)) {
      throw error;
    }
    const generated = generateViaPostgresMeta();
    return { generated: generated.replace(/\n+$/u, "\n"), strategy: "postgres-meta-fallback" };
  }
}

function syncFkMap() {
  execFileSync("npm", ["run", "devtools:sync-schema-fk"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: USE_PACKAGE_SHELL,
  });
}

function main() {
  ensureEnvLoaded();

  const mode = process.argv.includes("--check") ? "check" : "write";
  const { generated, strategy } = generateTypes();

  if (mode === "check") {
    const current = fs.readFileSync(TYPES_PATH, "utf8");
    if (current === generated) {
      console.log(`database.types.ts matches the current schema via ${strategy}.`);
      return;
    }
    console.error("");
    console.error("ERROR: frontend/src/types/database.types.ts is stale.");
    console.error(`Generated schema source: ${strategy}.`);
    console.error("Run `npm run db:types` from repo root and commit the updated file before merging.");
    console.error("");
    process.exit(1);
  }

  fs.writeFileSync(TYPES_PATH, generated);
  console.log(`Wrote frontend/src/types/database.types.ts via ${strategy}.`);
  syncFkMap();
}

main();
