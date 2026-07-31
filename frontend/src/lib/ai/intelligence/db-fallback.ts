/**
 * Raw-pg connection helper for direct database fallback when the Supabase
 * PostgREST layer is unavailable. Used by packet-service for loading
 * packets, cards, and timeline data.
 */

const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

export async function withAppDbClient<T>(
  callback: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const databaseUrl =
    process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error("App database URL is not configured for Project Intelligence fallback.");
  }

  const pg = await import("pg");
  const url = new URL(databaseUrl);
  url.searchParams.delete("sslmode");

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 1_000,
    });

    try {
      const client = await pool.connect();
      try {
        await client.query("set statement_timeout = '15000ms'");
        return await callback(client);
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        console.warn(
          "[db-fallback] Attempt 1 failed, retrying in 750ms:",
          error instanceof Error ? error.message : error,
        );
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    } finally {
      await pool.end();
    }
  }

  throw lastError;
}

export function normalizeDbRow<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as T;
}

export function normalizeDbRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => normalizeDbRow(row));
}

export function chunkArray<T>(items: T[], size = SUPABASE_IN_FILTER_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
