#!/usr/bin/env node

/**
 * Backfill SharePoint AP check document project_id from durable accounting data.
 *
 * Rules are intentionally strict:
 * - SharePoint document title must contain a check number and dollar amount.
 * - Auto-assign from commitment_payments only when exact amount match resolves to one project.
 * - Auto-assign from acumatica_ap_bills only when exact amount + normalized vendor text resolves to one project.
 * - Ambiguous or amount-mismatched rows stay in project_assignment_review.
 */

import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "./app-db-connection.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), override: false, quiet: true });

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  args.set(arg.slice(2), next && !next.startsWith("--") ? next : "true");
}

const dryRun = args.get("dry-run") === "true" || args.get("apply") !== "true";
const lookbackDays = numberArg("days", 1);
const limit = numberArg("limit", 500);

function numberArg(name, fallback) {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`--${name} must be numeric.`);
    process.exit(1);
  }
  return value;
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|co|company|corp|corporation|ltd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsNormalizedToken(text, pattern) {
  if (!pattern) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(pattern)}(\\s|$)`, "i").test(text);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCheckTitle(title) {
  const checkMatch = String(title || "").match(/check\s*(?:#\s*)?(\d+)/i);
  const amountMatch = String(title || "").match(/\$\s*([0-9][0-9,\.]*)/);
  if (!checkMatch || !amountMatch) return null;
  const checkNumber = checkMatch[1];
  const vendor = String(title || "")
    .replace(/\.pdf$/i, "")
    .replace(/^check\s*(?:#\s*)?\d+[_\s-]*/i, "")
    .replace(/_?\$.*$/, "")
    .trim();
  return {
    checkNumber,
    paddedCheckNumber: checkNumber.padStart(6, "0"),
    amount: parseMoney(amountMatch[1]),
    vendor,
    normalizedVendor: normalize(vendor),
  };
}

function parseMoney(raw) {
  const compact = String(raw || "").replace(/,/g, "").replace(/\.+$/, "");
  const parts = compact.split(".");
  if (parts.length <= 2) return Number(compact);
  const centsPart = parts.at(-1);
  const dollarPart = parts.slice(0, -1).join("");
  return Number(`${dollarPart}.${centsPart}`);
}

function chooseUniqueProject(candidates) {
  const projectIds = [...new Set(candidates.map((row) => Number(row.project_id)).filter(Boolean))];
  return projectIds.length === 1 ? projectIds[0] : null;
}

function buildProjectReferences(projects) {
  const references = [];
  for (const project of projects) {
    const projectId = Number(project.id);
    const candidates = [
      { value: project.name, type: "project_name" },
      { value: project.project_number, type: "project_number" },
      { value: project.job_number, type: "job_number" },
      { value: project.acumatica_project_id, type: "acumatica_project_id" },
    ];
    for (const candidate of candidates) {
      const normalized = normalize(candidate.value);
      if (normalized.length < 5) continue;
      references.push({
        project_id: projectId,
        project_name: project.name,
        reference_type: candidate.type,
        reference: String(candidate.value),
        normalized,
      });
    }
  }
  return references;
}

function chooseUniqueBodyReferenceProject(document, parsed, textByDocumentId, projectReferences) {
  const body = normalize([
    document.title,
    document.source_path,
    textByDocumentId.get(String(document.id)) ?? "",
  ].join("\n"));

  const matches = projectReferences.filter((reference) => containsNormalizedToken(body, reference.normalized));
  const projectIds = [...new Set(matches.map((match) => Number(match.project_id)))];
  if (projectIds.length !== 1) return null;

  const exactNameMatch = matches.find((match) => match.reference_type === "project_name");
  const exactNumberMatch = matches.find((match) => match.reference_type !== "project_name");
  const match = exactNameMatch ?? exactNumberMatch;
  if (!match) return null;

  return {
    projectId: Number(match.project_id),
    projectName: match.project_name,
    method: `check_body_unique_${match.reference_type}`,
    evidence: [{
      check_number: parsed.paddedCheckNumber,
      amount: parsed.amount,
      reference: match.reference,
      reference_type: match.reference_type,
    }],
  };
}

const appDatabaseUrl = getAppDatabaseUrl();
const ragDatabaseUrl = getRagDatabaseUrl();

if (!appDatabaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.");
  process.exit(1);
}
if (!ragDatabaseUrl) {
  console.error("RAG_DATABASE_URL is required.");
  process.exit(1);
}

const appPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(appDatabaseUrl, { includeSslMode: false }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});
const ragPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(ragDatabaseUrl, {
    includeSslMode: false,
    rewriteSupabaseDirectHost: false,
  }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const appClient = await appPool.connect();
const ragClient = await ragPool.connect();

try {
  const documents = (await appClient.query(
    `
      select id, title, source_path, tags, source_metadata
      from public.document_metadata
      where deleted_at is null
        and source = 'microsoft_graph'
        and category = 'document'
        and project_id is null
        and created_at >= now() - ($1::text || ' days')::interval
        and title ilike '%check%'
      order by created_at desc
      limit $2
    `,
    [lookbackDays, limit],
  )).rows;

  const parsedDocuments = documents
    .map((document) => ({ document, parsed: parseCheckTitle(document.title) }))
    .filter((row) => row.parsed && row.parsed.normalizedVendor.length >= 3);

  const refs = [...new Set(parsedDocuments.flatMap(({ parsed }) => [parsed.checkNumber, parsed.paddedCheckNumber]))];
  const payments = refs.length
    ? (await appClient.query(
        `
          select project_id, payment_number, amount, external_key, vendor_name
          from public.commitment_payments
          where payment_number = any($1::text[])
            and project_id is not null
        `,
        [refs],
      )).rows
    : [];

  const bills = parsedDocuments.length
    ? (await appClient.query(
        `
          select id, project_id, amount, vendor_ref, vendor_id, description, reference_nbr
          from public.acumatica_ap_bills
          where project_id is not null
            and amount = any($1::numeric[])
          limit 5000
        `,
        [[...new Set(parsedDocuments.map(({ parsed }) => parsed.amount))]],
      )).rows
    : [];

  const documentIds = parsedDocuments.map(({ document }) => String(document.id));
  const chunkRows = documentIds.length
    ? (await ragClient.query(
        `
          select document_id,
            left(string_agg(left(coalesce(text, ''), 1200), E'\n' order by chunk_index), 5000) as text_sample
          from public.document_chunks
          where document_id = any($1::text[])
          group by document_id
        `,
        [documentIds],
      )).rows
    : [];
  const textByDocumentId = new Map(chunkRows.map((row) => [String(row.document_id), String(row.text_sample ?? "")]));

  const projects = (await appClient.query(`
    select id, name, project_number, "job number" as job_number, acumatica_project_id
    from public.projects
  `)).rows;
  const projectNameById = new Map(projects.map((project) => [Number(project.id), project.name]));
  const projectReferences = buildProjectReferences(projects);

  const assignments = [];
  const rejected = [];

  for (const { document, parsed } of parsedDocuments) {
    const paymentCandidates = payments.filter(
      (payment) =>
        [parsed.checkNumber, parsed.paddedCheckNumber].includes(String(payment.payment_number)) &&
        cents(payment.amount) === cents(parsed.amount),
    );
    let projectId = chooseUniqueProject(paymentCandidates);
    let method = "commitment_payment_exact_amount";
    let evidence = paymentCandidates;

    if (!projectId) {
      const billCandidates = bills.filter((bill) => {
        if (cents(bill.amount) !== cents(parsed.amount)) return false;
        const haystack = normalize([bill.vendor_ref, bill.vendor_id, bill.description].join(" "));
        return haystack.includes(parsed.normalizedVendor) || parsed.normalizedVendor.includes(haystack);
      });
      projectId = chooseUniqueProject(billCandidates);
      method = "acumatica_ap_bill_exact_amount_vendor";
      evidence = billCandidates;
    }

    if (!projectId) {
      const bodyMatch = chooseUniqueBodyReferenceProject(document, parsed, textByDocumentId, projectReferences);
      if (bodyMatch) {
        projectId = bodyMatch.projectId;
        method = bodyMatch.method;
        evidence = bodyMatch.evidence;
      }
    }

    if (!projectId) {
      rejected.push({
        id: document.id,
        title: document.title,
        checkNumber: parsed.paddedCheckNumber,
        amount: parsed.amount,
      });
      continue;
    }

    assignments.push({
      documentId: String(document.id),
      title: document.title,
      projectId,
      projectName: projectNameById.get(projectId) || null,
      checkNumber: parsed.paddedCheckNumber,
      amount: parsed.amount,
      vendor: parsed.vendor,
      method,
      evidenceCount: evidence.length,
    });
  }

  if (!dryRun && assignments.length > 0) {
    await appClient.query("begin");
    await ragClient.query("begin");
    try {
      for (const assignment of assignments) {
        const metadata = {
          project_assignment_backfill: {
            status: "assigned",
            source: assignment.method,
            check_number: assignment.checkNumber,
            amount: assignment.amount,
            vendor: assignment.vendor,
            evidence_count: assignment.evidenceCount,
            assigned_at: new Date().toISOString(),
          },
        };
        await appClient.query(
          `
            update public.document_metadata
            set project_id = $1,
              project = $2,
              source_metadata = coalesce(source_metadata, '{}'::jsonb) || $3::jsonb
            where id = $4
              and project_id is null
          `,
          [assignment.projectId, assignment.projectName, JSON.stringify(metadata), assignment.documentId],
        );
        await appClient.query(
          `
            update public.tasks
            set project_id = $1,
              project_ids = array[$1]::bigint[],
              updated_at = now()
            where metadata_id = $2
              and project_id is null
          `,
          [assignment.projectId, assignment.documentId],
        );
        await ragClient.query(
          `
            update public.document_chunks
            set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb,
              updated_at = now()
            where document_id = $2
          `,
          [JSON.stringify({ project_id: assignment.projectId, project_name: assignment.projectName, project_attribution_method: assignment.method }), assignment.documentId],
        );
        await ragClient.query(
          `
            update public.source_processing_jobs
            set project_id = $1,
              status = case when status = 'project_assignment_review' then 'project_assigned' else status end,
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
            where source_document_id = $3
              and project_id is null
          `,
          [
            assignment.projectId,
            JSON.stringify({
              project_applicability: "single_project",
              project_required: true,
              project_applicability_reason: "matched_accounting_check_backfill",
              project_assignment_backfill: {
                status: "assigned",
                source: assignment.method,
                check_number: assignment.checkNumber,
                amount: assignment.amount,
              },
            }),
            assignment.documentId,
          ],
        );
      }
      await appClient.query("commit");
      await ragClient.query("commit");
    } catch (error) {
      await appClient.query("rollback");
      await ragClient.query("rollback");
      throw error;
    }
  }

  console.log(JSON.stringify({
    status: "pass",
    dryRun,
    lookbackDays,
    limit,
    documentsScanned: documents.length,
    parsedDocuments: parsedDocuments.length,
    assignments: assignments.length,
    updated: dryRun ? 0 : assignments.length,
    rejected: rejected.length,
    byMethod: assignments.reduce((counts, assignment) => {
      counts[assignment.method] = (counts[assignment.method] || 0) + 1;
      return counts;
    }, {}),
    samples: assignments.slice(0, 20),
    rejectedSamples: rejected.slice(0, 20),
  }, null, 2));
} finally {
  appClient.release();
  ragClient.release();
  await appPool.end();
  await ragPool.end();
}
