import {
  candidateOutputHasStructuredRows,
  getCandidateStructure,
  getVisionCandidateDisplayGrid,
  hasStructuredTableRows,
  rowsForCandidateDisplay,
} from "../fmds-vision-candidate";

const structure = {
  table_identifier: "2.1.4.5.5",
  title: "Test table",
  columns: [{ column_index: 0, label: "Height", unit: "ft", notes: null }],
  rows: [
    {
      row_index: 0,
      kind: "body" as const,
      cells: [
        {
          text: "10",
          normalized_value: "10",
          unit: "ft",
          is_blank: false,
          row_span: 1,
          column_span: 1,
          confidence: 0.99,
        },
      ],
    },
  ],
  footnotes: [],
  governing_text: [],
  symbols: [],
  ambiguities: [],
  completeness: "complete" as const,
  confidence: 0.98,
};

describe("FMDS vision candidate readiness", () => {
  it("rejects queue placeholders and empty extraction payloads", () => {
    expect(hasStructuredTableRows({ rows: [] })).toBe(false);
    expect(
      candidateOutputHasStructuredRows({
        extracted_structure: { rows: [] },
        candidate_only: true,
      }),
    ).toBe(false);
  });

  it("accepts structured row objects and validates the complete schema", () => {
    expect(hasStructuredTableRows(structure)).toBe(true);
    expect(
      candidateOutputHasStructuredRows({ extracted_structure: structure }),
    ).toBe(true);
    expect(
      getCandidateStructure({ extracted_structure: structure })?.columns[0]
        .label,
    ).toBe("Height");
  });

  it("does not treat malformed row objects as review-ready", () => {
    expect(hasStructuredTableRows({ rows: [{ cells: [] }] })).toBe(false);
    expect(getCandidateStructure({ extracted_structure: { rows: [{}] } })).toBe(
      null,
    );
  });

  it("does not repeat a header row when explicit columns are present", () => {
    const header = {
      row_index: 0,
      kind: "header",
      cells: [{ text: "Height" }],
    };
    const body = { row_index: 1, kind: "body", cells: [{ text: "10" }] };

    expect(
      rowsForCandidateDisplay({
        columns: [{ label: "Height" }],
        rows: [header, body],
      }),
    ).toEqual([body]);
    expect(rowsForCandidateDisplay({ rows: [header, body] })).toEqual([
      header,
      body,
    ]);
  });

  it("preserves merged-cell geometry without shifting later columns", () => {
    const merged = {
      ...structure,
      columns: [
        { column_index: 0, label: "Type", unit: null, notes: null },
        { column_index: 1, label: "Value", unit: null, notes: null },
      ],
      rows: [
        {
          row_index: 0,
          kind: "body" as const,
          cells: [
            {
              ...structure.rows[0].cells[0],
              text: "Extended-Coverage",
              row_span: 2,
            },
            { ...structure.rows[0].cells[0], text: "6 or less" },
          ],
        },
        {
          row_index: 1,
          kind: "body" as const,
          cells: [
            {
              ...structure.rows[0].cells[0],
              text: "",
              is_blank: true,
            },
            { ...structure.rows[0].cells[0], text: "8" },
          ],
        },
      ],
    };

    expect(getVisionCandidateDisplayGrid(merged)?.rows).toEqual([
      [
        expect.objectContaining({ text: "Extended-Coverage", rowSpan: 2 }),
        expect.objectContaining({ text: "6 or less" }),
      ],
      [expect.objectContaining({ text: "8" })],
    ]);
  });
});
