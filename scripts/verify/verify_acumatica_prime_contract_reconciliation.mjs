#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  args.set(key, next && !next.startsWith("--") ? next : "true");
  if (next && !next.startsWith("--")) i += 1;
}

const contractId = args.get("contract-id") ?? null;
const projectId = args.get("project-id") ?? null;
const strictTokens = args.get("strict-tokens") === "true";

if (!process.env.DATABASE_URL) {
  console.error("FAIL: DATABASE_URL is required.");
  process.exit(1);
}

function connectionString() {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete("sslmode");
  return url.toString();
}

const pool = new pg.Pool({
  connectionString: connectionString(),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function amount(value) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function hasContractToken(row, contract) {
  const tokens = [
    contract.contract_number,
    contract.contract_number?.replace(/^PC-/i, ""),
    contract.acumatica_project_id,
    contract.project_number,
    contract.project_name,
  ]
    .filter((token) => typeof token === "string" && token.trim().length >= 4)
    .map(normalize);

  if (tokens.length === 0) return true;

  const haystack = [
    row.description,
    row.source_description,
    row.external_ref,
    row.payment_ref,
    row.reference_nbr,
    row.project,
    row.project_code,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return tokens.some((token) => haystack.includes(token));
}

function isOpenAccountingStatus(status) {
  return ["released", "closed", "open"].includes(normalize(status));
}

function acumaticaUrl(screenId, docType, refNbr) {
  const params = new URLSearchParams({
    ScreenId: screenId,
    DocType: docType || (screenId === "AR301000" ? "Invoice" : "Payment"),
    RefNbr: refNbr,
  });
  return `https://alleatogroup.acumatica.com/Main?${params.toString()}`;
}

async function loadContracts(client) {
  const filters = [];
  const values = [];

  if (contractId) {
    values.push(contractId);
    filters.push(`pc.id = $${values.length}`);
  }
  if (projectId) {
    values.push(Number(projectId));
    filters.push(`pc.project_id = $${values.length}`);
  }

  const where = filters.length > 0 ? `where ${filters.join(" and ")}` : "";
  const result = await client.query(
    `select
       pc.id::text,
       pc.contract_number,
       pc.project_id::int,
       pc.contract_company_id::text,
       p.name as project_name,
       p.project_number,
       p.acumatica_project_id,
       c.customer_id,
       c.name as company_name
     from public.prime_contracts pc
     left join public.projects p on p.id = pc.project_id
     left join public.companies c on c.id = pc.contract_company_id
     ${where}
     order by p.project_number nulls last, pc.contract_number`,
    values,
  );
  return result.rows;
}

async function loadProjectionRows(client, contractIds) {
  if (contractIds.length === 0) return { payments: [], invoices: [] };
  const [payments, invoices] = await Promise.all([
    client.query(
      `select
         p.id::text,
         p.contract_id::text,
         p.project_id::int,
         p.payment_number,
         p.amount,
         p.payment_date,
         p.acumatica_ref_nbr,
         p.acumatica_doc_type,
         p.notes,
         ap.customer_id,
         ap.document_type,
         ap.status as source_status,
         ap.description as source_description,
         ap.payment_amount as source_amount,
         ap.application_date as source_date,
         ap.payment_ref,
         ap.external_ref,
         ap.project_code,
         ap.acumatica_sync_at
       from public.prime_contract_payments p
       left join public.acumatica_payments ap
         on ap.reference_nbr = p.acumatica_ref_nbr
        and coalesce(ap.document_type, '') = coalesce(p.acumatica_doc_type, '')
       where p.contract_id = any($1::uuid[])
         and p.acumatica_ref_nbr is not null`,
      [contractIds],
    ),
    client.query(
      `select
         i.id::text,
         i.prime_contract_id::text as contract_id,
         i.invoice_number,
         i.gross_amount,
         i.net_amount,
         i.paid_amount,
         i.acumatica_ref_nbr,
         i.acumatica_doc_type,
         ai.customer,
         ai.type as source_type,
         ai.status as source_status,
         ai.description as source_description,
         ai.amount as source_amount,
         ai.date as source_date,
         ai.project,
         ai.acumatica_sync_at
       from public.owner_invoices i
       left join public.acumatica_ar_invoices ai
         on ai.reference_nbr = i.acumatica_ref_nbr
        and coalesce(ai.type, 'Invoice') = coalesce(i.acumatica_doc_type, 'Invoice')
       where i.prime_contract_id = any($1::uuid[])
         and i.acumatica_ref_nbr is not null`,
      [contractIds],
    ),
  ]);
  return { payments: payments.rows, invoices: invoices.rows };
}

async function loadSourceRows(client, contracts) {
  const customerIds = Array.from(
    new Set(contracts.map((contract) => contract.customer_id).filter(Boolean)),
  );
  if (customerIds.length === 0) return { payments: [], invoices: [] };

  const [payments, invoices] = await Promise.all([
    client.query(
      `select
         reference_nbr,
         document_type,
         customer_id,
         status,
         description,
         payment_amount,
         application_date,
         payment_ref,
         external_ref,
         project_code,
         acumatica_sync_at
       from public.acumatica_payments
       where customer_id = any($1::text[])`,
      [customerIds],
    ),
    client.query(
      `select
         reference_nbr,
         type,
         customer,
         status,
         description,
         amount,
         date,
         project,
         acumatica_sync_at
       from public.acumatica_ar_invoices
       where customer = any($1::text[])`,
      [customerIds],
    ),
  ]);

  return { payments: payments.rows, invoices: invoices.rows };
}

function recordTokenMismatch(collection, details) {
  collection.push({
    kind: "token_mismatch_warning",
    ...details,
  });
}

function checkProjectedPayments({ contract, projectedPayments, failures, warnings }) {
  for (const row of projectedPayments) {
    const ref = row.acumatica_ref_nbr ?? row.payment_number;
    if (!row.customer_id) {
      failures.push({
        kind: "payment_projection_missing_source",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        ref,
      });
      continue;
    }

    if (contract.customer_id && row.customer_id !== contract.customer_id) {
      failures.push({
        kind: "payment_projection_customer_mismatch",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        expectedCustomer: contract.customer_id,
        actualCustomer: row.customer_id,
        ref,
      });
    }

    if (normalize(row.document_type).includes("credit memo")) {
      failures.push({
        kind: "payment_projection_credit_memo",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        ref,
        acumaticaUrl: acumaticaUrl("AR302000", row.document_type, ref),
      });
    }

    if (!hasContractToken(row, contract)) {
      const target = strictTokens ? failures : warnings;
      recordTokenMismatch(target, {
        projection: "payment",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        ref,
        description: row.source_description ?? row.notes,
        acumaticaUrl: acumaticaUrl("AR302000", row.document_type, ref),
      });
    }

    if (amount(row.amount) !== amount(row.source_amount)) {
      failures.push({
        kind: "payment_projection_amount_mismatch",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        ref,
        projectedAmount: amount(row.amount),
        sourceAmount: amount(row.source_amount),
      });
    }
  }
}

function checkProjectedInvoices({ contract, projectedInvoices, failures, warnings }) {
  for (const row of projectedInvoices) {
    const ref = row.acumatica_ref_nbr ?? row.invoice_number;
    if (!row.customer) {
      failures.push({
        kind: "invoice_projection_missing_source",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        ref,
      });
      continue;
    }

    if (contract.customer_id && row.customer !== contract.customer_id) {
      failures.push({
        kind: "invoice_projection_customer_mismatch",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        expectedCustomer: contract.customer_id,
        actualCustomer: row.customer,
        ref,
      });
    }

    if (!hasContractToken(row, contract)) {
      const target = strictTokens ? failures : warnings;
      recordTokenMismatch(target, {
        projection: "invoice",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        ref,
        description: row.source_description,
        acumaticaUrl: acumaticaUrl("AR301000", row.source_type, ref),
      });
    }

    // Legacy owner_invoice projections may keep local amounts at zero while
    // Acumatica-backed screens display the mirror amount. Only fail a numeric
    // mismatch when the projection has a non-zero local value to compare.
    if (amount(row.gross_amount) > 0 && amount(row.gross_amount) !== amount(row.source_amount)) {
      failures.push({
        kind: "invoice_projection_amount_mismatch",
        contractId: contract.id,
        contractNumber: contract.contract_number,
        ref,
        projectedAmount: amount(row.gross_amount),
        sourceAmount: amount(row.source_amount),
      });
    }
  }
}

function checkMissingPaymentProjections({
  contract,
  sourcePayments,
  projectedPayments,
  failures,
}) {
  const projectedRefs = new Set(
    projectedPayments.map((row) => `${row.acumatica_doc_type ?? ""}|${row.acumatica_ref_nbr}`),
  );

  for (const row of sourcePayments) {
    if (row.customer_id !== contract.customer_id) continue;
    if (!isOpenAccountingStatus(row.status)) continue;
    if (normalize(row.document_type).includes("credit memo")) continue;
    if (!hasContractToken(row, contract)) continue;

    const key = `${row.document_type ?? ""}|${row.reference_nbr}`;
    if (projectedRefs.has(key)) continue;

    failures.push({
      kind: "missing_payment_projection",
      contractId: contract.id,
      contractNumber: contract.contract_number,
      ref: row.reference_nbr,
      amount: amount(row.payment_amount),
      acumaticaUrl: acumaticaUrl("AR302000", row.document_type, row.reference_nbr),
    });
  }
}

function checkMissingInvoiceProjections({
  contract,
  sourceInvoices,
  projectedInvoices,
  failures,
}) {
  const projectedRefs = new Set(
    projectedInvoices.map((row) => `${row.acumatica_doc_type ?? "Invoice"}|${row.acumatica_ref_nbr}`),
  );

  for (const row of sourceInvoices) {
    if (row.customer !== contract.customer_id) continue;
    if (!hasContractToken(row, contract)) continue;

    const key = `${row.type ?? "Invoice"}|${row.reference_nbr}`;
    if (projectedRefs.has(key)) continue;

    failures.push({
      kind: "missing_invoice_projection",
      contractId: contract.id,
      contractNumber: contract.contract_number,
      ref: row.reference_nbr,
      amount: amount(row.amount),
      acumaticaUrl: acumaticaUrl("AR301000", row.type, row.reference_nbr),
    });
  }
}

const client = await pool.connect();
try {
  const contracts = await loadContracts(client);
  if (contracts.length === 0) {
    console.error("FAIL: No prime contracts matched the requested scope.");
    process.exitCode = 1;
  } else {
    const contractIds = contracts.map((contract) => contract.id);
    const projections = await loadProjectionRows(client, contractIds);
    const sources = await loadSourceRows(client, contracts);
    const failures = [];
    const warnings = [];

    for (const contract of contracts) {
      const projectedPayments = projections.payments.filter(
        (row) => row.contract_id === contract.id,
      );
      const projectedInvoices = projections.invoices.filter(
        (row) => row.contract_id === contract.id,
      );

      checkProjectedPayments({ contract, projectedPayments, failures, warnings });
      checkProjectedInvoices({ contract, projectedInvoices, failures, warnings });
      checkMissingPaymentProjections({
        contract,
        sourcePayments: sources.payments,
        projectedPayments,
        failures,
      });
      checkMissingInvoiceProjections({
        contract,
        sourceInvoices: sources.invoices,
        projectedInvoices,
        failures,
      });
    }

    if (failures.length > 0) {
      console.error(
        JSON.stringify(
          {
            status: "fail",
            checkedContracts: contracts.length,
            failureCount: failures.length,
            failures: failures.slice(0, 50),
            warningCount: warnings.length,
            warnings: warnings.slice(0, 25),
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
    } else {
      console.log(
        JSON.stringify(
          {
            status: "pass",
            checkedContracts: contracts.length,
            projectedPayments: projections.payments.length,
            projectedInvoices: projections.invoices.length,
            warningCount: warnings.length,
            warnings: warnings.slice(0, 25),
          },
          null,
          2,
        ),
      );
    }
  }
} finally {
  client.release();
  await pool.end();
}
