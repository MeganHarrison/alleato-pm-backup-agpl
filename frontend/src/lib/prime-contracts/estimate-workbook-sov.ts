import type { WorkBook, WorkSheet } from "xlsx";
import * as XLSX from "xlsx";

export interface EstimateWorkbookImportRow {
  sourceSheet: "General Conditions" | "Details";
  rowNumber: number;
  costCode: string;
  costType: string;
  costTypeCode: string;
  description: string;
  workDescription: string | null;
  budgetAmount: number;
  unitQty: number | null;
  unitOfMeasure: string | null;
  unitCost: number | null;
  includeInPrimeContract: boolean;
  includeInOwnerSov: boolean;
  warnings: string[];
}

export interface EstimateWorkbookImportPreview {
  kind: "alleato_estimate_workbook";
  rows: EstimateWorkbookImportRow[];
  skippedRows: number;
  totalBudgetAmount: number;
  warnings: string[];
  sheets: string[];
}

const COST_TYPE_BY_LABEL: Record<string, string> = {
  revenue: "R",
  "contract revenue": "R",
  labor: "L",
  expense: "X",
  equipment: "E",
  material: "M",
  materials: "M",
  subcontract: "S",
  subcontractor: "S",
};

const COST_CODE_PATTERN = /^\d{1,2}-\d{3,5}$/;

function getCellValue(sheet: WorkSheet, address: string): unknown {
  const cell = sheet[address];
  return cell?.v ?? null;
}

function getString(sheet: WorkSheet, address: string): string {
  const value = getCellValue(sheet, address);
  return value == null ? "" : String(value).trim();
}

function getNumber(sheet: WorkSheet, address: string): number | null {
  const value = getCellValue(sheet, address);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCostType(value: string): string | null {
  const key = value.trim().toLowerCase();
  return COST_TYPE_BY_LABEL[key] ?? null;
}

function buildWarningPrefix(sheet: string, rowNumber: number): string {
  return `${sheet} row ${rowNumber}`;
}

function pushCodeWarnings(
  warnings: string[],
  sheet: string,
  rowNumber: number,
  costCode: string,
) {
  if (!COST_CODE_PATTERN.test(costCode)) {
    warnings.push(
      `${buildWarningPrefix(sheet, rowNumber)}: Cost code "${costCode}" does not match the expected NN-NNNN format.`,
    );
  }
}

function isStructuralRowLabel(costCode: string, costType: string): boolean {
  const label = costCode.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (label === "total" || label === "subtotal") return true;
  return !costType && !COST_CODE_PATTERN.test(costCode);
}

function parseGeneralConditions(workbook: WorkBook): {
  rows: EstimateWorkbookImportRow[];
  skippedRows: number;
  warnings: string[];
} {
  const sheetName = "General Conditions";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], skippedRows: 0, warnings: [] };

  const rows: EstimateWorkbookImportRow[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:I1");

  for (let rowNumber = 4; rowNumber <= range.e.r + 1; rowNumber++) {
    const costCode = getString(sheet, `A${rowNumber}`);
    const description = getString(sheet, `B${rowNumber}`);
    const costType = getString(sheet, `C${rowNumber}`);
    const budgetAmount = getNumber(sheet, `D${rowNumber}`) ?? 0;

    if (!costCode && !description && !costType && budgetAmount === 0) {
      skippedRows += 1;
      continue;
    }

    if (!costCode || isStructuralRowLabel(costCode, costType)) {
      skippedRows += 1;
      continue;
    }

    const costTypeCode = normalizeCostType(costType);
    const rowWarnings: string[] = [];
    pushCodeWarnings(rowWarnings, sheetName, rowNumber, costCode);

    if (!costTypeCode && costType) {
      rowWarnings.push(
        `${buildWarningPrefix(sheetName, rowNumber)}: Cost type "${costType}" is not importable.`,
      );
    }

    warnings.push(...rowWarnings);
    rows.push({
      sourceSheet: sheetName,
      rowNumber,
      costCode,
      costType,
      costTypeCode: costTypeCode ?? "",
      description: description || costCode,
      workDescription: null,
      budgetAmount,
      unitQty: getNumber(sheet, `F${rowNumber}`),
      unitOfMeasure: getString(sheet, `G${rowNumber}`) || null,
      unitCost: getNumber(sheet, `H${rowNumber}`),
      includeInPrimeContract: Boolean(costTypeCode),
      includeInOwnerSov: Boolean(costTypeCode && budgetAmount > 0),
      warnings: rowWarnings,
    });
  }

  return { rows, skippedRows, warnings };
}

