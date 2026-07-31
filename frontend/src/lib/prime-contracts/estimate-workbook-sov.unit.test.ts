import * as XLSX from "xlsx";

import { parseAlleatoEstimateWorkbook } from "./estimate-workbook-sov";

describe("parseAlleatoEstimateWorkbook", () => {
  it("does not warn for estimate rows with blank cost type values", () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Alleato Prime Contract SOV Import Template"],
        ["Fill rows below. Keep sheet names and column order unchanged."],
        ["Cost Code", "Description", "Cost Type", "Budget Amount"],
        ["01-1000", "General Requirements", "", 0],
      ]),
      "General Conditions",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [
          "Cost Code",
          "Cost Type",
          "Description",
          "Work Description",
          "Budget Amount",
        ],
        ["03-3000", "", "Concrete", "Slab and footings", 100],
      ]),
      "Details",
    );

    const preview = parseAlleatoEstimateWorkbook(workbook);

    expect(preview.warnings).toEqual([]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows.every((row) => row.warnings.length === 0)).toBe(true);
    expect(preview.rows.every((row) => !row.includeInOwnerSov)).toBe(true);
  });

  it("still warns for unknown nonblank cost type values", () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Alleato Prime Contract SOV Import Template"],
        ["Fill rows below. Keep sheet names and column order unchanged."],
        ["Cost Code", "Description", "Cost Type", "Budget Amount"],
        ["01-1000", "General Requirements", "Not A Type", 100],
      ]),
      "General Conditions",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [
          "Cost Code",
          "Cost Type",
          "Description",
          "Work Description",
          "Budget Amount",
        ],
      ]),
      "Details",
    );

    const preview = parseAlleatoEstimateWorkbook(workbook);

    expect(preview.warnings).toEqual([
      'General Conditions row 4: Cost type "Not A Type" is not importable.',
    ]);
  });

  it("skips subtotal and section-label rows instead of warning about cost-code format", () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Alleato Prime Contract SOV Import Template"],
        ["Fill rows below. Keep sheet names and column order unchanged."],
        ["Cost Code", "Description", "Cost Type", "Budget Amount"],
      ]),
      "General Conditions",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [
          "Cost Code",
          "Cost Type",
          "Description",
          "Work Description",
          "Budget Amount",
        ],
        ["01-6113", "Expense", "Software Licensing", "", 1500],
        ["Subtotal", "", "", "", 1500],
        ["Insurance", "", "", "", 0],
      ]),
      "Details",
    );

    const preview = parseAlleatoEstimateWorkbook(workbook);

    expect(preview.warnings).toEqual([]);
    expect(preview.rows.map((row) => row.costCode)).toEqual(["01-6113"]);
    expect(preview.skippedRows).toBe(2);
  });

  it("requires a cost type for 55-0100 contingency rows", () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Alleato Prime Contract SOV Import Template"],
        ["Fill rows below. Keep sheet names and column order unchanged."],
        ["Cost Code", "Description", "Cost Type", "Budget Amount"],
      ]),
      "General Conditions",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [
          "Cost Code",
          "Cost Type",
          "Description",
          "Work Description",
          "Budget Amount",
        ],
        ["55-0100", "", "Contingency", "5%", 20465.1],
      ]),
      "Details",
    );

    const preview = parseAlleatoEstimateWorkbook(workbook);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      costCode: "55-0100",
      costTypeCode: "",
      description: "Contingency",
      workDescription: "5%",
      budgetAmount: 20465.1,
      includeInOwnerSov: false,
      includeInPrimeContract: false,
    });
  });
});
