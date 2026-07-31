import { z } from "zod";

export const fmdsVisionCellSchema = z.object({
  text: z.string(),
  normalized_value: z.string().nullable(),
  unit: z.string().nullable(),
  is_blank: z.boolean(),
  row_span: z.number().int().min(1),
  column_span: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
});

export const fmdsVisionRowSchema = z.object({
  row_index: z.number().int().min(0),
  kind: z.enum(["header", "body", "note"]),
  cells: z.array(fmdsVisionCellSchema),
});

export const fmdsVisionColumnSchema = z.object({
  column_index: z.number().int().min(0),
  label: z.string(),
  unit: z.string().nullable(),
  notes: z.string().nullable(),
});

export const fmdsVisionTableStructureSchema = z.object({
  table_identifier: z.string(),
  title: z.string(),
  columns: z.array(fmdsVisionColumnSchema),
  rows: z.array(fmdsVisionRowSchema),
  footnotes: z.array(z.string()),
  governing_text: z.array(z.string()),
  symbols: z.array(z.string()),
  ambiguities: z.array(z.string()),
  completeness: z.enum(["complete", "partial", "unreadable"]),
  confidence: z.number().min(0).max(1),
});

export const fmdsVisionExtractionSchema = z.object({
  extracted_structure: fmdsVisionTableStructureSchema,
});

export const fmdsVisionVerificationSchema = z.object({
  exact_match: z.boolean(),
  completeness: z.enum(["complete", "partial", "unreadable"]),
  confidence: z.number().min(0).max(1),
  discrepancies: z.array(
    z.object({
      location: z.string(),
      severity: z.enum(["critical", "material", "minor"]),
      description: z.string(),
      suggested_correction: z.string().nullable(),
    }),
  ),
  unreadable_regions: z.array(z.string()),
});

export type FmdsVisionTableStructure = z.infer<
  typeof fmdsVisionTableStructureSchema
>;

export interface FmdsVisionDisplayCell {
  key: string;
  text: string;
  rowSpan: number;
  columnSpan: number;
}

export interface FmdsVisionDisplayGrid {
  columns: Array<{ key: string; text: string }>;
  rows: FmdsVisionDisplayCell[][];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function hasStructuredTableRows(value: unknown): boolean {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.rows) || record.rows.length === 0) {
    return false;
  }

  return record.rows.some((row) => {
    if (Array.isArray(row)) return row.length > 0;
    const rowRecord = asRecord(row);
    return Boolean(
      rowRecord && Array.isArray(rowRecord.cells) && rowRecord.cells.length > 0,
    );
  });
}

export function candidateOutputHasStructuredRows(value: unknown): boolean {
  const record = asRecord(value);
  return hasStructuredTableRows(record?.extracted_structure);
}

export function rowsForCandidateDisplay(value: unknown): unknown[] {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.rows)) return [];
  const hasExplicitColumns =
    Array.isArray(record.columns) && record.columns.length > 0;

  return record.rows.filter((row) => {
    const rowRecord = asRecord(row);
    return !(hasExplicitColumns && rowRecord?.kind === "header");
  });
}

export function getVisionCandidateDisplayGrid(
  value: unknown,
): FmdsVisionDisplayGrid | null {
  const parsed = fmdsVisionTableStructureSchema.safeParse(value);
  if (!parsed.success) return null;

  const structure = parsed.data;
  let activeSpans = Array.from({ length: structure.columns.length }, () => 0);
  const rows = structure.rows
    .filter((row) => row.kind !== "header")
    .map((row) => {
      const occupiedFromPriorRow = activeSpans.map(
        (remaining) => remaining > 0,
      );
      const nextActiveSpans = activeSpans.map((remaining) =>
        Math.max(0, remaining - 1),
      );
      const coveredInCurrentRow = new Set<number>();
      const displayCells: FmdsVisionDisplayCell[] = [];

      row.cells.forEach((cell, columnIndex) => {
        if (
          occupiedFromPriorRow[columnIndex] ||
          coveredInCurrentRow.has(columnIndex)
        ) {
          return;
        }

        displayCells.push({
          key: `${row.row_index}-${columnIndex}`,
          text: cell.text,
          rowSpan: cell.row_span,
          columnSpan: cell.column_span,
        });
        for (
          let coveredColumn = columnIndex;
          coveredColumn <
          Math.min(structure.columns.length, columnIndex + cell.column_span);
          coveredColumn += 1
        ) {
          if (coveredColumn > columnIndex) {
            coveredInCurrentRow.add(coveredColumn);
          }
          if (cell.row_span > 1) {
            nextActiveSpans[coveredColumn] = Math.max(
              nextActiveSpans[coveredColumn],
              cell.row_span - 1,
            );
          }
        }
      });
      activeSpans = nextActiveSpans;
      return displayCells;
    });

  return {
    columns: structure.columns.map((column) => ({
      key: `column-${column.column_index}`,
      text: column.label,
    })),
    rows,
  };
}

export function getCandidateStructure(
  value: unknown,
): FmdsVisionTableStructure | null {
  const record = asRecord(value);
  const parsed = fmdsVisionTableStructureSchema.safeParse(
    record?.extracted_structure,
  );
  return parsed.success ? parsed.data : null;
}
