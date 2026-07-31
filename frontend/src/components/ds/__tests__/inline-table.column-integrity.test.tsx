/**
 * @jest-environment jsdom
 *
 * Guardrail for the "totals row doesn't line up with its columns" class of bug.
 *
 * A commitment SOV footer once used `colSpan={total - 3}` for its "Total" label
 * while the header had one more column (the actions column), so every total
 * landed one column to the right of the value it summed. Nothing caught it until
 * a human eyeballed the page.
 *
 * `InlineTable` now runs a dev-time check that any body/footer row spans exactly
 * as many columns as the header. These tests prove that check fires on a
 * mismatch and stays silent when the table is correct.
 */

import React from "react";
import { render } from "@testing-library/react";

import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterCell,
  InlineTableFooterRow,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "../inline-table";

describe("InlineTable column-integrity guard", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("stays silent when every row matches the header column count", () => {
    render(
      <InlineTable>
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Item</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Remaining</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          <InlineTableRow>
            <InlineTableCell>Widget</InlineTableCell>
            <InlineTableCell align="right">$10</InlineTableCell>
            <InlineTableCell align="right">$10</InlineTableCell>
          </InlineTableRow>
        </InlineTableBody>
        <InlineTableFooter>
          <InlineTableFooterRow type="totals">
            <InlineTableFooterCell align="right" colSpan={1}>
              Total
            </InlineTableFooterCell>
            <InlineTableFooterCell align="right">$10</InlineTableFooterCell>
            <InlineTableFooterCell align="right">$10</InlineTableFooterCell>
          </InlineTableFooterRow>
        </InlineTableFooter>
      </InlineTable>,
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("errors when the footer spans fewer columns than the header", () => {
    // Header has 3 columns; the footer only accounts for 2 (label colSpan=1 + 1
    // value cell) — exactly the off-by-one that misaligns the totals.
    render(
      <InlineTable>
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Item</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Remaining</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          <InlineTableRow>
            <InlineTableCell>Widget</InlineTableCell>
            <InlineTableCell align="right">$10</InlineTableCell>
            <InlineTableCell align="right">$10</InlineTableCell>
          </InlineTableRow>
        </InlineTableBody>
        <InlineTableFooter>
          <InlineTableFooterRow type="totals">
            <InlineTableFooterCell align="right" colSpan={1}>
              Total
            </InlineTableFooterCell>
            <InlineTableFooterCell align="right">$10</InlineTableFooterCell>
          </InlineTableFooterRow>
        </InlineTableFooter>
      </InlineTable>,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("footer row 0 spans 2 column(s) but the header has 3"),
      expect.anything(),
    );
  });

  it("accepts a full-width row that spans every column via colSpan", () => {
    render(
      <InlineTable>
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Item</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Remaining</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          <InlineTableRow>
            <InlineTableCell colSpan={3}>No line items yet</InlineTableCell>
          </InlineTableRow>
        </InlineTableBody>
      </InlineTable>,
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
