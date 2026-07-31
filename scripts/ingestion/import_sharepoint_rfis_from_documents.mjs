#!/usr/bin/env node
/**
 * Promote imported SharePoint RFI PDFs from project_documents into rfis records.
 *
 * The importer is idempotent by project_id + RFI number. It creates/updates the
 * workflow RFI and links the original question/response PDFs for traceability.
 */

import { createClient } from "../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { config } from "../../frontend/node_modules/dotenv/lib/main.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../.env") });

function argValue(name, fallback = null) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const PROJECT_ID = Number(argValue("--project-id", "761"));
const DRY_RUN = process.argv.includes("--dry-run");
const AUTHOR_ID = argValue("--author-id", "1854b4b0-3e8e-4d69-86df-32cdb3c80ee0");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAG_SUPABASE_URL = process.env.RAG_SUPABASE_URL;
const RAG_SUPABASE_SERVICE_KEY = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY || process.env.RAG_SUPABASE_SERVICE_KEY;
const RAG_READS_ENABLED = String(process.env.RAG_DATABASE_READS_ENABLED ?? "").toLowerCase() === "true";

if (!Number.isFinite(PROJECT_ID) || PROJECT_ID <= 0) {
  console.error("Missing or invalid --project-id.");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (RAG_READS_ENABLED && (!RAG_SUPABASE_URL || !RAG_SUPABASE_SERVICE_KEY)) {
  console.error("RAG_DATABASE_READS_ENABLED=true but RAG_SUPABASE_URL / RAG_SUPABASE_SERVICE_ROLE_KEY are missing.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ragSupabase = RAG_READS_ENABLED
  ? createClient(RAG_SUPABASE_URL, RAG_SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : supabase;

function parseRfiTitle(title) {
  const match = title.match(/\bRFI[-\s]*(\d+)\b/i);
  if (!match) return null;

  const number = Number(match[1]);
  const isResponse = /\bresponse\b/i.test(title);
  const withoutPrefix = title
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\bRFI[-\s]*\d+\b/i, "")
    .replace(/\(?\s*response\s*\)?/gi, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    number,
    isResponse,
    subject: withoutPrefix || `Imported RFI ${String(number).padStart(2, "0")}`,
  };
}

function compactText(value, maxLength = 1800) {
  if (!value) return "";
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function firstDate(text) {
  const match = text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/i);
  if (!match) return null;
  const date = new Date(match[0]);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function statusFromText(text) {
  if (/\bclosed\b/i.test(text)) return "closed";
  if (/\bdraft\b/i.test(text)) return "draft";
  return "open";
}

async function requireData(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

async function fetchChunks(documentMetadataIds) {
  if (documentMetadataIds.length === 0) return new Map();

  const rows = await requireData(
    "document_chunks select",
    ragSupabase
      .from("document_chunks")
      .select("document_id, chunk_index, text")
      .in("document_id", documentMetadataIds)
      .order("chunk_index", { ascending: true }),
  );

  const byDocumentId = new Map();
  for (const row of rows) {
    const existing = byDocumentId.get(row.document_id) ?? [];
    existing.push(row.text ?? "");
    byDocumentId.set(row.document_id, existing);
  }

  return new Map(
    Array.from(byDocumentId.entries()).map(([documentId, chunks]) => [
      documentId,
      chunks.join("\n").trim(),
    ]),
  );
}

async function fetchImportedDocuments() {
  const documents = await requireData(
    "project_documents select",
    supabase
      .from("project_documents")
      .select("id, title, file_name, source_path, source_web_url, storage_bucket, storage_path")
      .eq("project_id", PROJECT_ID)
      .eq("workflow_target", "rfi")
      .is("deleted_at", null)
      .order("title", { ascending: true }),
  );

  const metadata = await requireData(
    "document_metadata select",
    supabase
      .from("document_metadata")
      .select("id, title, file_path, source_path")
      .eq("project_id", PROJECT_ID)
      .eq("workflow_target", "rfi")
      .order("title", { ascending: true }),
  );

  const metadataByTitle = new Map(metadata.map((row) => [row.title, row]));
  const chunkTextByMetadataId = await fetchChunks(metadata.map((row) => row.id));

  return documents.map((document) => {
    const metadataRow = metadataByTitle.get(document.title) ?? null;
    const parsed = parseRfiTitle(document.title);
    return {
      ...document,
      parsed,
      metadata: metadataRow,
      extractedText: metadataRow ? chunkTextByMetadataId.get(metadataRow.id) ?? "" : "",
    };
  });
}

function groupDocuments(documents) {
  const groups = new Map();

  for (const document of documents) {
    if (!document.parsed) continue;
    const group = groups.get(document.parsed.number) ?? {
      number: document.parsed.number,
      subject: document.parsed.subject,
      questionDocument: null,
      responseDocument: null,
    };

    if (document.parsed.isResponse) {
      group.responseDocument = document;
    } else {
      group.questionDocument = document;
      group.subject = document.parsed.subject;
    }

    groups.set(document.parsed.number, group);
  }

  return Array.from(groups.values()).sort((a, b) => a.number - b.number);
}

function buildRfiPayload(group) {
  const questionDocument = group.questionDocument;
  const responseDocument = group.responseDocument;
  const questionText = compactText(questionDocument?.extractedText);
  const responseText = compactText(responseDocument?.extractedText);
  const joinedText = `${questionText}\n${responseText}`;
  const dueDate = firstDate(joinedText);

  return {
    project_id: PROJECT_ID,
    number: group.number,
    subject: group.subject,
    question: questionText || `Imported from ${questionDocument?.file_name ?? "SharePoint RFI PDF"}.`,
    status: responseDocument ? "closed" : statusFromText(questionText),
    due_date: dueDate,
    date_initiated: dueDate,
    closed_date: responseDocument ? new Date().toISOString().slice(0, 10) : null,
    rfi_manager: "Imported from SharePoint",
    received_from: "SharePoint RFI folder",
    responsible_contractor: "Alleato Group",
    assignees: [],
    distribution_list: [],
    ball_in_court: responseDocument ? null : "Imported from SharePoint",
    reference: questionDocument?.source_path ?? questionDocument?.file_name ?? null,
    source_system: "sharepoint",
    source_project_document_id: questionDocument?.id ?? null,
    response_project_document_id: responseDocument?.id ?? null,
    source_document_metadata_id: questionDocument?.metadata?.id ?? null,
    response_document_metadata_id: responseDocument?.metadata?.id ?? null,
    source_metadata: {
      import_source: "sharepoint_rfi_folder",
      imported_at: new Date().toISOString(),
      question_document: questionDocument
        ? {
            project_document_id: questionDocument.id,
            document_metadata_id: questionDocument.metadata?.id ?? null,
            file_name: questionDocument.file_name,
            source_path: questionDocument.source_path,
            storage_path: questionDocument.storage_path,
          }
        : null,
      response_document: responseDocument
        ? {
            project_document_id: responseDocument.id,
            document_metadata_id: responseDocument.metadata?.id ?? null,
            file_name: responseDocument.file_name,
            source_path: responseDocument.source_path,
            storage_path: responseDocument.storage_path,
            response_summary: responseText,
          }
        : null,
    },
  };
}

async function upsertRfi(payload) {
  const { data: existing, error: existingError } = await supabase
    .from("rfis")
    .select("id")
    .eq("project_id", PROJECT_ID)
    .eq("number", payload.number)
    .maybeSingle();

  if (existingError) {
    throw new Error(`rfis existing lookup #${payload.number}: ${existingError.message}`);
  }

  if (DRY_RUN) {
    return { action: existing ? "would_update" : "would_insert", id: existing?.id ?? null };
  }

  if (existing) {
    const { data, error } = await supabase
      .from("rfis")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) throw new Error(`rfis update #${payload.number}: ${error.message}`);
    return { action: "updated", id: data.id };
  }

  const { data, error } = await supabase
    .from("rfis")
    .insert({
      ...payload,
      created_by: "SharePoint import",
    })
    .select("id")
    .single();

  if (error) throw new Error(`rfis insert #${payload.number}: ${error.message}`);
  return { action: "inserted", id: data.id };
}

async function upsertResponseComment(rfiId, group, payload) {
  const responseSummary = payload.source_metadata?.response_document?.response_summary;
  if (!responseSummary) return "skipped_no_response";

  const marker = `sharepoint-rfi-response:${PROJECT_ID}:${group.number}`;
  const { data: existing, error: existingError } = await supabase
    .from("collaboration_comments")
    .select("id")
    .eq("entity_type", "rfi")
    .eq("entity_id", rfiId)
    .eq("project_id", PROJECT_ID)
    .ilike("body", `%${marker}%`)
    .maybeSingle();

  if (existingError) {
    throw new Error(`comment lookup #${group.number}: ${existingError.message}`);
  }

  const body = [
    `Imported response document: ${group.responseDocument.file_name}`,
    "",
    responseSummary,
    "",
    `[${marker}]`,
  ].join("\n");

  if (DRY_RUN) return existing ? "would_update" : "would_insert";

  if (existing) {
    const { error } = await supabase
      .from("collaboration_comments")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(`comment update #${group.number}: ${error.message}`);
    return "updated";
  }

  const { error } = await supabase.from("collaboration_comments").insert({
    entity_type: "rfi",
    entity_id: rfiId,
    project_id: PROJECT_ID,
    body,
    author_id: AUTHOR_ID,
  });

  if (error) throw new Error(`comment insert #${group.number}: ${error.message}`);
  return "inserted";
}

async function main() {
  const documents = await fetchImportedDocuments();
  const groups = groupDocuments(documents);

  if (groups.length === 0) {
    throw new Error(`No imported RFI documents found for project ${PROJECT_ID}.`);
  }

  const results = [];
  for (const group of groups) {
    const payload = buildRfiPayload(group);
    const rfiResult = await upsertRfi(payload);
    const commentResult = rfiResult.id
      ? await upsertResponseComment(rfiResult.id, group, payload)
      : "skipped_dry_run_no_id";
    results.push({
      number: group.number,
      subject: payload.subject,
      action: rfiResult.action,
      rfi_id: rfiResult.id,
      comment: commentResult,
      question_document_id: payload.source_project_document_id,
      response_document_id: payload.response_project_document_id,
    });
  }

  console.log(JSON.stringify({ dry_run: DRY_RUN, project_id: PROJECT_ID, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
