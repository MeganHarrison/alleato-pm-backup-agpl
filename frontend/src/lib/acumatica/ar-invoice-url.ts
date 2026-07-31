const ACUMATICA_BASE_URL =
  process.env.ACUMATICA_BASE_URL ?? "https://alleatogroup.acumatica.com";

// Acumatica AR document-type codes for the Invoices and Memos screen (AR301000).
// Owner invoices sync as regular Invoices; the rest are here for completeness.
const AR_INVOICE_DOC_TYPE_CODE: Record<string, string> = {
  Invoice: "INV",
  "Credit Memo": "CRM",
  "Debit Memo": "DRM",
  "Cash Sale": "CSL",
  "Cash Return": "CSR",
};

/**
 * Deep-link to an owner (Accounts Receivable) invoice in Acumatica.
 * Mirrors {@link buildAcumaticaApBillHref} for AP bills — single source of truth
 * for the AR301000 URL format so callers never hand-build the query string.
 */
export function buildAcumaticaArInvoiceHref(
  refNbr: string,
  docType?: string | null,
): string {
  const normalizedDocType =
    AR_INVOICE_DOC_TYPE_CODE[docType ?? "Invoice"] ?? (docType ?? "INV");

  return `${ACUMATICA_BASE_URL}/Main?ScreenId=AR301000&DocType=${encodeURIComponent(normalizedDocType)}&RefNbr=${encodeURIComponent(refNbr)}`;
}
