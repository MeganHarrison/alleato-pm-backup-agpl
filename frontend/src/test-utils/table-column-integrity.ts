/**
 * Table column-integrity assertion.
 *
 * Catches the silent "footer cell drift" class of bug: a totals/footer row (or
 * any body row) that emits one cell too many or too few and shifts every value
 * one column sideways. This is invisible to TypeScript and ESLint and only
 * ~half-visible to a human reviewer — see the SOV totals-alignment regression
 * that motivated this guardrail.
 *
 * Invariant: every `<tr>`'s occupied column count must equal the header's
 * column count. "Occupied" accounts for both `colSpan` on the row's own cells
 * and `rowSpan` cells carried down from rows above, so grouped tables that use
 * `rowSpan` are handled correctly (not just skipped).
 *
 * @param table A rendered `<table>` element (e.g. `container.querySelector("table")`).
 * @returns The header column count, for convenience in assertions.
 * @throws If any body/footer row's occupied column count does not match the header.
 */
export function assertTableColumnIntegrity(table: HTMLTableElement): number {
  const colSpanSum = (row: HTMLTableRowElement): number =>
    Array.from(row.cells).reduce((sum, cell) => sum + (cell.colSpan || 1), 0);

  const headerRows = Array.from(table.tHead?.rows ?? []);
  // The last header row defines the real columns — any group/super-header rows
  // above it may intentionally span differently.
  const headerRow = headerRows[headerRows.length - 1];
  if (!headerRow) {
    throw new Error("assertTableColumnIntegrity: table has no <thead> row to anchor the column count.");
  }
  const columnCount = colSpanSum(headerRow);

  const offenders: string[] = [];

  // Walk a section's rows as a grid, tracking how many columns each row inherits
  // from rowSpan cells started in rows above it.
  const checkSection = (section: string, rows: HTMLTableRowElement[]): void => {
    // carry[i] = rows still occupied by a rowSpan covering column-slot i
    let carry: number[] = [];
    rows.forEach((row, index) => {
      const inherited = carry.filter((remaining) => remaining > 0).length;
      const ownSpan = colSpanSum(row);
      const occupied = inherited + ownSpan;
      if (occupied !== columnCount) {
        const label = row.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) ?? "";
        offenders.push(`${section} row ${index} spans ${occupied} columns (expected ${columnCount}) — "${label}"`);
      }
      // Advance the grid: decrement existing carries, then register this row's
      // own rowSpans across the columns its cells occupy.
      carry = carry.map((remaining) => remaining - 1).filter((remaining) => remaining > 0);
      for (const cell of Array.from(row.cells)) {
        const rowSpan = cell.rowSpan || 1;
        if (rowSpan > 1) {
          for (let i = 0; i < (cell.colSpan || 1); i += 1) {
            carry.push(rowSpan - 1);
          }
        }
      }
    });
  };

  checkSection("tbody", Array.from(table.tBodies).flatMap((body) => Array.from(body.rows)));
  checkSection("tfoot", Array.from(table.tFoot?.rows ?? []));

  if (offenders.length > 0) {
    throw new Error(
      `Table column drift: header defines ${columnCount} columns but —\n  ${offenders.join("\n  ")}`,
    );
  }

  return columnCount;
}
