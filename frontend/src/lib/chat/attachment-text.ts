/**
 * Convert attached spreadsheet exports into inline CSV text so the chat assistant
 * can actually read migration exports (xlsx/xls) instead of only csv/txt. SheetJS
 * (`xlsx`) is already a dependency; it's dynamically imported so it stays out of
 * the main client bundle and only loads when a spreadsheet is attached.
 */
const SPREADSHEET_EXT = /\.(xlsx|xlsm|xlsb|xls)$/i;

// Cap inlined output so a large workbook can't blow the model context window.
const MAX_INLINE_CHARS = 60_000;

export function isSpreadsheetFile(
  filename: string | undefined,
  mediaType: string | undefined,
): boolean {
  const name = (filename ?? "").toLowerCase();
  const mt = mediaType ?? "";
  return (
    SPREADSHEET_EXT.test(name) ||
    mt.includes("spreadsheetml") || // xlsx
    mt === "application/vnd.ms-excel" // xls
  );
}

type EstimateWorkbookPreviewRow = {
  sourceSheet: "General Conditions" | "Details";
  rowNumber: number;
  costCode: string;
  costTypeCode: string;
  description: string;
  workDescription: string | null;
  budgetAmount: number;
  unitQty: number | null;
  unitOfMeasure: string | null;
  unitCost: number | null;
  warnings: string[];
  includeInOwnerSov: boolean;
  budgetCodeId?: string | null;
  selectedByDefault?: boolean;
};

export type EstimateWorkbookChatPreview = {
  kind: "alleato_estimate_workbook";
  rows: EstimateWorkbookPreviewRow[];
  skippedRows: number;
  warnings: string[];
  sheets: string[];
};

export function formatEstimateWorkbookPreviewForChat(
  preview: EstimateWorkbookChatPreview,
): string {
  const ownerSovRows = preview.rows
    .filter((row) => row.includeInOwnerSov)
    .map((row) => ({
      sourceSheet: row.sourceSheet,
      rowNumber: row.rowNumber,
      costCode: row.costCode,
      costTypeCode: row.costTypeCode,
      description: row.description,
      workDescription: row.workDescription,
      budgetAmount: row.budgetAmount,
      unitQty: row.unitQty,
      unitOfMeasure: row.unitOfMeasure,
      unitCost: row.unitCost,
      warnings: row.warnings,
      budgetCodeId: row.budgetCodeId ?? null,
    }));
  let includedRows = ownerSovRows;
  let omittedRows = 0;
  let structured = "";
  do {
    structured = [
      "# Alleato Estimate Workbook — server-validated Prime Contract SOV source",
      "Use createPrimeContract with sovSource=workbook and pass workbookRows and workbookOmittedRows exactly as provided. Do not infer missing rows or identifiers.",
      JSON.stringify({
        kind: preview.kind,
        workbookRows: includedRows,
        omittedRows,
        skippedRows: preview.skippedRows,
        warnings: preview.warnings,
        sheets: preview.sheets,
      }),
    ].join("\n");
    if (structured.length <= MAX_INLINE_CHARS || includedRows.length === 0) {
      break;
    }
    const nextLength = Math.max(0, includedRows.length - 25);
    omittedRows += includedRows.length - nextLength;
    includedRows = includedRows.slice(0, nextLength);
  } while (includedRows.length > 0);
  return structured;
}

/**
 * Parse spreadsheet bytes into CSV text (one block per non-empty sheet).
 * Truncates to {@link MAX_INLINE_CHARS}. Returns a short marker on parse failure
 * rather than throwing — a bad attachment must not break the message.
 */
export async function spreadsheetBytesToCsv(bytes: Uint8Array): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(bytes, { type: "array" });
    const blocks: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet).trim();
      if (csv) blocks.push(`# Sheet: ${sheetName}\n${csv}`);
    }
    const text = blocks.join("\n\n");
    if (!text.trim()) return "(could not parse spreadsheet attachment)";
    return text.length > MAX_INLINE_CHARS
      ? `${text.slice(0, MAX_INLINE_CHARS)}\n…(truncated)`
      : text;
  } catch {
    return "(could not parse spreadsheet attachment)";
  }
}

export function truncateInlineText(text: string): string {
  return text.length > MAX_INLINE_CHARS
    ? `${text.slice(0, MAX_INLINE_CHARS)}\n…(truncated)`
    : text;
}
