import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";
import { lookup } from "node:dns/promises";

import { repoRoot } from "./repo.js";

dotenv.config({ path: path.join(repoRoot(), ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot(), "frontend/.env.local"), override: false, quiet: true });

export function getAppDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL is required for Project Intelligence maintainer DB read-back.",
    );
  }
  return url;
}

export async function withAppClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const connectionString = await buildConnectionString(getAppDatabaseUrl());
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function buildConnectionString(rawDatabaseUrl: string): Promise<string> {
  const url = new URL(rawDatabaseUrl);
  const directHostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);

  url.searchParams.delete("sslmode");

  if (directHostMatch) {
    const [, projectRef] = directHostMatch;
    url.hostname = "aws-1-us-east-2.pooler.supabase.com";
    url.port = url.port || "5432";
    if (url.username === "postgres") url.username = `postgres.${projectRef}`;
  }

  if (!url.hostname.endsWith(".pooler.supabase.com") && !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    try {
      const { address, family } = await lookup(url.hostname, { family: 4 });
      if (family === 4) url.hostname = address;
    } catch {
      // Keep the original host; the subsequent pg connection will fail loudly with the real connection error.
    }
  }

  return url.toString();
}
