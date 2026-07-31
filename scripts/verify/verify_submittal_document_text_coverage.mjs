#!/usr/bin/env node

const APP_SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const APP_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const RAG_SUPABASE_URL = process.env.RAG_SUPABASE_URL;
const RAG_SUPABASE_SERVICE_ROLE_KEY =
  process.env.RAG_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.RAG_SUPABASE_SERVICE_KEY;

function parseArgs(argv) {
  const args = {
    projectId: null,
    submittalId: null,
    failOnMissing: false,
    json: false,
    limit: 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project-id") {
      args.projectId = Number.parseInt(argv[++index] ?? "", 10);
    } else if (arg === "--submittal-id") {
      args.submittalId = argv[++index] ?? null;
    } else if (arg === "--fail-on-missing") {
      args.failOnMissing = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--limit") {
      args.limit = Number.parseInt(argv[++index] ?? "", 10);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.projectId !== null && !Number.isFinite(args.projectId)) {
    throw new Error("--project-id must be a number.");
  }
  if (!Number.isFinite(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive number.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/verify/verify_submittal_document_text_coverage.mjs [options]

Options:
  --project-id <number>      Restrict audit to one project.
  --submittal-id <uuid>      Restrict audit to one submittal.
  --limit <number>           Max submittal_doc_links rows to scan. Default: 1000.
  --fail-on-missing          Exit 1 if any linked document has no app or RAG text.
  --json                     Print machine-readable JSON.
`);
}

function requireEnv() {
  const missing = [];
  if (!APP_SUPABASE_URL) missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!APP_SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");
  }
  if (!RAG_SUPABASE_URL) missing.push("RAG_SUPABASE_URL");
  if (!RAG_SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("RAG_SUPABASE_SERVICE_ROLE_KEY or RAG_SUPABASE_SERVICE_KEY");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function restHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function buildUrl(baseUrl, path, searchParams = {}) {
  const url = new URL(`/rest/v1/${path}`, baseUrl);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function select(baseUrl, key, path, searchParams) {
  const response = await fetch(buildUrl(baseUrl, path, searchParams), {
    headers: {
      ...restHeaders(key),
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function textLength(row) {
  return Math.max(
    String(row?.content ?? "").trim().length,
    String(row?.raw_text ?? "").trim().length,
  );
}

function chunk(values, size = 100) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function inFilter(values) {
  return `in.(${values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(",")})`;
}

async function loadSubmittals(args) {
  if (args.submittalId) {
    const rows = await select(
      APP_SUPABASE_URL,
      APP_SUPABASE_SERVICE_ROLE_KEY,
      "submittals",
      {
        select: "id,project_id,submittal_number,title",
        id: `eq.${args.submittalId}`,
      },
    );
    return rows;
  }

  if (args.projectId !== null) {
    return select(APP_SUPABASE_URL, APP_SUPABASE_SERVICE_ROLE_KEY, "submittals", {
      select: "id,project_id,submittal_number,title",
      project_id: `eq.${args.projectId}`,
      limit: String(args.limit),
    });
  }

  return [];
}

async function loadDocumentLinks(args, submittals) {
  const params = {
    select: "submittal_id,document_metadata_id,document_type,attached_at",
    limit: String(args.limit),
  };

  if (args.submittalId) {
    params.submittal_id = `eq.${args.submittalId}`;
    return select(
      APP_SUPABASE_URL,
      APP_SUPABASE_SERVICE_ROLE_KEY,
      "submittal_doc_links",
      params,
    );
  }

  if (args.projectId !== null) {
    const submittalIds = submittals.map((row) => row.id);
    const rows = [];
    for (const ids of chunk(submittalIds, 100)) {
      if (ids.length === 0) continue;
      rows.push(
        ...(await select(
          APP_SUPABASE_URL,
          APP_SUPABASE_SERVICE_ROLE_KEY,
          "submittal_doc_links",
          {
            ...params,
            submittal_id: inFilter(ids),
          },
        )),
      );
    }
    return rows;
  }

  return select(
    APP_SUPABASE_URL,
    APP_SUPABASE_SERVICE_ROLE_KEY,
    "submittal_doc_links",
    params,
  );
}

async function loadRowsByIds({ baseUrl, key, table, selectColumns, ids }) {
  const rows = [];
  for (const idChunk of chunk(ids, 100)) {
    if (idChunk.length === 0) continue;
    rows.push(
      ...(await select(baseUrl, key, table, {
        select: selectColumns,
        id: inFilter(idChunk),
      })),
    );
  }
  return rows;
}

function summarize({ submittals, links, appDocs, ragDocs }) {
  const submittalById = new Map(submittals.map((row) => [row.id, row]));
  const appById = new Map(appDocs.map((row) => [row.id, row]));
  const ragById = new Map(ragDocs.map((row) => [row.id, row]));

  const documents = links.map((link) => {
    const appDoc = appById.get(link.document_metadata_id) ?? null;
    const ragDoc = ragById.get(link.document_metadata_id) ?? null;
    const appTextLength = textLength(appDoc);
    const ragTextLength = textLength(ragDoc);
    const searchableTextLength = Math.max(appTextLength, ragTextLength);
    const submittal = submittalById.get(link.submittal_id) ?? null;

    return {
      submittalId: link.submittal_id,
      projectId: submittal?.project_id ?? appDoc?.project_id ?? null,
      submittalNumber: submittal?.submittal_number ?? null,
      submittalTitle: submittal?.title ?? null,
      documentMetadataId: link.document_metadata_id,
      documentType: link.document_type ?? appDoc?.document_type ?? null,
      title: appDoc?.title ?? appDoc?.file_name ?? ragDoc?.title ?? null,
      appStatus: appDoc?.status ?? null,
      ragParsingStatus: ragDoc?.parsing_status ?? null,
      ragEmbeddingStatus: ragDoc?.embedding_status ?? null,
      storageBucket: appDoc?.storage_bucket ?? null,
      filePath: appDoc?.file_path ?? null,
      appTextLength,
      ragTextLength,
      searchableTextLength,
      hasSearchableText: searchableTextLength > 0,
      missingMetadata: !appDoc,
    };
  });

  const missingText = documents.filter((doc) => !doc.hasSearchableText);
  const missingMetadata = documents.filter((doc) => doc.missingMetadata);

  return {
    ok: missingText.length === 0 && missingMetadata.length === 0,
    summary: {
      submittalCount: submittals.length,
      linkedDocumentCount: documents.length,
      searchableDocumentCount: documents.filter((doc) => doc.hasSearchableText).length,
      appTextDocumentCount: documents.filter((doc) => doc.appTextLength > 0).length,
      ragTextDocumentCount: documents.filter((doc) => doc.ragTextLength > 0).length,
      missingTextCount: missingText.length,
      missingMetadataCount: missingMetadata.length,
    },
    missingText,
    missingMetadata,
    documents,
  };
}

function printHumanReport(report) {
  console.log("Submittal document text coverage");
  console.log(JSON.stringify(report.summary, null, 2));

  if (report.missingText.length > 0) {
    console.log("\nDocuments missing searchable text:");
    for (const doc of report.missingText.slice(0, 25)) {
      console.log(
        `- ${doc.documentMetadataId} | submittal=${doc.submittalNumber ?? doc.submittalId} | status=${doc.appStatus ?? "unknown"} | file=${doc.filePath ?? "n/a"}`,
      );
    }
  }

  if (report.missingMetadata.length > 0) {
    console.log("\nLinks missing document_metadata rows:");
    for (const doc of report.missingMetadata.slice(0, 25)) {
      console.log(`- ${doc.documentMetadataId} | submittal=${doc.submittalId}`);
    }
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  requireEnv();

  const submittals = await loadSubmittals(args);
  const links = await loadDocumentLinks(args, submittals);
  const docIds = [...new Set(links.map((row) => row.document_metadata_id).filter(Boolean))];

  const [appDocs, ragDocs] = await Promise.all([
    loadRowsByIds({
      baseUrl: APP_SUPABASE_URL,
      key: APP_SUPABASE_SERVICE_ROLE_KEY,
      table: "document_metadata",
      selectColumns:
        "id,project_id,title,file_name,status,document_type,storage_bucket,file_path,content,raw_text",
      ids: docIds,
    }),
    loadRowsByIds({
      baseUrl: RAG_SUPABASE_URL,
      key: RAG_SUPABASE_SERVICE_ROLE_KEY,
      table: "rag_document_metadata",
      selectColumns:
        "id,title,parsing_status,embedding_status,content,raw_text,content_length",
      ids: docIds,
    }),
  ]);

  const report = summarize({ submittals, links, appDocs, ragDocs });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  if (args.failOnMissing && !report.ok) {
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
