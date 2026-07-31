import { lookup } from "node:dns/promises";

const SUPABASE_POOLER_HOST = "aws-1-us-east-2.pooler.supabase.com";
const SUPABASE_POOLER_HOST_BY_PROJECT_REF = {
  // AI/RAG database project. Its direct host is IPv6-only from this network,
  // so local verification must use the regional Supavisor pooler.
  fqcvmfqldlewvbsuxdvz: "aws-1-us-east-1.pooler.supabase.com",
};

export function getAppDatabaseUrl(env = process.env) {
  // The original application DB owns app workflow/state tables, including
  // ai_memories, memories, intelligence packets, and source intelligence jobs.
  // Do not fall through to RAG_DATABASE_URL here; the split RAG DB owns heavy
  // retrieval/chunk tables only.
  return env.APP_DATABASE_URL || env.DATABASE_URL || env.SUPABASE_DB_URL || env.APP_METADATA_DATABASE_URL;
}

export function getRagDatabaseUrl(env = process.env) {
  return env.RAG_DATABASE_URL;
}

export async function buildAppDatabaseConnectionString(rawDatabaseUrl, options = {}) {
  const warnings = options.warnings ?? [];
  const includeSslMode = options.includeSslMode ?? true;
  const rewriteSupabaseDirectHost = options.rewriteSupabaseDirectHost ?? true;
  const url = new URL(rawDatabaseUrl);
  if (includeSslMode) {
    url.searchParams.set("sslmode", "require");
  } else {
    url.searchParams.delete("sslmode");
  }

  const directHostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (rewriteSupabaseDirectHost && directHostMatch) {
    const [, projectRef] = directHostMatch;
    url.hostname = SUPABASE_POOLER_HOST_BY_PROJECT_REF[projectRef] ?? SUPABASE_POOLER_HOST;
    url.port = url.port || "5432";
    if (url.username === "postgres") {
      url.username = `postgres.${projectRef}`;
    }
  }

  if (!url.hostname.endsWith(".pooler.supabase.com") && !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    try {
      const { address, family } = await lookup(url.hostname, { family: 4 });
      if (family === 4) url.hostname = address;
    } catch (error) {
      warnings.push(`IPv4 hostname lookup failed for ${url.hostname}: ${error.message}`);
    }
  }

  return url.toString();
}