function parseDetails(workbook: WorkBook): {
  rows: EstimateWorkbookImportRow[];
  skippedRows: number;
  warnings: string[];
} {
  const sheetName = "Details";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], skippedRows: 0, warnings: [] };

  const rows: EstimateWorkbookImportRow[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:F1");

  for (let rowNumber = 2; rowNumber <= range.e.r + 1; rowNumber++) {
    const costCode = getString(sheet, `A${rowNumber}`);
    const costType = getString(sheet, `B${rowNumber}`);
    const description = getString(sheet, `C${rowNumber}`);
    const workDescription = getString(sheet, `D${rowNumber}`);
    const budgetAmount = getNumber(sheet, `E${rowNumber}`) ?? 0;

    if (!costCode && !costType && !description && budgetAmount === 0) {
      skippedRows += 1;
      continue;
    }

    if (
      !costCode ||
      isStructuralRowLabel(costCode, costType) ||
      costCode.endsWith("-0000")
    ) {
      skippedRows += 1;
      continue;
    }

    if (!costType && budgetAmount === 0) {
      skippedRows += 1;
      continue;
    }

    const costTypeCode = normalizeCostType(costType);
    const rowWarnings: string[] = [];
    pushCodeWarnings(rowWarnings, sheetName, rowNumber, costCode);

    if (!costTypeCode && costType) {
      rowWarnings.push(
        `${buildWarningPrefix(sheetName, rowNumber)}: Cost type "${costType}" is not importable.`,
      );
    }

    warnings.push(...rowWarnings);
    rows.push({
      sourceSheet: sheetName,
      rowNumber,
      costCode,
      costType,
      costTypeCode: costTypeCode ?? "",
      description: description || workDescription || costCode,
      workDescription: workDescription || null,
      budgetAmount,
      unitQty: null,
      unitOfMeasure: null,
      unitCost: null,
      includeInPrimeContract: Boolean(costTypeCode),
      includeInOwnerSov: Boolean(costTypeCode && budgetAmount > 0),
      warnings: rowWarnings,
    });
  }

  return { rows, skippedRows, warnings };
}

export function isAlleatoEstimateWorkbook(workbook: WorkBook): boolean {
  return (
    workbook.SheetNames.includes("General Conditions") &&
    workbook.SheetNames.includes("Details")
  );
}

export function parseAlleatoEstimateWorkbook(
  workbook: WorkBook,
): EstimateWorkbookImportPreview {
  const generalConditions = parseGeneralConditions(workbook);
  const details = parseDetails(workbook);
  const rows = [...generalConditions.rows, ...details.rows];
  const importableRows = rows.filter((row) => row.includeInPrimeContract);

  return {
    kind: "alleato_estimate_workbook",
    rows,
    skippedRows: generalConditions.skippedRows + details.skippedRows,
    totalBudgetAmount: importableRows.reduce(
      (sum, row) => sum + row.budgetAmount,
      0,
    ),
    warnings: [...generalConditions.warnings, ...details.warnings],
    sheets: workbook.SheetNames,
  };
}

export function createAlleatoEstimateWorkbookTemplate(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  const generalConditions = XLSX.utils.aoa_to_sheet([
    ["Alleato Prime Contract SOV Import Template"],
    ["Fill rows below. Keep sheet names and column order unchanged."],
    [
      "Cost Code",
      "Description",
      "Cost Type",
      "Budget Amount",
      "Notes",
      "Unit Qty",
      "UOM",
      "Unit Cost",
    ],
    [
      "01-1000",
      "General Requirements",
      "Contract Revenue",
      12500,
      "",
      1,
      "LS",
      12500,
    ],
  ]);

  const details = XLSX.utils.aoa_to_sheet([
    [
      "Cost Code",
      "Cost Type",
      "Description",
      "Work Description",
      "Budget Amount",
      "Notes",
    ],
    ["03-3000", "Contract Revenue", "Concrete", "Slab and footings", 45000, ""],
    [
      "09-9000",
      "Contract Revenue",
      "Finishes",
      "Paint and wall finishes",
      18000,
      "",
    ],
  ]);

  generalConditions["!cols"] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
  ];
  details["!cols"] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 28 },
    { wch: 36 },
    { wch: 16 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    generalConditions,
    "General Conditions",
  );
  XLSX.utils.book_append_sheet(workbook, details, "Details");

  return XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;
}
