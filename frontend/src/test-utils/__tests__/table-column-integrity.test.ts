/**
 * @jest-environment jsdom
 */

import { assertTableColumnIntegrity } from "../table-column-integrity";

function tableFrom(html: string): HTMLTableElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.querySelector("table") as HTMLTableElement;
}

describe("assertTableColumnIntegrity", () => {
  it("passes when every row spans the same number of columns", () => {
    const table = tableFrom(`
      <table>
        <thead><tr><th>#</th><th>Amount</th><th>Billed</th><th>Remaining</th></tr></thead>
        <tbody><tr><td>1</td><td>10</td><td>0</td><td>10</td></tr></tbody>
        <tfoot><tr><td colspan="1">Totals</td><td>10</td><td>0</td><td>10</td></tr></tfoot>
      </table>
    `);
    expect(assertTableColumnIntegrity(table)).toBe(4);
  });

  it("FAILS when a footer row emits one extra cell (the SOV drift bug)", () => {
    // Header = 4 columns, but the footer has 5 cells — exactly the regression
    // that shifted Billed/Remaining one column right.
    const table = tableFrom(`
      <table>
        <thead><tr><th>#</th><th>Amount</th><th>Billed</th><th>Remaining</th></tr></thead>
        <tbody><tr><td>1</td><td>10</td><td>0</td><td>10</td></tr></tbody>
        <tfoot><tr><td>Totals</td><td>10</td><td></td><td>0</td><td>10</td></tr></tfoot>
      </table>
    `);
    expect(() => assertTableColumnIntegrity(table)).toThrow(/column drift/i);
    expect(() => assertTableColumnIntegrity(table)).toThrow(/tfoot row 0 spans 5/);
  });

  it("respects colSpan when summing a totals row", () => {
    const table = tableFrom(`
      <table>
        <thead><tr><th>#</th><th>Desc</th><th>Amount</th><th>Billed</th></tr></thead>
        <tbody><tr><td>1</td><td>x</td><td>10</td><td>0</td></tr></tbody>
        <tfoot><tr><td colspan="2">Totals</td><td>10</td><td>0</td></tr></tfoot>
      </table>
    `);
    expect(assertTableColumnIntegrity(table)).toBe(4);
  });

  it("ignores rows that use rowSpan (column math is not 1:1 there)", () => {
    const table = tableFrom(`
      <table>
        <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
        <tbody>
          <tr><td rowspan="2">merged</td><td>b1</td><td>c1</td></tr>
          <tr><td>b2</td><td>c2</td></tr>
        </tbody>
      </table>
    `);
    // Second body row only has 2 cells, but the rowSpan from row 1 covers it.
    expect(assertTableColumnIntegrity(table)).toBe(3);
  });
});
