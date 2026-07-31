const ACUMATICA_BASE_URL =
  process.env.ACUMATICA_BASE_URL ?? "https://alleatogroup.acumatica.com";

const AP_BILL_DOC_TYPE_CODE: Record<string, string> = {
  Bill: "INV",
  "Debit Adj.": "ADR",
  "Credit Adj.": "ACR",
};

export function buildAcumaticaApBillHref(
  docType: string | null | undefined,
  refNbr: string,
): string {
  const normalizedDocType =
    AP_BILL_DOC_TYPE_CODE[docType ?? "Bill"] ?? (docType ?? "Bill");

  return `${ACUMATICA_BASE_URL}/Main?ScreenId=AP301000&DocType=${encodeURIComponent(normalizedDocType)}&RefNbr=${encodeURIComponent(refNbr)}`;
}
