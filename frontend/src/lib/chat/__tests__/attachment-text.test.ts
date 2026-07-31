import * as XLSX from "xlsx";

import {
  formatEstimateWorkbookPreviewForChat,
  isSpreadsheetFile,
  spreadsheetBytesToCsv,
  truncateInlineText,
} from "../attachment-text";

describe("isSpreadsheetFile", () => {
  it("detects xlsx/xls by extension and mime type", () => {
    expect(isSpreadsheetFile("export.xlsx", undefined)).toBe(true);
    expect(isSpreadsheetFile("old.xls", undefined)).toBe(true);
    expect(
      isSpreadsheetFile(
        "x",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
    expect(isSpreadsheetFile("data.csv", "text/csv")).toBe(false);
    expect(isSpreadsheetFile("notes.txt", "text/plain")).toBe(false);
  });
});

describe("spreadsheetBytesToCsv", () => {
  it("serializes a server-validated estimate preview as structured SOV rows", () => {
    const text = formatEstimateWorkbookPreviewForChat({
      kind: "alleato_estimate_workbook",
      skippedRows: 0,
      warnings: [],
      sheets: ["General Conditions", "Details"],
      rows: [
        {
          sourceSheet: "Details",
          rowNumber: 2,
          costCode: "03-3000",
          costTypeCode: "R",
          description: "Concrete",
          workDescription: "Slab and footings",
          budgetAmount: 45000,
          unitQty: null,
          unitOfMeasure: null,
          unitCost: null,
          warnings: [],
          includeInOwnerSov: true,
          budgetCodeId: "00000000-0000-0000-0000-000000000006",
          selectedByDefault: true,
        },
      ],
    });

    expect(text).toContain("server-validated Prime Contract SOV source");
    expect(text).toContain('"kind":"alleato_estimate_workbook"');
    expect(text).toContain('"costCode":"03-3000"');
    expect(text).toContain('"costTypeCode":"R"');
    expect(text).toContain('"budgetAmount":45000');
  });

  it("parses a real xlsx workbook into CSV per sheet", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Title", "Amount"],
      ["Temp Wall", 12000],
      ["Vestibule", 4500],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Commitments");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const csv = await spreadsheetBytesToCsv(new Uint8Array(buf));
    expect(csv).toContain("# Sheet: Commitments");
    expect(csv).toContain("Title,Amount");
    expect(csv).toContain("Temp Wall,12000");
    expect(csv).toContain("Vestibule,4500");
  });

  it("returns a marker for a workbook with no data (does not throw)", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Empty");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const csv = await spreadsheetBytesToCsv(new Uint8Array(buf));
    expect(csv).toBe("(could not parse spreadsheet attachment)");
  });
});

describe("truncateInlineText", () => {
  it("truncates oversized text", () => {
    const big = "x".repeat(70_000);
    const out = truncateInlineText(big);
    expect(out.length).toBeLessThan(big.length);
    expect(out).toContain("…(truncated)");
  });
  it("leaves small text untouched", () => {
    expect(truncateInlineText("hi")).toBe("hi");
  });
});
