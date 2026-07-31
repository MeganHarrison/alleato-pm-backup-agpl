/**
 * Pure parsing + mapping helpers for the commitments Excel import.
 *
 * Extracted from the import route so the column parsing, company-name
 * resolution, and per-table insert mapping can be unit-tested without a
 * database or an HTTP request.
 *
 * Two things this layer gets right that a naive importer does not:
 *  1. Company **names** (Procore / Job Planner exports use "Contracted Company"
 *     text, not UUIDs) are resolved to `companies.id`.
 *  2. Purchase orders use `signed_po_received_date`, NOT the subcontract's
 *     `signed_contract_received_date` — reusing the subcontract mapping for a
 *     PO insert throws PGRST204 on the missing column.
 */

import * as XLSX from "xlsx";
import { mapFormToInsert, type SubcontractFormData } from "./subcontracts";
import type { Database } from "@/types/database.types";
import { normalizeCommitmentContractNumber } from "@/lib/commitments/contract-number";

type SubcontractInsert = Database["public"]["Tables"]["subcontracts"]["Insert"];
type PurchaseOrderInsert = Database["public"]["Tables"]["purchase_orders"]["Insert"];

export interface ImportRow {
  number: string;
  type: string;
  title: string;
  status: string;
  /** Explicit UUID, when the file already carries a Company ID column. */
  companyId: string;
  /** Free-text company name ("Contracted Company"), resolved against companies. */
  companyName: string;
  originalAmount: number;
  costCode: string | null;
  costCodeDescription: string | null;
  description: string | null;
  retentionPercentage: number | null;
  startDate: string | null;
  estCompletionDate: string | null;
  contractDate: string | null;
  signedDate: string | null;
  actualCompletionDate: string | null;
  issuedOnDate: string | null;
  inclusions: string | null;
  exclusions: string | null;
}

export const COLUMN_ALIASES: Record<keyof ImportRow, string[]> = {
  number: ["number", "commitment number", "contract number", "no", "#"],
  type: ["type", "commitment type"],
  title: ["title", "name"],
  status: ["status"],
  companyId: ["company id", "company_id", "vendor id", "contractor id"],
  companyName: [
    "contracted company",
    "company",
    "company name",
    "vendor",
    "vendor name",
    "contractor",
    "subcontractor",
    "supplier",
  ],
  originalAmount: ["original amount", "amount", "contract amount", "original contract amount"],
  costCode: ["cost code", "cost_code", "budget code", "budget_code", "csi code", "csi"],
  costCodeDescription: [
    "cost code description",
    "cost_code_description",
    "csi description",
    "code description",
  ],
  description: ["description", "desc"],
  retentionPercentage: ["retention percentage", "retainage", "retention", "retainage %", "retention %"],
  startDate: ["start date", "start_date", "start"],
  estCompletionDate: [
    "est. completion date",
    "est completion date",
    "estimated completion date",
    "est_completion_date",
    "est. complete",
    "est complete",
  ],
  contractDate: ["contract date", "contract_date"],
  signedDate: ["signed date", "signed_date", "signed contract received date"],
  actualCompletionDate: ["actual completion date", "actual_completion_date", "act. complete", "act complete"],
  issuedOnDate: ["issued on date", "issued_on_date", "issued on"],
  inclusions: ["inclusions"],
  exclusions: ["exclusions"],
};

export function normalizeHeader(val: unknown): string {
  return String(val ?? "").trim().toLowerCase();
}

