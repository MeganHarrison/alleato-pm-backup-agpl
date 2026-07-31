#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const repoRoot = process.cwd();

function hydrateEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = rawValue;
  }
}

hydrateEnv(path.join(repoRoot, ".env"));
hydrateEnv(path.join(repoRoot, "frontend", ".env.local"));
hydrateEnv(path.join(repoRoot, "backend", ".env"));

const ragDatabaseUrl = process.env.RAG_DATABASE_URL;
const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

const failures = [];

function fail(message, detail = undefined) {
  failures.push({ message, detail });
}

function pgConnectionStringWithoutSslMode(value) {
  const url = new URL(value);
  url.searchParams.delete("sslmode");
  return url.toString();
}

function keywordQuery(text) {
  return String(text)
    .replace(/[^a-zA-Z0-9\s.-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 24)
    .join(" ");
}

async function embedQuery(query) {
  const gatewayEnabled = Boolean(aiGatewayKey);
  const response = await fetch(
    gatewayEnabled
      ? "https://ai-gateway.vercel.sh/v1/embeddings"
      : "https://api.openai.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayEnabled ? aiGatewayKey : openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: gatewayEnabled ? "openai/text-embedding-3-large" : "text-embedding-3-large",
        dimensions: 3072,
        input: query.slice(0, 8000),
      }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`embedding request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  return `[${json.data[0].embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

async function searchDocumentChunks(client, embedding, projectId, sourceTypes, queryText) {
  const result = await client.query(
    `
      select *
      from public.search_document_chunks(
        $1::extensions.halfvec,
        $2::text[],
        $3::bigint,
        8,
        0.10,
        'hybrid',
        $4::text,
        false,
        'retrieval-contract-verify',
        'verify_rag_retrieval_contract'
      )
    `,
    [embedding, sourceTypes, projectId, queryText],
  );
  return result.rows;
}

function rowProjectId(row) {
  const value = row.doc_project_id ?? row.doc_metadata?.project_id ?? null;
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasReference(row) {
  return Boolean(
    row.source_web_url ||
      row.url ||
      row.storage_path ||
      row.storage_bucket ||
      row.file_name,
  );
}

function assertStaticPermissionGuards() {
  const guardrails = fs.readFileSync(
    path.join(repoRoot, "frontend/src/lib/ai/tools/guardrails.ts"),
    "utf8",
  );
  const operational = fs.readFileSync(
    path.join(repoRoot, "frontend/src/lib/ai/tools/operational.ts"),
    "utf8",
  );
  const sourceSpecific = fs.readFileSync(
    path.join(repoRoot, "frontend/src/lib/ai/retrieval/source-specific-rag.ts"),
    "utf8",
  );

  const requiredFragments = [
    {
      file: "guardrails.ts",
      source: guardrails,
      fragments: [
        "project_directory_memberships",
        "allowedProjectIds",
        "enforceProjectAccess",
        "scope.isAdmin || scope.allowedProjectIds.includes(projectId)",
      ],
    },
    {
      file: "operational.ts",
      source: operational,
      fragments: [
        "filter_project_id: resolvedProjectId ?? undefined",
        "service role client (bypasses RLS)",
        "allowedProjectIdSet.has(docProjectId)",
        "You are not assigned to any projects in the current database scope",
      ],
    },
    {
      file: "source-specific-rag.ts",
      source: sourceSpecific,
      fragments: [
        "import type { ToolScope }",
        "scope: ToolScope",
        "scope.allowedProjectIds.length === 0",
        "applyProjectScope",
        "query.in(\"project_id\", scope.allowedProjectIds)",
      ],
    },
  ];

  for (const check of requiredFragments) {
    for (const fragment of check.fragments) {
      if (!check.source.includes(fragment)) {
        fail(`permission guard fragment missing in ${check.file}`, fragment);
      }
    }
  }
}

async function verifyLiveRetrieval() {
  if (!ragDatabaseUrl) {
    fail("RAG_DATABASE_URL is required for live retrieval contract verification");
    return null;
  }
  if (!aiGatewayKey && !openaiKey) {
    fail("AI_GATEWAY_API_KEY or OPENAI_API_KEY is required to embed the live verifier query");
    return null;
  }

  const client = new Client({
    connectionString: pgConnectionStringWithoutSslMode(ragDatabaseUrl),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const sample = await client.query(`
      select
        dc.chunk_id,
        dc.document_id,
        dc.text,
        dc.metadata,
        rdm.project_id,
        rdm.title,
        rdm.source,
        rdm.source_system,
        rdm.category,
        rdm.source_web_url,
        rdm.url,
        rdm.storage_bucket,
        rdm.storage_path,
        rdm.file_name
      from public.document_chunks dc
      join public.rag_document_metadata rdm on rdm.id = dc.document_id
      where dc.embedding is not null
        and length(coalesce(dc.text, '')) > 180
        and rdm.project_id is not null
        and (
          rdm.source_web_url is not null
          or rdm.url is not null
          or rdm.storage_path is not null
          or rdm.storage_bucket is not null
          or rdm.file_name is not null
        )
      order by dc.created_at desc nulls last
      limit 1
    `);

    if (sample.rowCount === 0) {
      fail("no embedded project-scoped chunk with citation/reference metadata was available");
      return null;
    }

    const sampleRow = sample.rows[0];
    const projectId = Number(sampleRow.project_id);
    const queryText = keywordQuery(sampleRow.text);
    if (!queryText) {
      fail("sample chunk did not produce a usable verifier query", sampleRow.chunk_id);
      return null;
    }

    const embedding = await embedQuery(queryText);
    const projectRows = await searchDocumentChunks(client, embedding, projectId, null, queryText);
    if (projectRows.length === 0) {
      fail("project-filtered search_document_chunks returned no rows", { projectId, queryText });
      return null;
    }

    const wrongProjectRows = projectRows.filter((row) => rowProjectId(row) !== projectId);
    if (wrongProjectRows.length > 0) {
      fail("project-filtered retrieval returned rows outside the requested project", {
        projectId,
        rows: wrongProjectRows.map((row) => ({
          chunk_id: row.chunk_id,
          doc_project_id: row.doc_project_id,
          document_id: row.document_id,
        })),
      });
    }

    const duplicateChunkIds = projectRows
      .map((row) => row.chunk_id)
      .filter((chunkId, index, values) => values.indexOf(chunkId) !== index);
    if (duplicateChunkIds.length > 0) {
      fail("retrieval returned duplicate chunk ids in top results", duplicateChunkIds);
    }

    const topSourceType = projectRows.find((row) => row.source_type)?.source_type ?? null;
    let sourceFilteredCount = 0;
    if (topSourceType) {
      const sourceRows = await searchDocumentChunks(
        client,
        embedding,
        projectId,
        [topSourceType],
        queryText,
      );
      sourceFilteredCount = sourceRows.length;
      const wrongSourceRows = sourceRows.filter((row) => row.source_type !== topSourceType);
      if (sourceRows.length === 0) {
        fail("source-type filtered search_document_chunks returned no rows", {
          projectId,
          topSourceType,
        });
      }
      if (wrongSourceRows.length > 0) {
        fail("source-type filtered retrieval returned rows outside the requested source type", {
          topSourceType,
          rows: wrongSourceRows.map((row) => ({
            chunk_id: row.chunk_id,
            source_type: row.source_type,
          })),
        });
      }
    }

    const documentIds = [...new Set(projectRows.map((row) => row.document_id).filter(Boolean))];
    const metadata = await client.query(
      `
        select
          id,
          title,
          source_web_url,
          url,
          storage_bucket,
          storage_path,
          file_name,
          project_id
        from public.rag_document_metadata
        where id = any($1::text[])
      `,
      [documentIds],
    );

    const metadataById = new Map(metadata.rows.map((row) => [row.id, row]));
    const missingReferenceRows = projectRows.filter((row) => {
      const meta = metadataById.get(row.document_id);
      return !meta || !meta.title || !hasReference(meta);
    });
    if (missingReferenceRows.length > 0) {
      fail("retrieved rows are missing citation/reference metadata", {
        rows: missingReferenceRows.map((row) => ({
          chunk_id: row.chunk_id,
          document_id: row.document_id,
          doc_title: row.doc_title,
        })),
      });
    }

    return {
      projectId,
      queryText,
      resultCount: projectRows.length,
      sourceFilteredCount,
      topChunkId: projectRows[0]?.chunk_id ?? null,
      topDocumentId: projectRows[0]?.document_id ?? null,
      topSourceType,
      metadataReferenceCount: metadata.rows.filter(hasReference).length,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

try {
  assertStaticPermissionGuards();
  const live = await verifyLiveRetrieval();

  if (failures.length > 0) {
    console.error("RAG retrieval contract verification failed:");
    for (const failure of failures) {
      console.error(`- ${failure.message}`);
      if (failure.detail !== undefined) {
        console.error(JSON.stringify(failure.detail, null, 2));
      }
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "pass",
        live,
        permissionModel:
          "service-role retrieval is constrained by ToolScope allowedProjectIds plus RPC project filters and post-filter guards",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
