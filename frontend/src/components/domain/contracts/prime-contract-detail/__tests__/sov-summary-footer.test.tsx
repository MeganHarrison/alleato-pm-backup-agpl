/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  buildSovSummaryValues,
  SovSummaryFooterRows,
} from "../sov-summary-footer";

const formatCurrency = (value: number | null | undefined) =>
  `$${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

describe("SOV summary footer", () => {
  it("computes Procore-style prime contract SOV summary values", () => {
    expect(
      buildSovSummaryValues({
        subtotal: 210_975,
        approvedChanges: 1_250,
        billedToDate: 12_500,
      }),
    ).toEqual({
      subtotal: 210_975,
      originalContract: 210_975,
      approvedChanges: 1_250,
      contractTotal: 212_225,
      billedToDate: 12_500,
      amountRemaining: 199_725,
    });
  });

  it("renders every required summary row", () => {
    render(
      <table>
        <tbody>
          <SovSummaryFooterRows
            summary={buildSovSummaryValues({
              subtotal: 210_975,
              approvedChanges: 0,
              billedToDate: 0,
            })}
            formatCurrency={formatCurrency}
            labelColSpan={7}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Subtotal:")).toBeInTheDocument();
    expect(screen.getByText("Original Contract:")).toBeInTheDocument();
    expect(screen.getByText("Approved Changes:")).toBeInTheDocument();
    expect(screen.getByText("Contract Total:")).toBeInTheDocument();
    expect(screen.getByText("Billed to Date:")).toBeInTheDocument();
    expect(screen.getByText("Amount Remaining:")).toBeInTheDocument();
    expect(screen.getAllByText("$210,975.00")).toHaveLength(4);
  });
});