/** Collapse a company name to lowercase alphanumerics for fuzzy matching. */
export function normalizeCompanyName(name: string): string {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCellString(row: Record<string, unknown>, aliases: string[]): string {
  for (const alias of aliases) {
    const val = row[alias];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return "";
}

function getCellNumber(row: Record<string, unknown>, aliases: string[]): number | null {
  const raw = getCellString(row, aliases);
  if (!raw) return null;
  const cleaned = raw.replace(/[$,%]/g, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function parseDateCell(row: Record<string, unknown>, aliases: string[]): string | null {
  const raw = getCellString(row, aliases);
  if (!raw) return null;

  // Excel serial date number
  const num = Number(raw);
  if (!Number.isNaN(num) && num > 1000) {
    const date = XLSX.SSF.parse_date_code(num);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // MM/DD/YYYY (optionally with a trailing time component)
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const m = match[1].padStart(2, "0");
    const d = match[2].padStart(2, "0");
    return `${match[3]}-${m}-${d}`;
  }

  return null;
}

/** Parse one normalized (lowercased-header) row into an ImportRow, or null to skip. */
export function parseRow(rawRow: Record<string, unknown>): ImportRow | null {
  const number = getCellString(rawRow, COLUMN_ALIASES.number);
  if (!number) return null;

  const amount = getCellNumber(rawRow, COLUMN_ALIASES.originalAmount);
  if (amount === null) return null;

  return {
    number,
    type: getCellString(rawRow, COLUMN_ALIASES.type) || "subcontract",
    title: getCellString(rawRow, COLUMN_ALIASES.title),
    status: getCellString(rawRow, COLUMN_ALIASES.status) || "approved",
    companyId: getCellString(rawRow, COLUMN_ALIASES.companyId),
    companyName: getCellString(rawRow, COLUMN_ALIASES.companyName),
    originalAmount: amount,
    costCode: getCellString(rawRow, COLUMN_ALIASES.costCode) || null,
    costCodeDescription: getCellString(rawRow, COLUMN_ALIASES.costCodeDescription) || null,
    description: getCellString(rawRow, COLUMN_ALIASES.description) || null,
    retentionPercentage: getCellNumber(rawRow, COLUMN_ALIASES.retentionPercentage),
    startDate: parseDateCell(rawRow, COLUMN_ALIASES.startDate),
    estCompletionDate: parseDateCell(rawRow, COLUMN_ALIASES.estCompletionDate),
    contractDate: parseDateCell(rawRow, COLUMN_ALIASES.contractDate),
    signedDate: parseDateCell(rawRow, COLUMN_ALIASES.signedDate),
    actualCompletionDate: parseDateCell(rawRow, COLUMN_ALIASES.actualCompletionDate),
    issuedOnDate: parseDateCell(rawRow, COLUMN_ALIASES.issuedOnDate),
    inclusions: getCellString(rawRow, COLUMN_ALIASES.inclusions) || null,
    exclusions: getCellString(rawRow, COLUMN_ALIASES.exclusions) || null,
  };
}

export function isPurchaseOrder(type: string): boolean {
  const t = type.toLowerCase().replace(/[^a-z]/g, "");
  return t === "purchaseorder" || t === "po";
}

/** True when a Company ID cell holds a crawler placeholder, not a real id. */
export function isPlaceholderCompanyId(companyId: string): boolean {
  return companyId.includes("LOOKUP") || companyId.includes("NOT FOUND");
}

export interface CompanyRef {
  id: string;
  name: string;
}

/**
 * Resolve a row's company to a `companies.id`.
 * Prefers an explicit (non-placeholder) Company ID; otherwise matches the
 * company name against the provided index, exact-normalized first then by
 * containment in either direction.
 */
export function resolveCompanyId(row: ImportRow, companies: CompanyRef[]): string | null {
  if (row.companyId && !isPlaceholderCompanyId(row.companyId)) {
    return row.companyId;
  }
  if (!row.companyName) return null;
  const target = normalizeCompanyName(row.companyName);
  if (!target) return null;

  const exact = companies.find((c) => normalizeCompanyName(c.name) === target);
  if (exact) return exact.id;

  const contains = companies.find((c) => {
    const n = normalizeCompanyName(c.name);
    return n.includes(target) || target.includes(n);
  });
  return contains ? contains.id : null;
}

function toFormData(row: ImportRow, companyId: string | null, status: string): SubcontractFormData {
  return {
    contractNumber: row.number,
    contractCompanyId: companyId,
    title: row.title || null,
    status,
    executed: status === "Approved",
    defaultRetainagePercent: row.retentionPercentage,
    description: row.description,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    contractDate: row.contractDate ?? undefined,
    startDate: row.startDate ?? undefined,
    estimatedCompletionDate: row.estCompletionDate ?? undefined,
    actualCompletionDate: row.actualCompletionDate ?? undefined,
    signedContractReceivedDate: row.signedDate ?? undefined,
    issuedOnDate: row.issuedOnDate ?? undefined,
  };
}

export function buildSubcontractInsert(
  row: ImportRow,
  companyId: string | null,
  status: string,
  projectId: number,
  userId: string,
): SubcontractInsert {
  return mapFormToInsert(toFormData(row, companyId, status), projectId, userId);
}

/**
 * Build a purchase_orders insert. Starts from the subcontract mapping (shared
 * column set) then renames the signed-date field to the PO column. Reusing the
 * subcontract insert verbatim would fail: POs have no `signed_contract_received_date`.
 */
export function buildPurchaseOrderInsert(
  row: ImportRow,
  companyId: string | null,
  status: string,
  projectId: number,
  userId: string,
): PurchaseOrderInsert {
  const base = mapFormToInsert(toFormData(row, companyId, status), projectId, userId);
  const { signed_contract_received_date, ...rest } = base;
  return {
    ...rest,
    contract_number: normalizeCommitmentContractNumber(row.number, "PO-"),
    signed_po_received_date: signed_contract_received_date ?? null,
  } as PurchaseOrderInsert;
}
